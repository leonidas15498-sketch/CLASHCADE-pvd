-- All game mutations are server-authoritative. No client write grant on rooms.
create schema if not exists clashcade_private;
revoke all on schema clashcade_private from public;
grant usage on schema clashcade_private to authenticated;

create table public.clashcade_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id),
  guest_id uuid references auth.users(id),
  host_name text not null check (length(host_name) between 1 and 14),
  guest_name text check (length(guest_name) between 1 and 14),
  host_seen timestamptz not null default now(),
  guest_seen timestamptz,
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
  board integer[] not null default array_fill(0,array[42]) check (array_length(board,1)=42),
  turn integer not null default 0 check (turn in (0,1)),
  first_player integer not null default 0 check (first_player in (0,1)),
  winner text check (winner in ('0','1','draw')),
  scores integer[] not null default array[0,0],
  rematch boolean[] not null default array[false,false],
  round integer not null default 1,
  version bigint not null default 0,
  moves integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '4 hours'),
  check (guest_id is null or host_id<>guest_id)
);
create index clashcade_rooms_host_idx on public.clashcade_rooms(host_id);
create index clashcade_rooms_guest_idx on public.clashcade_rooms(guest_id);
create index clashcade_rooms_expiry_idx on public.clashcade_rooms(expires_at);
alter table public.clashcade_rooms enable row level security;
revoke all on public.clashcade_rooms from public, anon, authenticated;
grant select on public.clashcade_rooms to authenticated;
create policy participants_read on public.clashcade_rooms for select to authenticated
  using ((select auth.uid())=host_id or (select auth.uid())=guest_id);

create table clashcade_private.commands (
  actor uuid not null,
  command_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor,command_id)
);
alter table clashcade_private.commands enable row level security;
revoke all on clashcade_private.commands from public, anon, authenticated;
create index clashcade_commands_created_idx on clashcade_private.commands(created_at);

-- Privilege elevation is deliberately isolated in an unexposed schema. Every
-- action derives actor from auth.uid(), checks membership, locks and validates.
create function clashcade_private.command(
  p_action text, p_command_id uuid, p_room_id uuid default null,
  p_code text default null, p_name text default null, p_column integer default null,
  p_version bigint default null, p_round integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
<<command_block>>
declare
  actor uuid := auth.uid();
  room public.clashcade_rooms%rowtype;
  prior clashcade_private.commands%rowtype;
  request jsonb := jsonb_build_array(p_action,p_room_id,p_code,p_name,p_column,p_version,p_round);
  player integer; row_index integer; c integer; r integer; dx integer; dy integer;
  sign integer; distance integer; aligned integer; won boolean := false;
  directions integer[][] := array[[1,0],[0,1],[1,1],[1,-1]];
  d integer; out_json jsonb;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_command_id is null then raise exception 'COMMAND_REQUIRED'; end if;
  if p_action not in ('create','join','resume','heartbeat','ready','move','rematch','leave') then raise exception 'INVALID_ACTION'; end if;
  -- Serialize retries of the same command before checking its result.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_command_id::text,0));
  if p_action not in ('heartbeat','ready') then
    select * into prior from clashcade_private.commands where commands.actor=command_block.actor and command_id=p_command_id;
    if found then
      if prior.request<>request then raise exception 'COMMAND_REUSED'; end if;
      return prior.response;
    end if;
  end if;
  if p_action='create' then
    -- Limit active rooms per identity; invites are not authentication credentials.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,1));
    if (select count(*) from public.clashcade_rooms where host_id=actor and status<>'closed' and expires_at>now())>=5 then raise exception 'ROOM_LIMIT'; end if;
    if p_name is null or length(trim(p_name)) not between 1 and 14 then raise exception 'INVALID_NAME'; end if;
    insert into public.clashcade_rooms(code,host_id,host_name)
      values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),actor,trim(p_name)) returning * into room;
  else
    if p_action='join' then
      if p_code is null or upper(trim(p_code)) !~ '^[A-F0-9]{10}$' then raise exception 'INVALID_CODE'; end if;
      select * into room from public.clashcade_rooms where code=upper(trim(p_code)) for update;
    else
      select * into room from public.clashcade_rooms where id=p_room_id for update;
    end if;
    if room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
    if room.status='closed' or room.expires_at<now() then raise exception 'ROOM_CLOSED'; end if;
    if p_action='join' and actor<>room.host_id and actor is distinct from room.guest_id then
      if room.guest_id is not null then raise exception 'ROOM_FULL'; end if;
      if p_name is null or length(trim(p_name)) not between 1 and 14 then raise exception 'INVALID_NAME'; end if;
      room.guest_id:=actor; room.guest_name:=trim(p_name); room.guest_seen:=now(); room.version:=room.version+1;
    end if;
    if actor=room.host_id then player:=0;
    elsif actor=room.guest_id then player:=1;
    else raise exception 'NOT_PARTICIPANT'; end if;
    if p_action in ('join','resume','heartbeat','ready') then
      if player=0 then room.host_seen:=now(); else room.guest_seen:=now(); end if;
      if p_action='ready' then
        if player=0 then room.host_ready:=true; else room.guest_ready:=true; end if;
      end if;
      if room.status='waiting' and room.host_ready and room.guest_ready and room.guest_id is not null and room.host_seen>now()-interval '35 seconds' and room.guest_seen>now()-interval '35 seconds' then
        room.status:='playing'; room.version:=room.version+1;
      end if;
    elsif p_action='move' then
      if room.status<>'playing' then raise exception 'NOT_PLAYING'; end if;
      if room.host_seen<now()-interval '35 seconds' or room.guest_seen is null or room.guest_seen<now()-interval '35 seconds' then raise exception 'PLAYER_DISCONNECTED'; end if;
      if p_version is distinct from room.version or p_round is distinct from room.round then raise exception 'STALE_VERSION'; end if;
      if player<>room.turn then raise exception 'NOT_YOUR_TURN'; end if;
      if p_column is null or p_column<0 or p_column>6 then raise exception 'INVALID_COLUMN'; end if;
      row_index:=0;
      while row_index<6 and room.board[p_column*6+row_index+1]<>0 loop row_index:=row_index+1; end loop;
      if row_index=6 then raise exception 'COLUMN_FULL'; end if;
      room.board[p_column*6+row_index+1]:=player+1; room.moves:=room.moves+1;
      -- Evaluate only the line through the newly accepted piece.
      for d in 1..4 loop
        dx:=directions[d][1]; dy:=directions[d][2]; aligned:=1;
        foreach sign in array array[-1,1] loop
          for distance in 1..3 loop
            c:=p_column+dx*sign*distance; r:=row_index+dy*sign*distance;
            exit when c<0 or c>6 or r<0 or r>5;
            exit when room.board[c*6+r+1]<>player+1;
            aligned:=aligned+1;
          end loop;
        end loop;
        if aligned>=4 then won:=true; exit; end if;
      end loop;
      if won then
        room.winner:=player::text; room.status:='finished'; room.scores[player+1]:=room.scores[player+1]+1;
      elsif room.moves=42 then room.winner:='draw'; room.status:='finished';
      else room.turn:=1-player; end if;
      room.version:=room.version+1;
    elsif p_action='rematch' then
      if room.status<>'finished' then raise exception 'MATCH_NOT_FINISHED'; end if;
      if p_round is distinct from room.round then raise exception 'STALE_VERSION'; end if;
      room.rematch[player+1]:=true; room.version:=room.version+1;
      if room.rematch[1] and room.rematch[2] then
        room.board:=array_fill(0,array[42]); room.moves:=0; room.winner:=null;
        room.first_player:=1-room.first_player; room.turn:=room.first_player;
        room.round:=room.round+1; room.rematch:=array[false,false]; room.status:='playing';
      end if;
    elsif p_action='leave' then room.status:='closed'; room.version:=room.version+1;
    end if;
    update public.clashcade_rooms set guest_id=room.guest_id,guest_name=room.guest_name,
      host_ready=room.host_ready,guest_ready=room.guest_ready,
      host_seen=room.host_seen,guest_seen=room.guest_seen,status=room.status,board=room.board,
      turn=room.turn,first_player=room.first_player,winner=room.winner,scores=room.scores,
      rematch=room.rematch,round=room.round,version=room.version,moves=room.moves where id=room.id;
  end if;
  out_json:=to_jsonb(room);
  if p_action not in ('heartbeat','ready') then
    insert into clashcade_private.commands(actor,command_id,request,response) values(actor,p_command_id,request,out_json);
  end if;
  return out_json;
end;
$$;
revoke all on function clashcade_private.command(text,uuid,uuid,text,text,integer,bigint,integer) from public,anon,authenticated;
grant execute on function clashcade_private.command(text,uuid,uuid,text,text,integer,bigint,integer) to authenticated;

create function public.clashcade_command(
  p_action text, p_command_id uuid, p_room_id uuid default null,
  p_code text default null, p_name text default null, p_column integer default null,
  p_version bigint default null, p_round integer default null
) returns jsonb language sql security invoker set search_path='' as $$
  select clashcade_private.command(p_action,p_command_id,p_room_id,p_code,p_name,p_column,p_version,p_round);
$$;
revoke all on function public.clashcade_command(text,uuid,uuid,text,text,integer,bigint,integer) from public,anon,authenticated;
grant execute on function public.clashcade_command(text,uuid,uuid,text,text,integer,bigint,integer) to authenticated;

create function public.clashcade_online_status() returns integer language sql security invoker set search_path='' as $$ select 1; $$;
revoke all on function public.clashcade_online_status() from public;
grant execute on function public.clashcade_online_status() to anon,authenticated;

-- Local PostgreSQL tests need not run the Supabase replication service.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.clashcade_rooms;
  end if;
end $$;
