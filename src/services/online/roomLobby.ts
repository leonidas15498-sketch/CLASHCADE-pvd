import { T } from '../../i18n/lang';
import { ConnectionState, Room, Rooms, StatePayload } from './types';

export interface LobbyOptions {
  /** Título da janela de entrar/criar sala. */
  title: string;
  /** Chave do localStorage com a última sala (uma por jogo). */
  savedKey: string;
  /** Classes de estilo do jogo: janela (precisa abrir com a classe `show`), caixa e botão principal. */
  overlayClass: string;
  boxClass: string;
  primaryClass: string;
  /** Onde colocar a barra da sala (código, vez, sair). */
  placeBar(bar: HTMLElement): void;
  /** Mensagem efêmera do outro jogador (ex.: mira ao vivo); `pl` = número de quem enviou. Validar antes de usar. */
  live?(data: Record<string, unknown>): void;
}

/** Janela de criar/entrar em sala privada + barra de status. Serve a qualquer jogo por turnos. */
export class RoomLobby {
  room: Room | null = null;
  private uid: string | null = null;
  private connection: ConnectionState = 'disconnected';
  private overlay: HTMLElement;
  private bar: HTMLElement;
  private ac = new AbortController();
  private disposed = false;
  protected busy = false;
  private errorText = '';
  private savedKey: string;
  private onLive?: (data: Record<string, unknown>) => void;
  constructor(root: HTMLElement, protected network: Rooms, private change: (room: Room) => void, end: () => void, opts: LobbyOptions) {
    this.savedKey = opts.savedKey;
    this.onLive = opts.live;
    this.overlay = document.createElement('section'); this.overlay.className = opts.overlayClass + ' online-lobby';
    this.overlay.innerHTML = `<div class="${opts.boxClass}"><h2>${opts.title}</h2>
      <label>${T('Apelido', 'Nickname')}<input data-net="name" maxlength="14" autocomplete="nickname"></label>
      <button data-net="create" class="${opts.primaryClass}">${T('Criar sala privada', 'Create private room')}</button>
      <label>${T('Código de convite', 'Invite code')}<input data-net="code" maxlength="10" autocapitalize="characters" spellcheck="false"></label>
      <button data-net="join">${T('Entrar com código', 'Join with code')}</button>
      <button data-net="resume" hidden>${T('Reconectar à última sala', 'Reconnect to last room')}</button>
      <p data-net="message" role="status"></p><button data-net="back">${T('Voltar', 'Back')}</button></div>`;
    this.bar = document.createElement('div'); this.bar.className = 'online-bar'; this.bar.hidden = true;
    this.bar.innerHTML = `<span data-net="summary" role="status"></span><button data-net="copy">${T('Copiar código', 'Copy code')}</button><button data-net="leave">${T('Sair da sala', 'Leave room')}</button>`;
    root.append(this.overlay); opts.placeBar(this.bar);
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
      const ok = await copyText(this.room.code);
      this.errorText = ok ? T('Código copiado.', 'Code copied.') : `${T('Não deu para copiar. Código:', 'Could not copy. Code:')} ${this.room.code}`;
      this.render();
    } });
  }
  private el<E extends HTMLElement = HTMLElement>(key: string): E {
    return (this.overlay.querySelector(`[data-net="${key}"]`) ?? this.bar.querySelector(`[data-net="${key}"]`)) as E;
  }
  private name() { return this.el<HTMLInputElement>('name').value.trim() || T('Jogador', 'Player'); }
  private saved() { try { return localStorage.getItem(this.savedKey); } catch { return null; } }
  open() { this.errorText = ''; this.el('resume').hidden = !this.saved(); this.overlay.classList.add('show'); }
  private error(message: string) { if (this.disposed) return; this.errorText = message; this.el('message').textContent = message; this.render(); }
  private accept(room: Room) {
    if (this.disposed || (this.room && (this.room.id !== room.id || this.room.version > room.version))) return;
    this.room = room; this.bar.hidden = false; this.render(); this.change(room);
  }
  private async attach(room: Room) {
    if (this.disposed) return;
    this.uid = (await this.network.identity()).id;
    try { localStorage.setItem(this.savedKey, room.id); } catch { /* session still works */ }
    this.room = null; this.accept(room);
    this.overlay.classList.remove('show');
    await this.network.watch(room, {
      state: next => this.accept(next),
      connection: next => { if (this.disposed) return; this.connection = next; if (next === 'connected') this.errorText = ''; this.render(); },
      error: message => this.error(message),
      live: data => { if (!this.disposed && this.room) this.onLive?.(data); },
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
  /** Jogo com física: envia o estado depois da tacada (ou do tempo esgotado). Devolve a sala aceita. */
  async submit(payload: StatePayload): Promise<Room> {
    if (!this.room) throw new Error('No room');
    this.busy = true;
    try { const next = await this.network.submit(this.room, payload); this.accept(next); return next; }
    finally { this.busy = false; }
  }
  /** Mensagem efêmera para o outro aparelho, marcada com o número deste jogador (`pl`). */
  sendLive(data: Record<string, unknown>) {
    if (this.disposed || !this.room || this.player === null || this.connection !== 'connected') return;
    this.network.sendLive?.(this.room, { ...data, pl: this.player });
  }
  get pending() { return this.busy; }
  get connected() { return this.connection === 'connected'; }
  peerOnline() { return this.peerPresent(); }
  async rematch() { if (this.room) this.accept(await this.network.rematch(this.room)); }
  async leave() {
    if (this.room && this.room.status !== 'closed') await this.network.leave(this.room);
    try { localStorage.removeItem(this.savedKey); } catch { /* no storage */ }
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

/**
 * Copia o código da sala. Alguns celulares recusam a área de transferência moderna (bug relatado pelo Leon, 03/11),
 * então tenta 3 caminhos: Clipboard API → seleção + copiar (método antigo) → menu de compartilhar do celular.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* tenta o próximo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:0;top:0;opacity:0;user-select:text;-webkit-user-select:text';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch { /* tenta o próximo */ }
  try {
    if (navigator.share) { await navigator.share({ text }); return true; }
  } catch { /* cancelado */ }
  return false;
}
