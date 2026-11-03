-- Clashcade: salas privadas para vários jogos (Quatro em Linha + Sinuca 8-Ball).
-- Aplicar DEPOIS de 20261102205003_clashcade_connect4_online.sql. Não apaga salas existentes.
--
-- Quatro em Linha: continua 100% validado no servidor (tabuleiro e vitória calculados aqui).
-- Jogos com física (Sinuca; depois Minigolfe/Torre): quem joga simula a tacada no próprio aparelho e envia o
-- estado final. O servidor valida identidade, sala, vez, versão, rodada, tamanho e forma do pacote, prazos de
-- tempo esgotado e placar. NÃO revalida a física: um cliente adulterado pode mentir o resultado da tacada.
-- Aceitável para salas privadas entre amigos; não serve para ranking ou prêmio.

alter table public.clashcade_rooms
  add column game text not null default 'connect4' check (game in ('connect4','pool')),
  add column state jsonb check (state is null or jsonb_typeof(state)='object'),
  add column turn_started timestamptz not null default now();

drop function public.clashcade_command(text,uuid,uuid,text,text,integer,bigint,integer);
drop function clashcade_private.command(text,uuid,uuid,text,text,integer,bigint,integer);

create function clashcade_private.command(
  p_action text, p_command_id uuid, p_room_id uuid default null,
  p_code text default null, p_name text default null, p_column integer default null,
  p_version bigint default null, p_round integer default null,
  p_game text default null, p_payload jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
<<command_block>>
declare
  actor uuid := auth.uid();
  room public.clashcade_rooms%rowtype;
  prior clashcade_private.commands%rowtype;
  game_id text := coalesce(p_game,'connect4');
  request jsonb := jsonb_build_array(p_action,p_room_id,p_code,p_name,p_column,p_version,p_round,p_game,p_payload);
  player integer; row_index integer; c integer; r integer; dx integer; dy integer;
  sign integer; distance integer; aligned integer; won boolean := false;
  directions integer[][] := array[[1,0],[0,1],[1,1],[1,-1]];
  d integer; out_json jsonb;
  kind text; next_turn integer; new_winner text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_command_id is null then raise exception 'COMMAND_REQUIRED'; end if;
  if p_action not in ('create','join','resume','heartbeat','ready','move','rematch','leave') then raise exception 'INVALID_ACTION'; end if;
  if game_id not in ('connect4','pool') then raise exception 'INVALID_GAME'; end if;
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
    insert into public.clashcade_rooms(code,host_id,host_name,game)
      values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),actor,trim(p_name),game_id) returning * into room;
  else
    if p_action='join' then
      if p_code is null or upper(trim(p_code)) !~ '^[A-F0-9]{10}$' then raise exception 'INVALID_CODE'; end if;
      select * into room from public.clashcade_rooms where code=upper(trim(p_code)) for update;
    else
      select * into room from public.clashcade_rooms where id=p_room_id for update;
    end if;
    if room.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
    if room.status='closed' or room.expires_at<now() then raise exception 'ROOM_CLOSED'; end if;
    -- A code from another game must not open this game's room (old clients send no p_game = connect4).
    if p_action in ('join','resume','move') and room.game<>game_id then raise exception 'WRONG_GAME'; end if;
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
        room.status:='playing'; room.version:=room.version+1; room.turn_started:=now();
      end if;
    elsif p_action='move' then
      if room.status<>'playing' then raise exception 'NOT_PLAYING'; end if;
      if room.host_seen<now()-interval '35 seconds' or room.guest_seen is null or room.guest_seen<now()-interval '35 seconds' then raise exception 'PLAYER_DISCONNECTED'; end if;
      if p_version is distinct from room.version or p_round is distinct from room.round then raise exception 'STALE_VERSION'; end if;
      if room.game='connect4' then
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
      else
        -- Physics games: {kind:'shot'|'timeout', next_turn:0|1, winner:null|'0'|'1', state:{...}}.
        if p_payload is null or jsonb_typeof(p_payload)<>'object' or pg_catalog.octet_length(p_payload::text)>20000 then raise exception 'INVALID_PAYLOAD'; end if;
        kind:=p_payload->>'kind';
        if kind is null or kind not in ('shot','timeout') then raise exception 'INVALID_PAYLOAD'; end if;
        if jsonb_typeof(p_payload->'next_turn') is distinct from 'number' or p_payload->>'next_turn' not in ('0','1') then raise exception 'INVALID_PAYLOAD'; end if;
        next_turn:=(p_payload->>'next_turn')::integer;
        if jsonb_typeof(p_payload->'state') is distinct from 'object' then raise exception 'INVALID_PAYLOAD'; end if;
        new_winner:=case when jsonb_typeof(p_payload->'winner')='string' then p_payload->>'winner' when coalesce(jsonb_typeof(p_payload->'winner'),'null')='null' then null else 'x' end;
        if new_winner is not null and new_winner not in ('0','1') then raise exception 'INVALID_PAYLOAD'; end if;
        if kind='shot' then
          if player<>room.turn then raise exception 'NOT_YOUR_TURN'; end if;
        else
          -- Time-out passes the turn. The shooter's own clock may report it after 35 s;
          -- the waiting player may claim it after 55 s (absent or stalled opponent).
          if new_winner is not null or next_turn<>1-room.turn then raise exception 'INVALID_PAYLOAD'; end if;
          if room.turn_started>now()-(case when player=room.turn then interval '35 seconds' else interval '55 seconds' end) then raise exception 'TOO_EARLY'; end if;
        end if;
        room.state:=p_payload->'state'; room.moves:=room.moves+1; room.turn:=next_turn;
        if new_winner is not null then
          room.winner:=new_winner; room.status:='finished';
          room.scores[new_winner::integer+1]:=room.scores[new_winner::integer+1]+1;
        end if;
      end if;
      room.turn_started:=now();
      room.version:=room.version+1;
    elsif p_action='rematch' then
      if room.status<>'finished' then raise exception 'MATCH_NOT_FINISHED'; end if;
      if p_round is distinct from room.round then raise exception 'STALE_VERSION'; end if;
      room.rematch[player+1]:=true; room.version:=room.version+1;
      if room.rematch[1] and room.rematch[2] then
        room.board:=array_fill(0,array[42]); room.moves:=0; room.winner:=null; room.state:=null;
        room.first_player:=1-room.first_player; room.turn:=room.first_player;
        room.round:=room.round+1; room.rematch:=array[false,false]; room.status:='playing'; room.turn_started:=now();
      end if;
    elsif p_action='leave' then room.status:='closed'; room.version:=room.version+1;
    end if;
    update public.clashcade_rooms set guest_id=room.guest_id,guest_name=room.guest_name,
      host_ready=room.host_ready,guest_ready=room.guest_ready,
      host_seen=room.host_seen,guest_seen=room.guest_seen,status=room.status,board=room.board,
      turn=room.turn,first_player=room.first_player,winner=room.winner,scores=room.scores,
      rematch=room.rematch,round=room.round,version=room.version,moves=room.moves,
      state=room.state,turn_started=room.turn_started where id=room.id;
  end if;
  out_json:=to_jsonb(room);
  if p_action not in ('heartbeat','ready') then
    insert into clashcade_private.commands(actor,command_id,request,response) values(actor,p_command_id,request,out_json);
  end if;
  return out_json;
end;
$$;
revoke all on function clashcade_private.command(text,uuid,uuid,text,text,integer,bigint,integer,text,jsonb) from public,anon,authenticated;
grant execute on function clashcade_private.command(text,uuid,uuid,text,text,integer,bigint,integer,text,jsonb) to authenticated;

create function public.clashcade_command(
  p_action text, p_command_id uuid, p_room_id uuid default null,
  p_code text default null, p_name text default null, p_column integer default null,
  p_version bigint default null, p_round integer default null,
  p_game text default null, p_payload jsonb default null
) returns jsonb language sql security invoker set search_path='' as $$
  select clashcade_private.command(p_action,p_command_id,p_room_id,p_code,p_name,p_column,p_version,p_round,p_game,p_payload);
$$;
revoke all on function public.clashcade_command(text,uuid,uuid,text,text,integer,bigint,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.clashcade_command(text,uuid,uuid,text,text,integer,bigint,integer,text,jsonb) to authenticated;

-- Protocolo 2 = salas multijogo. O cliente novo só mostra o Online quando isto responde 2.
create or replace function public.clashcade_online_status() returns integer language sql security invoker set search_path='' as $$ select 2; $$;
revoke all on function public.clashcade_online_status() from public;
grant execute on function public.clashcade_online_status() to anon,authenticated;

-- Faz o PostgREST enxergar a assinatura nova imediatamente.
notify pgrst, 'reload schema';
