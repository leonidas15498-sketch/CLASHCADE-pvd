import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { chooseC4 } from './ai';
import { C4State, canPlay, COLS, createC4, height, play, ROWS } from './logic';
import { availableRooms } from '../../services/online/supabaseRooms';
import { Connect4Room } from '../../services/online/types';
import { Connect4Online, roomBoard } from './online';

const HELP_PT = `<ul>
<li><b>Objetivo:</b> alinhar <b>4 peças</b> da sua cor na horizontal, vertical ou diagonal.</li>
<li><b>Jogar:</b> toque numa coluna; a peça cai até o espaço livre mais baixo.</li>
<li>Os jogadores alternam. Na revanche, quem começa troca.</li>
<li>Grade cheia sem ninguém alinhar 4 = empate.</li>
<li><b>Teclado:</b> ← → escolhem a coluna, espaço ou ↓ solta (ou as teclas 1 a 7).</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> line up <b>4 pieces</b> of your color horizontally, vertically or diagonally.</li>
<li><b>Play:</b> tap a column; the piece drops to the lowest free spot.</li>
<li>Players take turns. On a rematch, the starting player switches.</li>
<li>Full board with no line of 4 = draw.</li>
<li><b>Keyboard:</b> ← → choose the column, space or ↓ drops (or keys 1 to 7).</li>
</ul>`;

interface Falling {
  c: number;
  r: number;
  p: 0 | 1;
  y: number;
  v: number;
  bounced: boolean;
}

class Connect4Game {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cfg: StartConfig | null = null;
  private s: C4State | null = null;
  private wins: [number, number] = [0, 0];
  private first: 0 | 1 = 1;
  private raf = 0;
  private last = 0;
  private cell = 40;
  private ox = 0;
  private oy = 0;
  private dpr = 1;
  private disposed = false;
  private hover = 3;
  private falling: Falling | null = null;
  private thinking = false;
  private aiTimer = 0;
  private fx = new ParticleSystem();
  private ac = new AbortController();
  private t = 0;
  private resultShown = false;
  private online: Connect4Online | null = null;
  private remoteResult = '';

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'connect4',
      title: T('Quatro em Linha', 'Four in a Row'),
      subtitle: T('Alinhe 4 da sua cor', 'Line up 4 of your color'),
      modes: { ai: true, local: true },
      localNote: T('Um de cada vez, no mesmo aparelho.', 'Take turns on the same device.'),
      // "Calculated Gambit" (Leon, Gemini): 104 BPM, 65 compassos (150 s), -14 LUFS.
      musicUrl: './music/calculated-gambit.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      onExit,
      onStart: (cfg) => {
        this.wins = [0, 0];
        this.first = 1;
        this.start(cfg);
      },
      onPause: (p) => {
        clearTimeout(this.aiTimer);
        this.thinking = false;
        if (!p) { this.last = performance.now(); if (!this.falling) this.maybeAI(); }
      },
      onRestart: () => this.cfg && this.start(this.cfg, true),
      onMenu: () => {
        if (this.online?.active) {
          const online = this.online; this.online = null;
          void online.leave().catch(() => this.shell.toast(T('Não foi possível confirmar a saída no servidor.', 'Could not confirm leaving on the server.'))).finally(() => online.dispose());
          this.shell.setExternalMatch(false);
          this.remoteResult = '';
          void this.setupOnline();
        }
        clearTimeout(this.aiTimer);
        this.s = null;
        this.paintHud();
      },
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Grade do Quatro em Linha', 'Four in a Row grid'));
    this.cv.style.touchAction = 'none';
    this.shell.stage.prepend(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    this.bindInput();
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.layout();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    void this.setupOnline();
  }

  private async setupOnline() {
    this.shell.root.querySelector('[data-online-card]')?.remove();
    const network = await availableRooms();
    if (!network) return;
    if (this.disposed) { network.dispose(); return; }
    this.online?.dispose();
    this.online = new Connect4Online(this.shell.root, network, room => this.remoteState(room), () => {
      this.online?.dispose(); this.online = null; this.remoteResult = '';
      this.shell.setExternalMatch(false); this.shell.toMenu(); void this.setupOnline();
    });
    const card = document.createElement('div'); card.className = 'gs-card'; card.dataset.onlineCard = '';
    const heading = document.createElement('h2'); heading.textContent = T('Online privado', 'Private online');
    const button = document.createElement('button'); button.className = 'gs-primary';
    button.textContent = T('Criar ou entrar em sala', 'Create or join room');
    button.addEventListener('click', () => this.online?.open(), { signal: this.ac.signal });
    card.append(heading, button); this.shell.root.querySelector('.gs-modes')?.append(card);
  }

  private remoteState(room: Connect4Room) {
    if (this.disposed) return;
    this.shell.setExternalMatch(true);
    this.cfg = { mode: 'online', names: [room.host_name, room.guest_name || T('Aguardando J2', 'Waiting for P2')], difficulty: 'medium' };
    this.s = roomBoard(room); this.wins = [...room.scores]; this.falling = null; this.thinking = false;
    clearTimeout(this.aiTimer); this.paintHud();
    if (room.status === 'waiting') this.shell.setSubtitle(T('Aguardando segundo jogador', 'Waiting for second player'));
    if (room.status === 'playing') {
      if (this.remoteResult) this.shell.hide('result');
      this.shell.inMatch = true; this.shell.setTurn(room.turn); this.remoteResult = ''; return;
    }
    this.shell.setTurn(null);
    if (room.status === 'finished' || room.status === 'closed') {
      const key = `${room.id}:${room.round}:${room.status}`;
      if (this.remoteResult === key) return;
      this.remoteResult = key;
      const title = room.status === 'closed' ? T('Sala encerrada', 'Room closed') : room.winner === 'draw' ? T('Empate!', 'Draw!') : `${this.cfg.names[Number(room.winner)]} ${T('venceu!', 'wins!')}`;
      this.shell.showResult(title, `${this.cfg.names[0]} ${room.scores[0]} × ${room.scores[1]} ${this.cfg.names[1]}`, () => {
        if (room.status === 'closed') { this.shell.toMenu(); return; }
        void this.online?.rematch().catch(e => this.shell.toast(e instanceof Error ? e.message : String(e)));
      });
    }
  }

  dispose() {
    this.disposed = true;
    this.online?.dispose();
    clearTimeout(this.aiTimer);
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  private start(cfg: StartConfig, sameFirst = false) {
    this.shell.beginMatch();
    clearTimeout(this.aiTimer);
    this.cfg = cfg;
    if (!sameFirst) this.first = (1 - this.first) as 0 | 1;
    this.s = createC4(this.first);
    this.falling = null;
    this.thinking = false;
    this.resultShown = false;
    this.fx.clear();
    this.hover = 3;
    this.shell.setTurn(this.s.current);
    this.paintHud();
    const n = cfg.names;
    this.shell.toast(`${n[this.s.current]} ${T('começa.', 'goes first.')}`, 1600);
    this.maybeAI();
  }

  private aiTurn() {
    return this.cfg?.mode === 'ai' && this.s?.current === 1 && this.s.winner === null;
  }

  private paintHud() {
    const s = this.s;
    if (!s) return this.shell.setScore('');
    const n = this.cfg!.names;
    const on = (p: 0 | 1) => s.winner === null && s.current === p;
    this.shell.setScore(Shell.pill(0, n[0], this.wins[0], on(0)) + Shell.pill(1, n[1], this.wins[1], on(1)));
    this.shell.setSubtitle(s.winner === null ? `${T('Vez de', 'Turn:')} ${n[s.current]}` : T('Fim da partida', 'Match over'));
  }

  private drop(c: number) {
    if (this.online?.active) { void this.online.move(c); return; }
    const s = this.s;
    if (!s || this.falling || this.shell.paused || !canPlay(s, c)) return;
    const p = s.current;
    const r = height(s, c);
    this.falling = { c, r, p, y: -1, v: 0, bounced: false };
    this.shell.sfx.tone(520, 0.05, 0.1, 'triangle', 0.8);
  }

  /** A peça terminou de cair: aplica a jogada nas regras. */
  private land(f: Falling) {
    const s = this.s!;
    play(s, f.c);
    this.falling = null;
    this.shell.sfx.noise(1200, 0.06, 0.35, 3);
    this.shell.sfx.tone(180, 0.08, 0.2, 'sine', 0.7);
    if (s.winner !== null) return this.finish();
    this.shell.setTurn(s.current);
    this.paintHud();
    this.maybeAI();
  }

  private maybeAI() {
    if (!this.aiTurn()) return;
    this.thinking = true;
    // deixa a tela mostrar "pensando" antes da busca (a busca do Difícil leva até ~0,3 s)
    this.aiTimer = window.setTimeout(() => {
      if (this.disposed || !this.s || !this.aiTurn()) return;
      const c = chooseC4(this.s, this.cfg!.difficulty);
      this.thinking = false;
      this.hover = c;
      this.aiTimer = window.setTimeout(() => this.drop(c), 150);
    }, 300);
  }

  private finish() {
    const s = this.s!;
    this.shell.report(this.cfg!, s.winner as 0 | 1 | 'draw');
    const n = this.cfg!.names;
    this.paintHud();
    if (s.winner === 'draw') {
      this.shell.setTurn(null);
      this.shell.toast(T('Grade cheia: empate!', 'Board full: draw!'));
    } else {
      const w = s.winner as 0 | 1;
      this.wins[w]++;
      this.paintHud();
      this.shell.setTurn(w);
      for (const [c, r] of s.line) {
        const { x, y } = this.cellXY(c, r);
        this.fx.burst('confete', x, y, this.cell * 0.18);
      }
      if (this.cfg!.mode === 'ai' && w === 1) this.shell.sfx.lose();
      else this.shell.sfx.win();
    }
    const ai = this.cfg!.mode === 'ai';
    const w = s.winner;
    setTimeout(() => {
      if (this.disposed || this.s !== s || this.resultShown) return;
      this.resultShown = true;
      const title = w === 'draw' ? T('Empate!', 'Draw!') : ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w as 0 | 1]} ${T('venceu!', 'wins!')}`;
      this.shell.showResult(title, `${T('Placar da sessão', 'Session score')}: ${n[0]} ${this.wins[0]} × ${this.wins[1]} ${n[1]}`, () => this.start(this.cfg!));
    }, 1500);
  }

  // ------------------------------------------------------------ entrada
  private colAt(clientX: number): number {
    const r = this.cv.getBoundingClientRect();
    return Math.max(0, Math.min(COLS - 1, Math.floor((clientX - r.left - this.ox) / this.cell)));
  }

  private humanCanPlay() {
    return !!this.s && this.s.winner === null && !this.aiTurn() && !this.falling && !this.shell.paused;
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    const cv = this.cv;
    cv.addEventListener('pointermove', (e) => {
      if (this.humanCanPlay()) this.hover = this.colAt(e.clientX);
    });
    cv.addEventListener('pointerdown', (e) => {
      this.shell.sfx.unlock();
      if (this.humanCanPlay()) this.hover = this.colAt(e.clientX);
    });
    cv.addEventListener('pointerup', (e) => {
      if (!this.humanCanPlay()) return;
      const c = this.colAt(e.clientX);
      this.hover = c;
      this.drop(c);
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.humanCanPlay()) return;
        const k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') this.hover = Math.max(0, this.hover - 1);
        else if (k === 'arrowright' || k === 'd') this.hover = Math.min(COLS - 1, this.hover + 1);
        else if (k === ' ' || k === 'enter' || k === 'arrowdown' || k === 's') this.drop(this.hover);
        else if (/^[1-7]$/.test(k)) {
          this.hover = Number(k) - 1;
          this.drop(this.hover);
        } else return;
        e.preventDefault();
      },
      sig,
    );
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    if (!this.shell.paused) {
      this.t += dt;
      this.fx.update(dt);
      const f = this.falling;
      if (f) {
        // queda com gravidade (em linhas) e um quique pequeno
        const target = ROWS - 1 - f.r;
        f.v += 60 * dt;
        f.y += f.v * dt;
        if (f.y >= target) {
          if (!f.bounced && f.v > 6) {
            f.y = target;
            f.v = -f.v * 0.22;
            f.bounced = true;
          } else this.land(f);
        }
      }
    }
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // -------------------------------------------------------------- desenho
  private layout() {
    const st = this.shell.stage;
    const W = st.clientWidth - 12;
    const H = st.clientHeight - 10;
    // 7 colunas; altura = 6 linhas + 1 linha de mira em cima
    const cell = Math.max(16, Math.floor(Math.min(W / (COLS + 0.4), H / (ROWS + 1.3))));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = Math.floor(cell * (COLS + 0.4));
    const ch = Math.floor(cell * (ROWS + 1.3));
    this.cv.style.width = `${cw}px`;
    this.cv.style.height = `${ch}px`;
    this.cv.width = Math.floor(cw * this.dpr);
    this.cv.height = Math.floor(ch * this.dpr);
    this.cell = cell;
    this.ox = cell * 0.2;
    this.oy = cell * 1.1;
  }

  /** Centro da casa (c, r) em pixels CSS do canvas (r = 0 embaixo). */
  private cellXY(c: number, r: number) {
    return { x: this.ox + (c + 0.5) * this.cell, y: this.oy + (ROWS - 1 - r + 0.5) * this.cell };
  }

  private disc(x: number, y: number, p: 0 | 1, alpha = 1) {
    const ctx = this.ctx;
    const R = this.cell * 0.4;
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    const base = PLAYER_COLORS[p];
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, base);
    g.addColorStop(1, p === 0 ? '#b23d24' : '#1f4fa6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = R * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, R * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private draw() {
    const ctx = this.ctx;
    const u = this.cell;
    const W = this.cv.width / this.dpr;
    const H = this.cv.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = this.s;
    // peças já jogadas (atrás da grade)
    if (s) {
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS; r++) {
          const v = s.cells[c][r];
          if (!v) continue;
          const { x, y } = this.cellXY(c, r);
          this.disc(x, y, (v - 1) as 0 | 1);
        }
      const f = this.falling;
      if (f) {
        const x = this.ox + (f.c + 0.5) * u;
        this.disc(x, this.oy + (f.y + 0.5) * u, f.p);
      }
    }
    // grade com furos
    const bx = this.ox - u * 0.12;
    const by = this.oy - u * 0.12;
    const bw = COLS * u + u * 0.24;
    const bh = ROWS * u + u * 0.24;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, u * 0.3);
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) {
        const { x, y } = this.cellXY(c, r);
        ctx.moveTo(x + u * 0.42, y);
        ctx.arc(x, y, u * 0.42, 0, Math.PI * 2);
      }
    const gb = ctx.createLinearGradient(0, by, 0, by + bh);
    gb.addColorStop(0, '#4a3f99');
    gb.addColorStop(1, '#2b2366');
    ctx.fillStyle = gb;
    ctx.fill('evenodd');
    ctx.restore();
    // pés da grade
    ctx.fillStyle = '#221b52';
    ctx.fillRect(bx - u * 0.1, by + bh - u * 0.05, u * 0.5, u * 0.15);
    ctx.fillRect(bx + bw - u * 0.4, by + bh - u * 0.05, u * 0.5, u * 0.15);
    if (s) {
      // peça na mira (em cima da coluna)
      if (s.winner === null && !this.falling) {
        const x = this.ox + (this.hover + 0.5) * u;
        const bob = Math.sin(this.t * 5) * u * 0.05;
        this.disc(x, this.oy - u * 0.62 + bob, s.current, this.thinking ? 0.5 : 0.95);
        if (!this.aiTurn() && canPlay(s, this.hover)) {
          // onde vai cair
          const { y } = this.cellXY(this.hover, height(s, this.hover));
          ctx.strokeStyle = PLAYER_COLORS[s.current];
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(x, y, u * 0.36, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }
      // linha vencedora
      if (s.line.length) {
        const pulse = 0.6 + 0.4 * Math.sin(this.t * 7);
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
        ctx.lineWidth = u * 0.1;
        for (const [c, r] of s.line) {
          const { x, y } = this.cellXY(c, r);
          ctx.beginPath();
          ctx.arc(x, y, u * 0.44, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      this.fx.draw(ctx);
      if (this.thinking) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `700 ${Math.round(u * 0.32)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(T('IA pensando', 'AI thinking') + '.'.repeat(1 + (Math.floor(this.t * 3) % 3)), W / 2, 2);
      }
    }
  }

  /** Para testes no navegador. */
  debug() {
    const s = this.s;
    return s ? { current: s.current, winner: s.winner, moves: [...s.moves], hover: this.hover, falling: !!this.falling, thinking: this.thinking, wins: this.wins } : null;
  }
}

const connect4: GameModule = {
  mount(container, { onExit }) {
    const g = new Connect4Game(container, onExit);
    (window as unknown as { __connect4?: Connect4Game }).__connect4 = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __connect4?: Connect4Game }).__connect4;
      },
    };
  },
};
export default connect4;
