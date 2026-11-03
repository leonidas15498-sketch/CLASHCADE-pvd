import { T } from '../../i18n/lang';
import { Connect4Room, Connect4Rooms, ConnectionState } from '../../services/online/types';
import { C4State, lineAt } from './logic';

export function roomBoard(room: Connect4Room): C4State {
  const cells = Array.from({ length: 7 }, (_, c) => room.board.slice(c * 6, c * 6 + 6));
  const s: C4State = { cells, current: room.turn, winner: room.winner === 'draw' ? 'draw' : room.winner === null ? null : Number(room.winner) as 0 | 1, line: [], moves: Array(room.moves).fill(0) };
  if (s.winner === 0 || s.winner === 1) {
    for (let c = 0; c < 7; c++) for (let r = 0; r < 6; r++) {
      if (cells[c][r] === s.winner + 1) { const line = lineAt(s, c, r); if (line) s.line = line; }
    }
  }
  return s;
}

const SAVED_ROOM = 'clashcade.connect4.room.v1';
export class Connect4Online {
  room: Connect4Room | null = null;
  private uid: string | null = null;
  private connection: ConnectionState = 'disconnected';
  private overlay: HTMLElement;
  private bar: HTMLElement;
  private ac = new AbortController();
  private disposed = false;
  private busy = false;
  private errorText = '';
  constructor(root: HTMLElement, private network: Connect4Rooms, private change: (room: Connect4Room) => void, end: () => void) {
    this.overlay = document.createElement('section'); this.overlay.className = 'gs-overlay';
    this.overlay.innerHTML = `<div class="gs-box"><h2>${T('Quatro em Linha online', 'Online Four in a Row')}</h2>
      <label>${T('Apelido', 'Nickname')}<input data-net="name" maxlength="14" autocomplete="nickname"></label>
      <button data-net="create" class="gs-primary">${T('Criar sala privada', 'Create private room')}</button>
      <label>${T('Código de convite', 'Invite code')}<input data-net="code" maxlength="10" autocapitalize="characters" spellcheck="false"></label>
      <button data-net="join">${T('Entrar com código', 'Join with code')}</button>
      <button data-net="resume" hidden>${T('Reconectar à última sala', 'Reconnect to last room')}</button>
      <p data-net="message" role="status"></p><button data-net="back">${T('Voltar', 'Back')}</button></div>`;
    this.bar = document.createElement('div'); this.bar.className = 'online-bar'; this.bar.hidden = true;
    this.bar.innerHTML = `<span data-net="summary" role="status"></span><button data-net="copy">${T('Copiar código', 'Copy code')}</button><button data-net="leave">${T('Sair da sala', 'Leave room')}</button>`;
    root.append(this.overlay); root.insertBefore(this.bar, root.querySelector('.gs-stage'));
    const bind = (key: string, fn: () => Promise<void> | void) => this.el<HTMLButtonElement>(key).addEventListener('click', () => {
      if (this.busy) return;
      this.busy = true;
      this.el('message').textContent = T('Conectando…', 'Connecting…');
      Promise.resolve().then(fn).catch(e => this.error(e instanceof Error ? e.message : String(e))).finally(() => { this.busy = false; });
    }, { signal: this.ac.signal });
    bind('create', async () => { await this.attach(await network.create(this.name())); });
    bind('join', async () => { await this.attach(await network.join(this.el<HTMLInputElement>('code').value, this.name())); });
    bind('resume', async () => { const id = this.saved(); if (id) await this.attach(await network.resume(id)); });
    bind('back', () => { this.overlay.classList.remove('show'); });
    bind('leave', async () => { await this.leave(); end(); });
    bind('copy', async () => { if (this.room) {
      if (!navigator.clipboard) { this.error(T('Copie o código exibido na barra da sala.', 'Copy the code displayed in the room bar.')); return; }
      await navigator.clipboard.writeText(this.room.code); this.errorText = T('Código copiado.', 'Code copied.'); this.render();
    } });
  }
  private el<E extends HTMLElement = HTMLElement>(key: string): E {
    return (this.overlay.querySelector(`[data-net="${key}"]`) ?? this.bar.querySelector(`[data-net="${key}"]`)) as E;
  }
  private name() { return this.el<HTMLInputElement>('name').value.trim() || T('Jogador', 'Player'); }
  private saved() { try { return localStorage.getItem(SAVED_ROOM); } catch { return null; } }
  open() { this.errorText = ''; this.el('resume').hidden = !this.saved(); this.overlay.classList.add('show'); }
  private error(message: string) { if (this.disposed) return; this.errorText = message; this.el('message').textContent = message; this.render(); }
  private accept(room: Connect4Room) {
    if (this.disposed || (this.room && (this.room.id !== room.id || this.room.version > room.version))) return;
    this.room = room; this.bar.hidden = false; this.render(); this.change(room);
  }
  private async attach(room: Connect4Room) {
    if (this.disposed) return;
    this.uid = (await this.network.identity()).id;
    try { localStorage.setItem(SAVED_ROOM, room.id); } catch { /* session still works */ }
    this.room = null; this.accept(room);
    this.overlay.classList.remove('show');
    await this.network.watch(room, {
      state: next => this.accept(next),
      connection: next => { if (this.disposed) return; this.connection = next; if (next === 'connected') this.errorText = ''; this.render(); },
      error: message => this.error(message),
    });
  }
  get player(): 0 | 1 | null { return !this.uid || !this.room ? null : this.room.host_id === this.uid ? 0 : this.room.guest_id === this.uid ? 1 : null; }
  get active() { return this.room !== null; }
  private peerPresent() {
    if (!this.room || this.player === null || !this.room.guest_seen) return false;
    const host = Date.parse(this.room.host_seen), guest = Date.parse(this.room.guest_seen);
    return Math.max(host, guest) - (this.player === 0 ? guest : host) < 35000;
  }
  canMove() { return !this.busy && this.connection === 'connected' && this.room?.status === 'playing' && this.peerPresent() && this.player === this.room.turn; }
  async move(column: number) {
    if (!this.canMove() || !this.room) return;
    this.busy = true;
    try { this.accept(await this.network.move(this.room, column)); }
    catch (e) { this.error(e instanceof Error ? e.message : String(e)); }
    finally { this.busy = false; }
  }
  async rematch() { if (this.room) this.accept(await this.network.rematch(this.room)); }
  async leave() {
    if (this.room && this.room.status !== 'closed') await this.network.leave(this.room);
    try { localStorage.removeItem(SAVED_ROOM); } catch { /* no storage */ }
    this.room = null; this.bar.hidden = true; this.dispose();
  }
  private render() {
    if (!this.room || this.disposed) return;
    const r = this.room;
    const role = this.player === null ? '' : ` · ${T('Você é J', 'You are P')}${this.player + 1}`;
    const status = this.connection !== 'connected' ? T('Reconectando…', 'Reconnecting…') : r.status === 'waiting' ? T('Aguardando segundo jogador', 'Waiting for second player') : r.status === 'closed' ? T('Sala encerrada', 'Room closed') : r.status === 'finished' ? (r.rematch.some(Boolean) ? T('Aguardando revanche', 'Waiting for rematch') : T('Partida concluída', 'Match complete')) : !this.peerPresent() ? T('Aguardando reconexão do outro jogador', 'Waiting for the other player to reconnect') : `${T('Vez de', 'Turn:')} ${r.turn === 0 ? r.host_name : r.guest_name}`;
    this.el('summary').textContent = `${r.code}${role} · ${status}${this.errorText ? ' · ' + this.errorText : ''}`;
  }
  dispose() { this.disposed = true; this.ac.abort(); this.network.dispose(); this.overlay.remove(); this.bar.remove(); }
}
