import { onMountRollback } from './lifecycle';
import { enterGameFullscreen, exitGameFullscreen } from './fullscreen';
import { GAMES } from '../registry';
import { newMatchId, reportMatch } from '../../services/match';
import { isEn, T } from '../../i18n/lang';
import { Music } from './music';
import { mountMusicControl } from './musicControl';
import { PLAYER_COLORS, setTurnColor } from './players';
import { Sfx } from './sfx';
import { equip, equipped, type ShopTheme } from './arenaThemes';
import { mountBalance, tierTag, wireLocked } from './shopUi';
import { itemByKey } from '../../services/catalog';
import { isUnlocked } from '../../services/economy';
import { currentTournamentGame, getTournament, recordTournament, TOURNAMENT_WINS } from '../../services/tournament';

const routeHere = () => (typeof location !== 'undefined' ? location.hash.replace('#', '') : '');

/**
 * Casca comum dos jogos novos: menu (1P vs IA / 2P local), HUD, pausa, confirmação, resultado,
 * revanche, efeitos sonoros, música e a cor da vez. Cada jogo só cuida do canvas e das regras.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface StartConfig {
  mode: 'ai' | 'local' | 'solo' | 'online';
  names: [string, string];
  difficulty: Difficulty;
}

export interface ShellOptions {
  id: string;
  title: string;
  subtitle: string;
  /** Modalidades oferecidas no menu. */
  modes: { solo?: string; ai?: boolean; local?: boolean };
  /** Texto do botão de 2P (ex.: "2 Jogadores Local"). */
  localNote?: string;
  helpHtml: string;
  musicUrl?: string | null;
  onExit: () => void;
  onStart: (cfg: StartConfig) => void;
  onPause: (paused: boolean) => void;
  onRestart: () => void;
  onMenu: () => void;
  /** Recorde/estatística para o rodapé do menu. */
  menuNote?: () => string;
  /** Loja do próprio jogo (pedido do Leon, 03/11): abas com os itens só deste jogo. */
  shop?: ShopSection[];
}

/** Uma aba da loja do jogo: itens do catálogo único + como desenhar a amostra (pelo mesmo renderizador do jogo). */
export interface ShopSection {
  slot: string;
  tabPt: string;
  tabEn: string;
  items: ShopTheme<unknown>[];
  preview: (ctx: CanvasRenderingContext2D, w: number, h: number, item: ShopTheme<unknown>) => void;
  /** Chamado quando o jogador troca o item equipado. */
  onChange: () => void;
}

interface ShellPrefs {
  sound: boolean;
  music: { enabled: boolean; volume: number };
  names: [string, string];
  difficulty: Difficulty;
}

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
const DIFF_EN: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const diffLabel = (d: Difficulty) => (isEn() ? DIFF_EN : DIFF_LABEL)[d];

const CSS = `
.gs-root{--turn:transparent;--panel:rgba(16,23,44,.9);--line:rgba(0,224,255,.24);--text:#f2f5ff;--muted:#aeb8d6;--go:#ffc24a;--sun:#ffc24a;
  position:fixed;inset:0;display:flex;flex-direction:column;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  background:radial-gradient(60% 45% at 50% -5%,rgba(255,194,74,.12),transparent 70%),radial-gradient(45% 60% at 0% 0%,rgba(255,59,77,.16),transparent 70%),radial-gradient(45% 60% at 100% 0%,rgba(47,107,255,.2),transparent 70%),linear-gradient(180deg,#0d1840,#0a1433 60%,#070e26);touch-action:none;user-select:none;-webkit-user-select:none;color-scheme:dark;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.gs-root::before{content:"";position:absolute;inset:0;pointer-events:none;background-color:var(--turn);opacity:.16;transition:background-color .45s ease}
.gs-root button{font:inherit;color:var(--text);cursor:pointer}
.gs-root button:disabled{opacity:.45;cursor:not-allowed}
.gs-root :focus-visible{outline:3px solid var(--sun);outline-offset:2px}
.gs-hud{position:relative;z-index:3;height:clamp(46px,13vh,66px);flex-shrink:0;display:flex;align-items:center;gap:clamp(4px,1vw,10px);padding:4px clamp(6px,1.2vw,14px)}
.gs-root .icon-btn,.gs-icon{width:min(50px,calc(clamp(46px,13vh,66px) - 10px));height:min(50px,calc(clamp(46px,13vh,66px) - 10px));min-width:40px;min-height:40px;border-radius:50%;
  border:1px solid rgba(0,224,255,.35);background:linear-gradient(#1f2a4a,#121a33);box-shadow:0 3px 8px rgba(0,0,0,.45);display:grid;place-items:center;padding:0;flex-shrink:0}
.gs-root .icon-btn svg,.gs-icon svg{width:52%;height:52%;fill:#fff}
.gs-title{flex:1 1 auto;min-width:0;height:100%;padding:2px 14px;border-radius:16px;background:var(--panel);border:1px solid var(--line);display:flex;flex-direction:column;justify-content:center}
.gs-title b{font-size:clamp(13px,3.4vh,18px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-title span{font-size:clamp(10px,2.7vh,13px);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-score{display:flex;gap:6px}
.gs-pill{display:flex;align-items:center;gap:6px;height:calc(clamp(46px,13vh,66px) - 12px);padding:0 12px;border-radius:999px;background:var(--panel);border:2px solid transparent;
  font-size:clamp(11px,2.8vh,14px);white-space:nowrap;opacity:.6}
.gs-pill.on{opacity:1;border-color:var(--c);box-shadow:0 0 14px var(--c)}
.gs-pill i{width:12px;height:12px;border-radius:50%;background:var(--c)}
.gs-pill b{font-size:clamp(15px,4vh,20px);font-variant-numeric:tabular-nums}
.gs-stage{position:relative;z-index:1;flex:1;min-height:0;display:grid;place-items:center;padding:2px clamp(6px,1vw,14px) 8px}
.gs-toast{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);max-width:92%;padding:6px 14px;border-radius:12px;background:rgba(10,20,51,.92);border:1px solid rgba(0,224,255,.25);
  font-size:clamp(11px,2.8vh,14px);text-align:center;pointer-events:none;opacity:0;transition:opacity .25s;z-index:5}
.gs-toast.show{opacity:1}
.gs-overlay{position:fixed;inset:0;z-index:30;display:none;place-items:center;padding:12px;overflow:auto;background:rgba(7,14,38,.7);backdrop-filter:blur(3px)}
.gs-overlay.show{display:grid}
.gs-overlay.top{z-index:40}
.gs-box{width:min(380px,94vw);max-height:94vh;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:clamp(12px,3vh,22px);border-radius:20px;
  background:linear-gradient(#1b2337,#10172c);border:1px solid var(--line);box-shadow:0 20px 50px rgba(0,0,0,.55)}
.gs-wide{width:min(760px,96vw)}
.gs-box h1{margin:0;text-align:center;font-size:clamp(22px,7vh,38px)}
.gs-top{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}
.gs-top>.gs-back{justify-self:start}
.gs-top h2{margin:0;text-align:center;font-size:clamp(17px,5vh,24px)}
.gs-links{justify-self:end;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.gs-box .gs-link{min-height:38px;border-radius:999px;padding:6px 12px;font-weight:700;background:#1f2a4a}
.gs-box .gs-shop-btn{background:linear-gradient(#2a3a66,#1f2a4a);border-color:var(--sun);color:var(--sun)}
.gs-bal{justify-self:end;display:flex;align-items:center;gap:6px;font-size:14px}
.gs-bal small{display:none}
.gs-bal .shop-coin{width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe9a8,#ffc24a 55%,#c98a12);box-shadow:inset 0 0 0 2px rgba(122,75,0,.45)}
.gs-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.gs-item{display:flex;flex-direction:column;gap:5px;padding:8px;border-radius:12px;background:rgba(10,20,51,.6);border:1px solid var(--line)}
.gs-item.on{border-color:#00e0ff;box-shadow:0 0 0 2px rgba(0,224,255,.35)}
.gs-item canvas{width:100%;aspect-ratio:16/9;border-radius:8px;display:block}
.gs-item b{font-size:14px}.gs-item .gs-tag{font-size:11.5px;color:var(--muted)}
.gs-item .gs-tag.prem{color:#ca86ff}.gs-item .gs-tag.own{color:#28c7b7}
.gs-box .gs-item button{min-height:34px;padding:4px 8px;font-size:13px}
/* 04/11 estética do menu (referência prompts-gpt-2 item 2): cartões com ícone, faixa de cor do modo, título com brilho */
.gs-box h1{text-shadow:0 0 18px rgba(0,224,255,.35),0 2px 0 rgba(0,0,0,.4);letter-spacing:.01em}
.gs-card{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(23,34,67,.92),rgba(10,20,51,.85));box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.gs-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--acc,#ffc24a)}
.gs-c-ai{--acc:#3d8bff}.gs-c-two{--acc:linear-gradient(90deg,#ff6b4a 50%,#3d8bff 50%)}.gs-c-solo{--acc:#ffc24a}
.gs-card h2{display:flex;align-items:center;gap:8px;margin:0;font-size:16px}
.gs-ico{width:30px;height:30px;flex:0 0 30px;border-radius:10px;display:grid;place-items:center;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.gs-ico svg{width:20px;height:20px;fill:#cfe6ff}
.gs-c-ai .gs-ico{background:rgba(61,139,255,.22)}.gs-c-solo .gs-ico{background:rgba(255,194,74,.2)}.gs-c-solo .gs-ico svg{fill:#ffd877}
.gs-card .gs-primary::after,.gs-box [data-k="resume"]::after{content:" ▶";font-size:.8em}
.gs-seg button{transition:transform .08s ease}.gs-seg button:active,.gs-box button:active{transform:translateY(1px)}
@media (max-height:420px){.gs-ico{width:24px;height:24px;flex-basis:24px}.gs-ico svg{width:16px;height:16px}.gs-card h2{font-size:14.5px}}
@media (max-width:560px){.gs-top{grid-template-columns:1fr;justify-items:center}.gs-top>.gs-back,.gs-links,.gs-bal{justify-self:center}}
.gs-box h1 small{display:block;font-size:.42em;color:var(--sun);letter-spacing:.08em;text-transform:uppercase}
.gs-box h2{margin:0;font-size:clamp(17px,4.2vh,22px)}
.gs-box p{margin:0;color:var(--muted)}
.gs-box button{min-height:44px;border-radius:12px;border:1px solid var(--line);background:#1f2a4a;padding:8px 14px}
.gs-box .gs-primary{background:linear-gradient(#ffd877,#ffb52e 55%,#e0901a);color:#2a1600;border-color:#ffe7a6;font-weight:900;box-shadow:0 3px 0 #9c5d08}
.gs-modes{display:flex;flex-wrap:wrap;gap:12px}
.gs-card{flex:1 1 230px;min-width:0;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:14px;background:rgba(10,20,51,.6);border:1px solid var(--line)}
.gs-names{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.gs-names label{min-width:0}.gs-names input{width:100%;min-width:0;box-sizing:border-box}
.gs-card label{display:flex;flex-direction:column;gap:3px;font-size:13px;color:var(--muted)}
.gs-card input{font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:#0a1433;color:var(--text);user-select:text;-webkit-user-select:text}
.gs-seg{display:flex;gap:4px}.gs-seg button{flex:1;min-height:38px}
.gs-seg button.on{background:var(--sun);color:#1a1208;font-weight:800}
.gs-row{display:flex;gap:10px}.gs-row button{flex:1}
.gs-back{align-self:flex-start;min-height:32px!important;background:transparent!important;border:0!important;color:var(--muted)!important;padding:2px 6px!important}
.gs-note{font-size:12px}
.gs-help{margin:0;padding-left:18px;line-height:1.5;font-size:14px;color:#ece6f6}
.gs-dot{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:4px}
@media (max-height:420px){.gs-box{gap:6px;padding:10px 14px}.gs-box button{min-height:36px;padding:5px 10px}.gs-card{padding:8px 10px;gap:5px}}
/* celular em pé: o painel de título espremido sobrepunha o placar (01/11); o placar já diz de quem é a vez */
@media (max-width:560px){.gs-title{display:none}.gs-score{margin-right:auto;min-width:0}.gs-pill{padding:0 10px;font-size:0;gap:6px}}
@media (prefers-reduced-motion:reduce){.gs-toast{transition:none}}
`;

const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 4h4v16H7zm6 0h4v16h-4z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
  soundOff:
    '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm18.6 6.2-1.4 1.4L17 13.4l-3.2 3.2-1.4-1.4 3.2-3.2-3.2-3.2 1.4-1.4 3.2 3.2 3.2-3.2 1.4 1.4-3.2 3.2z"/></svg>',
};

/** Rótulo traduzido da dificuldade. */
export { diffLabel };

export class Shell {
  readonly root: HTMLElement;
  readonly stage: HTMLElement;
  readonly sfx = new Sfx();
  paused = false;
  private externalMatch = false;
  /** Há partida em andamento (pede confirmação antes de sair). */
  inMatch = false;
  private ac = new AbortController();
  private style: HTMLStyleElement;
  private prefs: ShellPrefs;
  private music: Music | null;
  private musicCtl: { destroy(): void } | null = null;
  private toastTimer = 0;
  private resultYes: (() => void) | null = null;
  private matchId: string | null = null;
  /** A partida atual é do Modo Torneio (começou sozinha a partir do torneio). */
  private tour = false;
  private startFn: ((cfg: StartConfig) => void) | null = null;

  constructor(
    private container: HTMLElement,
    private o: ShellOptions,
  ) {
    onMountRollback(() => this.dispose());
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.prefs = this.loadPrefs();
    this.sfx.enabled = this.prefs.sound;
    const m = o.modes;
    container.innerHTML = `
<div class="gs-root">
  <header class="gs-hud">
    <button class="gs-icon" data-k="home" aria-label="${T('Menu do jogo', 'Game menu')}" title="Menu">${ICONS.home}</button>
    <div class="gs-title"><b>${o.title}</b><span data-k="sub">${o.subtitle}</span></div>
    <div class="gs-score" data-k="score"></div>
    <div data-k="music"></div>
    <button class="gs-icon" data-k="sound" aria-label="${T('Efeitos sonoros', 'Sound effects')}" title="${T('Efeitos sonoros', 'Sound effects')}"></button>
    <button class="gs-icon" data-k="pause" aria-label="${T('Pausar', 'Pause')}" title="${T('Pausar', 'Pause')}">${ICONS.pause}</button>
  </header>
  <main class="gs-stage" data-k="stage"><div class="gs-toast" data-k="toast" role="status"></div></main>

  <section class="gs-overlay show" data-k="menu"><div class="gs-box gs-wide">
    <div class="gs-top">
      <button class="gs-back" data-k="back">${T('← Jogos', '← Games')}</button>
      <h1>${o.title}<small>${o.subtitle}</small></h1>
      <div class="gs-links">${o.shop?.length ? `<button class="gs-link gs-shop-btn" data-k="menu-shop">🛍️ ${T('Loja', 'Shop')}</button>` : ''}<button class="gs-link" data-k="menu-help">❓ ${T('Como jogar', 'How to play')}</button></div>
    </div>
    <div class="gs-modes">
      ${
        m.solo
          ? `<div class="gs-card gs-c-solo"><h2><span class="gs-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span>${T('1 Jogador', '1 Player')}</h2><label>${T('Apelido', 'Nickname')} <input data-k="n-solo" id="gs-${o.id}-solo" maxlength="14" placeholder="${T('Você', 'You')}"></label>
             <button class="gs-primary" data-k="play-solo">${m.solo}</button><p class="gs-note" data-k="note"></p></div>`
          : ''
      }
      ${
        m.ai
          ? `<div class="gs-card gs-c-ai"><h2><span class="gs-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="4"/><rect x="11" y="2" width="2" height="5"/><circle cx="12" cy="2.5" r="1.6"/><circle cx="9" cy="13" r="1.6" fill="#0a1433"/><circle cx="15" cy="13" r="1.6" fill="#0a1433"/></svg></span>${T('1 Jogador contra IA', '1 Player vs AI')}</h2><label>${T('Apelido', 'Nickname')} <input data-k="n-ai" id="gs-${o.id}-ai" maxlength="14" placeholder="${T('Você', 'You')}"></label>
             <div class="gs-seg" data-k="diff" role="radiogroup" aria-label="${T('Dificuldade', 'Difficulty')}">
               <button data-d="easy" role="radio">${diffLabel('easy')}</button><button data-d="medium" role="radio">${diffLabel('medium')}</button><button data-d="hard" role="radio">${diffLabel('hard')}</button></div>
             <button class="gs-primary" data-k="play-ai">${T('Jogar contra a IA', 'Play vs AI')}</button></div>`
          : ''
      }
      ${
        m.local
          ? `<div class="gs-card gs-c-two"><h2><span class="gs-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.3" fill="#ff6b4a"/><path d="M1.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" fill="#ff6b4a"/><circle cx="16.5" cy="8" r="3.3" fill="#3d8bff"/><path d="M10 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6z" fill="#3d8bff"/></svg></span>${T('2 Jogadores Local', '2 Players, same device')}</h2>
             <div class="gs-names"><label><span><span class="gs-dot" style="background:${PLAYER_COLORS[0]}"></span>${T('Jogador 1', 'Player 1')}</span><input data-k="n1" id="gs-${o.id}-p1" maxlength="14" placeholder="${T('Jogador 1', 'Player 1')}"></label>
             <label><span><span class="gs-dot" style="background:${PLAYER_COLORS[1]}"></span>${T('Jogador 2', 'Player 2')}</span><input data-k="n2" id="gs-${o.id}-p2" maxlength="14" placeholder="${T('Jogador 2', 'Player 2')}"></label></div>
             <button class="gs-primary" data-k="play-local">${T('Jogar no mesmo aparelho', 'Play on this device')}</button>${o.localNote ? `<p class="gs-note">${o.localNote}</p>` : ''}</div>`
          : ''
      }
    </div>
  </div></section>

  <section class="gs-overlay top" data-k="shopbox"><div class="gs-box gs-wide gs-shop">
    <div class="gs-top"><button class="gs-back" data-k="shop-close">${T('← Voltar', '← Back')}</button><h2>${T('Loja', 'Shop')} · ${o.title}</h2><div class="gs-bal" data-k="shop-bal"></div></div>
    <div class="gs-seg gs-tabs" data-k="shop-tabs" role="tablist"></div>
    <p class="gs-note">${T('Só muda o visual: a física e as regras são iguais para todos.', 'Looks only: physics and rules are the same for everyone.')}</p>
    <div class="gs-items" data-k="shop-items"></div>
  </div></section>

  <section class="gs-overlay" data-k="pausebox"><div class="gs-box">
    <h2>${T('Pausado', 'Paused')}</h2>
    <button class="gs-primary" data-k="resume">${T('Continuar', 'Resume')}</button>
    <button data-k="restart">${T('Reiniciar partida', 'Restart match')}</button>
    <button data-k="help">${T('Como jogar', 'How to play')}</button>
    ${o.shop?.length ? `<button data-k="pause-shop">🛍️ ${T('Loja', 'Shop')}</button>` : ''}
    <button data-k="to-menu">${T('Voltar ao menu', 'Back to menu')}</button>
  </div></section>

  <section class="gs-overlay top" data-k="helpbox"><div class="gs-box gs-wide">
    <h2>${T('Como jogar', 'How to play')}</h2><div class="gs-help">${o.helpHtml}</div>
    <button class="gs-primary" data-k="help-close">${T('Fechar', 'Close')}</button>
  </div></section>

  <section class="gs-overlay" data-k="result"><div class="gs-box">
    <h2 data-k="r-title"></h2><p data-k="r-msg"></p>
    <div class="gs-row"><button data-k="r-menu">${T('Voltar aos jogos', 'Back to games')}</button><button data-k="r-new">${T('Nova partida', 'New match')}</button><button data-k="r-next">🎲 ${T('Outro jogo', 'Another game')}</button><button class="gs-primary" data-k="r-again">${T('Revanche', 'Rematch')}</button></div>
  </div></section>

  <section class="gs-overlay top" data-k="confirm"><div class="gs-box">
    <p data-k="c-msg"></p>
    <div class="gs-row"><button data-k="c-no">${T('Cancelar', 'Cancel')}</button><button class="gs-primary" data-k="c-yes">${T('Confirmar', 'Confirm')}</button></div>
  </div></section>
</div>`;
    this.root = this.q('.gs-root')!;
    this.stage = this.k('stage');
    this.music = o.musicUrl ? new Music(o.musicUrl) : null;
    if (this.music) {
      this.musicCtl = mountMusicControl(this.k('music'), this.music, this.prefs.music, (mp) => {
        this.prefs.music = mp;
        this.savePrefs();
      });
      window.addEventListener('pointerdown', () => this.music?.start(), { capture: true, once: true, signal: this.ac.signal });
    }
    this.bind();
    this.paintSound();
    this.refreshMenu();
    // Modo Torneio: se este é o jogo da vez, pula o menu e começa direto no 2P local com os nomes do torneio
    if (o.modes.local && currentTournamentGame() === routeHere()) {
      const t = getTournament();
      queueMicrotask(() => {
        if (!this.container.isConnected && !this.root.isConnected) return;
        this.tour = true;
        this.startFn?.({ mode: 'local', names: [t.names[0] || T('Vermelho', 'Red'), t.names[1] || T('Azul', 'Blue')], difficulty: this.prefs.difficulty });
        this.toast(`🏆 ${T('Torneio', 'Tournament')} · ${T('jogo', 'game')} ${t.results.length + 1} · ${t.wins[0]} × ${t.wins[1]}`, 2600);
      });
    }
  }

  /** Partida do Modo Torneio em andamento (para os jogos ajustarem textos, se quiserem). */
  get inTournament() {
    return this.tour;
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string) {
    return this.container.querySelector<T>(sel);
  }
  k<T extends HTMLElement = HTMLElement>(key: string): T {
    return this.container.querySelector<T>(`[data-k="${key}"]`)!;
  }

  private bind() {
    window.addEventListener('blur', () => this.pause(), { signal: this.ac.signal });
    const k = (x: string) => this.k(x);
    const sig = { signal: this.ac.signal };
    k('back').addEventListener('click', () => this.o.onExit());
    const n1 = this.container.querySelector<HTMLInputElement>('[data-k="n1"]');
    const n2 = this.container.querySelector<HTMLInputElement>('[data-k="n2"]');
    const nAi = this.container.querySelector<HTMLInputElement>('[data-k="n-ai"]');
    const nSolo = this.container.querySelector<HTMLInputElement>('[data-k="n-solo"]');
    if (n1) n1.value = this.prefs.names[0];
    if (n2) n2.value = this.prefs.names[1];
    if (nAi) nAi.value = this.prefs.names[0];
    if (nSolo) nSolo.value = this.prefs.names[0];
    this.container.querySelectorAll<HTMLButtonElement>('[data-k="diff"] button').forEach((b) =>
      b.addEventListener('click', () => {
        this.prefs.difficulty = b.dataset.d as Difficulty;
        this.savePrefs();
        this.refreshMenu();
      }),
    );
    const start = (cfg: StartConfig) => {
      if (cfg.mode !== 'local') this.tour = false;
      this.sfx.unlock();
      // celular: partida em tela cheia, sem a barra do navegador (mesmo método da sinuca, pedido do Leon 03/11)
      enterGameFullscreen();
      this.hideAll();
      this.inMatch = true;
      this.paused = false;
      this.o.onStart(cfg);
    };
    this.startFn = start;
    this.q('[data-k="play-ai"]')?.addEventListener('click', () => {
      const a = nAi!.value.trim();
      this.prefs.names[0] = a;
      this.savePrefs();
      start({ mode: 'ai', names: [a || T('Você', 'You'), `${T('IA', 'AI')} (${diffLabel(this.prefs.difficulty)})`], difficulty: this.prefs.difficulty });
    });
    this.q('[data-k="play-local"]')?.addEventListener('click', () => {
      this.tour = false;
      const a = n1!.value.trim();
      const b = n2!.value.trim();
      this.prefs.names = [a, b];
      this.savePrefs();
      start({ mode: 'local', names: [a || T('Jogador 1', 'Player 1'), b || T('Jogador 2', 'Player 2')], difficulty: this.prefs.difficulty });
    });
    this.q('[data-k="play-solo"]')?.addEventListener('click', () => {
      const a = nSolo!.value.trim();
      this.prefs.names[0] = a;
      this.savePrefs();
      start({ mode: 'solo', names: [a || T('Você', 'You'), ''], difficulty: this.prefs.difficulty });
    });
    k('menu-help').addEventListener('click', () => this.show('helpbox'));
    if (this.o.shop?.length) {
      mountBalance(k('shop-bal'), this.ac.signal);
      k('menu-shop').addEventListener('click', () => this.openShop());
      k('pause-shop').addEventListener('click', () => this.openShop());
      k('shop-close').addEventListener('click', () => this.hide('shopbox'));
    }
    k('help').addEventListener('click', () => this.show('helpbox'));
    k('help-close').addEventListener('click', () => this.hide('helpbox'));
    k('home').addEventListener('click', () => {
      if (!this.inMatch) return this.toMenu();
      this.confirm(T('Sair da partida e voltar ao menu? O placar desta partida será perdido.', 'Leave the match and go back to the menu? This match score will be lost.'), () => this.toMenu());
    });
    k('pause').addEventListener('click', () => this.pause());
    k('resume').addEventListener('click', () => this.resume());
    k('restart').addEventListener('click', () =>
      this.confirm(T('Reiniciar a partida do zero?', 'Restart the match from scratch?'), () => {
        this.hide('pausebox');
        this.paused = false;
        this.o.onPause(false);
        this.o.onRestart();
      }),
    );
    k('to-menu').addEventListener('click', () => this.confirm(T('Voltar ao menu? A partida atual será perdida.', 'Back to the menu? The current match will be lost.'), () => this.toMenu()));
    k('sound').addEventListener('click', () => {
      this.prefs.sound = !this.prefs.sound;
      this.sfx.enabled = this.prefs.sound;
      this.sfx.unlock();
      this.savePrefs();
      this.paintSound();
    });
    k('r-menu').addEventListener('click', () => this.o.onExit());
    k('r-new').addEventListener('click', () => this.toMenu());
    // "Outro jogo" (comparativo 01/11): vai direto para outro jogo sorteado; o placar da sessão continua
    k('r-next').addEventListener('click', () => {
      if (this.tour) return this.o.onExit();
      const here = location.hash.replace('#', '');
      const list = GAMES.filter((g) => g.status === 'available' && g.route !== here);
      location.hash = '#' + list[Math.floor(Math.random() * list.length)].route;
    });
    k('r-again').addEventListener('click', () => {
      // torneio: vai para o próximo jogo sorteado (ou repete o mesmo se empatou); com campeão, volta ao portal
      if (this.tour) {
        const next = currentTournamentGame();
        if (!next) return this.o.onExit();
        if (next !== routeHere()) {
          location.hash = '#' + next;
          return;
        }
      }
      this.hide('result');
      this.inMatch = true;
      this.resultYes?.();
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && this.inMatch && !this.container.querySelector('.gs-overlay.show')) this.pause();
      },
      sig,
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden && this.inMatch && !this.paused) this.pause();
      },
      sig,
    );
  }

  private refreshMenu() {
    this.container.querySelectorAll<HTMLButtonElement>('[data-k="diff"] button').forEach((b) => {
      const on = b.dataset.d === this.prefs.difficulty;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const diff = this.q('[data-k="diff"]');
    if (diff) {
      let description = this.q('[data-k="diff-description"]');
      if (!description) { description = document.createElement('p'); description.dataset.k = 'diff-description'; description.className = 'gs-note'; diff.after(description); }
      const descriptions: Record<Difficulty, string> = {
        easy: T('Mais tempo para reagir e maior margem de erro da IA.', 'More reaction time and a larger AI error margin.'),
        medium: T('Reação e precisão intermediárias.', 'Intermediate reaction and precision.'),
        hard: T('IA mais precisa, com reação ou planejamento mais forte.', 'More precise AI with stronger reactions or planning.'),
      };
      description.textContent = descriptions[this.prefs.difficulty];
    }
    const note = this.q('[data-k="note"]');
    if (note && this.o.menuNote) note.textContent = this.o.menuNote();
  }

  pause() {
    if (this.externalMatch) return;
    if (!this.inMatch || this.paused) return;
    this.paused = true;
    this.o.onPause(true);
    this.show('pausebox');
  }
  resume() {
    this.paused = false;
    this.hide('pausebox');
    this.o.onPause(false);
  }
  toMenu() {
    this.inMatch = false;
    this.paused = false;
    this.hideAll();
    this.setTurn(null);
    this.refreshMenu();
    this.show('menu');
    this.o.onMenu();
  }

  /** Chamar no início de cada partida (inclusive revanche/reinício). Partida que não chega ao fim nunca é relatada. */
  beginMatch() {
    this.matchId = newMatchId(this.o.id);
  }
  /** A turn-based remote match keeps advancing on the server, never local pause. */
  setExternalMatch(active: boolean) {
    const starting = active && !this.externalMatch;
    this.externalMatch = active;
    this.k('pause').hidden = active;
    this.k('pause').style.display = active ? 'none' : '';
    this.paused = false;
    if (starting || !active) this.inMatch = active;
    if (active) { this.tour = false; if (starting) this.hideAll(); }
  }
  /**
   * Partida CONCLUÍDA: placar de sessão (só 2P local com vencedor) + fichas e desafios. Idempotente: só a 1ª chamada
   * depois de beginMatch conta. winner: 0 = J1, 1 = J2/IA, 'draw', null = solo.
   */
  report(cfg: StartConfig, winner: 0 | 1 | 'draw' | null) {
    if (cfg.mode === 'online') return; // No client-controlled rewards for remote games.
    if (!this.matchId) return;
    const id = this.matchId;
    this.matchId = null;
    const r = reportMatch({ matchId: id, game: this.o.id, mode: cfg.mode, winner, difficulty: cfg.mode === 'ai' ? cfg.difficulty : undefined });
    if (this.tour && cfg.mode === 'local') recordTournament(routeHere(), id, winner);
    if (r.coins > 0) window.setTimeout(() => this.toast(`+${r.coins} ${T('fichas', 'chips')}`, 2000), 400);
  }

  /** Fim de partida: título, mensagem e o que fazer na revanche. */
  showResult(title: string, msg: string, again: () => void) {
    this.inMatch = false;
    this.k('r-title').textContent = title;
    this.k('r-msg').textContent = msg;
    const againBtn = this.k<HTMLButtonElement>('r-again');
    againBtn.disabled = false;
    const next = this.k('r-next');
    const menu = this.k('r-menu');
    this.k('r-new').style.display = this.tour ? 'none' : '';
    if (this.tour) {
      const t = getTournament();
      const champ = t.champion;
      const nm = (p: 0 | 1) => t.names[p] || (p === 0 ? T('Vermelho', 'Red') : T('Azul', 'Blue'));
      this.k('r-msg').textContent = `${msg}\n🏆 ${T('Torneio', 'Tournament')}: ${nm(0)} ${t.wins[0]} × ${t.wins[1]} ${nm(1)}${champ !== null ? ` · ${nm(champ)} ${T('é campeão!', 'is the champion!')}` : ` · ${T('vence quem fizer', 'first to')} ${TOURNAMENT_WINS}`}`;
      this.k('r-msg').style.whiteSpace = 'pre-line';
      const repeat = currentTournamentGame() === routeHere();
      againBtn.textContent = champ !== null ? T('Ver campeão', 'See champion') : repeat ? T('Jogar de novo (empate)', 'Replay (draw)') : `${T('Próximo jogo', 'Next game')} ▶`;
      next.style.display = 'none';
      menu.textContent = T('Portal', 'Home');
    } else {
      againBtn.textContent = T('Revanche', 'Rematch');
      next.style.display = '';
      menu.textContent = 'Menu';
    }
    this.resultYes = again;
    this.refreshMenu();
    this.show('result');
  }

  setSubtitle(s: string) {
    this.k('sub').textContent = s;
  }
  setScore(html: string) {
    this.k('score').innerHTML = html;
  }
  setTurn(player: number | null) {
    setTurnColor(this.root, player);
  }

  /** Pílula de placar padrão (cor do jogador, nome, valor). */
  static pill(player: number, name: string, value: string | number, on: boolean) {
    const esc = name.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    return `<div class="gs-pill${on ? ' on' : ''}" style="--c:${PLAYER_COLORS[player]}"><i></i><span class="gs-name">${esc}</span><b>${value}</b></div>`;
  }

  toast(msg: string, ms = 2400) {
    // pode ser chamado por um timer depois de sair do jogo (ex.: "+5 fichas" 400 ms após o fim): ignora
    const t = this.container.querySelector<HTMLElement>('[data-k="toast"]');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  }

  confirm(msg: string, yes: () => void) {
    const wasPaused = this.paused;
    if (this.inMatch && !wasPaused) {
      this.paused = true;
      this.o.onPause(true);
    }
    this.k('c-msg').textContent = msg;
    this.show('confirm');
    const y = this.k('c-yes');
    const n = this.k('c-no');
    const done = () => {
      this.hide('confirm');
      y.onclick = null;
      n.onclick = null;
    };
    y.onclick = () => {
      done();
      if (!wasPaused && this.inMatch) { this.paused = false; this.o.onPause(false); }
      yes();
    };
    n.onclick = () => {
      done();
      if (!wasPaused && this.inMatch) {
        // A hidden document stays paused until explicitly resumed.
        if (document.hidden) { this.show('pausebox'); return; }
        this.paused = false;
        this.o.onPause(false);
      }
    };
  }

  show(key: string) {
    this.k(key).classList.add('show');
  }
  hide(key: string) {
    this.k(key).classList.remove('show');
  }
  hideAll() {
    this.container.querySelectorAll('.gs-overlay').forEach((o) => o.classList.remove('show'));
  }
  private shopTab = 0;
  /** Abre a loja do jogo na aba atual (do menu ou da pausa; a pausa continua aberta por baixo). */
  openShop() {
    this.renderShop();
    this.show('shopbox');
  }
  private renderShop() {
    const secs = this.o.shop ?? [];
    const tabs = this.k('shop-tabs');
    tabs.innerHTML = secs.length > 1 ? secs.map((x, i) => `<button role="tab" data-i="${i}" class="${i === this.shopTab ? 'on' : ''}" aria-selected="${i === this.shopTab}">${T(x.tabPt, x.tabEn)}</button>`).join('') : '';
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { this.shopTab = Number(b.dataset.i); this.renderShop(); }));
    const sec = secs[this.shopTab];
    if (!sec) return;
    const cur = equipped(sec.slot, sec.items).key;
    const box = this.k('shop-items');
    box.innerHTML = '';
    for (const item of sec.items) {
      const cat = itemByKey(item.key);
      const on = item.key === cur;
      const card = document.createElement('div');
      card.className = `gs-item${on ? ' on' : ''}`;
      card.dataset.item = item.key;
      const cv = document.createElement('canvas');
      cv.width = 192;
      cv.height = 108;
      const unlocked = isUnlocked(item.key);
      const tagCls = cat?.tier === 'premium' ? 'prem' : unlocked && cat?.tier === 'coins' ? 'own' : '';
      card.innerHTML = `<b>${T(cat?.name ?? item.en, item.en)}</b><span class="gs-tag ${tagCls}">${on ? T('✓ Em uso', '✓ Equipped') + ' · ' : ''}${tierTag(item.key)}</span><span class="gs-tag">${T(item.descPt, item.descEn)}</span>`;
      card.prepend(cv);
      const btn = document.createElement('button');
      if (on) {
        btn.textContent = T('Em uso', 'Equipped');
        btn.disabled = true;
      } else if (unlocked) {
        btn.className = 'gs-primary';
        btn.textContent = T('Usar', 'Use');
        btn.addEventListener('click', () => this.useItem(sec, item.key));
      } else {
        wireLocked(btn, item.key, () => this.useItem(sec, item.key));
      }
      card.appendChild(btn);
      box.appendChild(card);
      const ctx = cv.getContext('2d');
      if (ctx) sec.preview(ctx, cv.width, cv.height, item);
    }
  }
  private useItem(sec: ShopSection, key: string) {
    if (equip(sec.slot, key)) {
      this.sfx.tone(880, 0.06, 0.12);
      sec.onChange();
    }
    this.renderShop();
  }

  overlayOpen(): boolean {
    return !!this.container.querySelector('.gs-overlay.show');
  }

  private paintSound() {
    const b = this.k('sound');
    b.innerHTML = this.prefs.sound ? ICONS.soundOn : ICONS.soundOff;
    b.setAttribute('aria-pressed', String(this.prefs.sound));
  }

  private loadPrefs(): ShellPrefs {
    const def: ShellPrefs = { sound: true, music: { enabled: true, volume: 0.4 }, names: ['', ''], difficulty: 'medium' };
    try {
      const raw = localStorage.getItem(`jogaco.${this.o.id}.prefs`);
      if (!raw) return def;
      const p = JSON.parse(raw) as Partial<ShellPrefs>;
      return {
        sound: typeof p.sound === 'boolean' ? p.sound : def.sound,
        music: p.music && typeof p.music.enabled === 'boolean' && typeof p.music.volume === 'number' && Number.isFinite(p.music.volume) && p.music.volume >= 0 && p.music.volume <= 1 ? p.music : def.music,
        names: Array.isArray(p.names) && p.names.length === 2 && p.names.every((n) => typeof n === 'string') ? (p.names as [string, string]) : def.names,
        difficulty: p.difficulty && p.difficulty in DIFF_LABEL ? p.difficulty : def.difficulty,
      };
    } catch {
      return def;
    }
  }
  private savePrefs() {
    try {
      localStorage.setItem(`jogaco.${this.o.id}.prefs`, JSON.stringify(this.prefs));
    } catch {
      /* sem armazenamento */
    }
  }

  dispose() {
    exitGameFullscreen();
    this.ac.abort();
    clearTimeout(this.toastTimer);
    this.music?.dispose();
    this.musicCtl?.destroy();
    this.sfx.dispose();
    this.container.innerHTML = '';
    this.style?.remove();
  }
}
