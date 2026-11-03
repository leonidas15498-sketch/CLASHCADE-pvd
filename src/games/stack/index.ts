import { onMountRollback } from '../shared/lifecycle';
import { T } from '../../i18n/lang';
import { ParticleSystem } from '../shared/fx';
import { PLAYER_COLORS } from '../shared/players';
import { Shell, StartConfig } from '../shared/shell';
import type { GameModule } from '../shared/types';
import { Drop, planStackDrop } from './ai';
import { AIM_LIMIT, DT, landingY, PLATFORM, StackMatch, VIEW_W } from './logic';
import { pieceById } from './pieces';

const HELP_PT = `<ul>
<li><b>Objetivo:</b> cada jogador, na sua vez, coloca uma peça na pilha. <b>Quem derrubar alguma peça da mesa perde.</b></li>
<li><b>Posicionar:</b> arraste o dedo para os lados (em qualquer lugar da tela). Pode ajustar quanto quiser: tirar o dedo <b>não</b> solta.</li>
<li><b>Soltar:</b> botão <b>SOLTAR</b>. A linha tracejada mostra só o começo da queda: calcular onde a peça vai parar é com você.</li>
<li><b>Girar:</b> toque rápido na tela (sem arrastar) gira 45°.</li>
<li>Depois de soltar, espere a pilha parar de balançar: só aí passa a vez. Se algo cair nesse tempo, conta para quem jogou.</li>
<li><b>Sozinho:</b> empilhe o máximo de peças que conseguir.</li>
<li><b>Teclado:</b> ← → (ou A D) movem, Shift + ← → move fino, ↑ (ou W) gira, espaço ou Enter soltam.</li>
</ul>`;
const HELP_EN = `<ul>
<li><b>Goal:</b> on your turn, add one piece to the tower. <b>Whoever knocks any piece off the table loses.</b></li>
<li><b>Position:</b> drag your finger sideways (anywhere on the screen). Adjust as much as you like: lifting your finger does <b>not</b> drop it.</li>
<li><b>Drop:</b> press <b>DROP</b>. The dashed line only shows the start of the fall: judging where the piece will land is up to you.</li>
<li><b>Rotate:</b> quick tap on the screen (no drag) turns it 45°.</li>
<li>After dropping, wait for the tower to stop wobbling: only then does the turn pass. If something falls meanwhile, it counts against whoever just played.</li>
<li><b>Solo:</b> stack as many pieces as you can.</li>
<li><b>Keyboard:</b> ← → (or A D) move, Shift + ← → fine move, ↑ (or W) rotates, space or Enter drop.</li>
</ul>`;

const BEST_KEY = 'jogaco.stack.best';
const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

class StackGame {
  private shell: Shell;
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rotBtn: HTMLButtonElement;
  private dropBtn: HTMLButtonElement;
  private cfg: StartConfig | null = null;
  private m: StackMatch | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  scale = 60;
  private dpr = 1;
  private camY = -1;
  private bgLayer: HTMLCanvasElement | null = null;
  private bgKey = '';
  /** Faixa livre embaixo para os botões (celular em pé), em px de tela. */
  private floorPx = 0;
  private camTop = 0;
  private disposed = false;
  private fx = new ParticleSystem();
  private ac = new AbortController();
  private aimX = 0;
  private aimA = 0;
  private drag: { id: number; x0: number; aim0: number; moved: boolean } | null = null;
  private plan: Generator<void, Drop, void> | null = null;
  private planned: Drop | null = null;
  private aiT = 0;
  private overT = 0;
  private best = loadBest();
  private t = 0;
  /** Impacto mais forte do passo (impulso normal do planck) e onde foi; tratado no quadro (som, partículas, tremor). */
  private hit: { imp: number; x: number; y: number } | null = null;
  private hitCool = 0;
  /** Tremor de tela: amplitude (px) e tempo restante (s). */
  private shakeAmp = 0;
  private shakeT = 0;
  /** Zoom da câmera (1 = normal); diminui aos poucos com a altura para a base nunca sair da tela. */
  private zoom = 1;
  private banner: HTMLDivElement;
  private bannerKey = '';
  /** Contagem de impactos (QA). */
  hits = { n: 0, shakes: 0, maxShake: 0 };

  constructor(container: HTMLElement, onExit: () => void) {
    onMountRollback(() => this.dispose());
    this.shell = new Shell(container, {
      id: 'stack',
      title: T('Torre de Bichinhos', 'Critter Stack'),
      subtitle: T('Quem derrubar a pilha perde', 'Topple the tower and you lose'),
      modes: { solo: T('Empilhar sozinho', 'Stack solo'), ai: true, local: true },
      localNote: T('Um de cada vez: passe o aparelho a cada peça.', 'Take turns: pass the device after each piece.'),
      // "Sunny Stacks" (Leon, Gemini): 120 BPM, intro de 4 s cortada, 83 compassos (166 s), -14 LUFS.
      musicUrl: './music/sunny-stacks.mp3',
      helpHtml: T(HELP_PT, HELP_EN),
      onExit,
      onStart: (cfg) => this.start(cfg),
      onPause: (p) => {
        this.drag = null;
        if (!p) this.last = performance.now();
      },
      onRestart: () => this.cfg && this.start(this.cfg),
      onMenu: () => {
        this.m = null;
        this.paintHud();
      },
      menuNote: () => (this.best ? `${T('Seu recorde sozinho', 'Your solo record')}: ${plural(this.best)}` : T('Sem recorde ainda.', 'No record yet.')),
    });
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-label', T('Pilha de peças', 'Piece tower'));
    this.cv.style.touchAction = 'none';
    this.cv.style.borderRadius = '16px';
    this.shell.stage.prepend(this.cv);
    this.rotBtn = document.createElement('button');
    this.rotBtn.className = 'gs-icon';
    this.rotBtn.setAttribute('aria-label', T('Girar peça', 'Rotate piece'));
    this.rotBtn.title = T('Girar (↑)', 'Rotate (↑)');
    this.rotBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>';
    Object.assign(this.rotBtn.style, { position: 'absolute', right: '18px', bottom: '18px', zIndex: '3', width: '58px', height: '58px' });
    // botão ⟳ aposentado (toque na tela gira); fica criado e escondido para não mexer no resto da lógica
    this.rotBtn.style.display = 'none';
    this.shell.stage.appendChild(this.rotBtn);
    // botão SOLTAR (pedido do Leon, 01/11): posicionar com calma e só então largar
    this.dropBtn = document.createElement('button');
    this.dropBtn.type = 'button';
    this.dropBtn.textContent = T('SOLTAR ⬇', 'DROP ⬇');
    this.dropBtn.setAttribute('aria-label', T('Soltar a peça', 'Drop the piece'));
    this.dropBtn.dataset.k = 'drop';
    Object.assign(this.dropBtn.style, {
      position: 'absolute', left: '18px', bottom: '18px', zIndex: '3', minWidth: '140px', minHeight: '54px',
      padding: '0 26px', borderRadius: '999px', border: '1px solid #ffe7a6', fontWeight: '900', fontSize: '18px', letterSpacing: '.08em',
      color: '#2a1600', background: 'linear-gradient(#ffd877,#ffb52e 55%,#e0901a)', boxShadow: '0 4px 0 #9c5d08, 0 0 18px rgba(255,194,74,.4)',
    });
    this.shell.stage.appendChild(this.dropBtn);
    // faixa "vez de ..." (01/11): sempre visível no 2P/IA, na cor de quem joga; pulsa quando a vez muda
    this.banner = document.createElement('div');
    this.banner.dataset.k = 'turn-banner';
    this.banner.setAttribute('role', 'status');
    Object.assign(this.banner.style, {
      position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: '3', pointerEvents: 'none',
      padding: '7px 18px', borderRadius: '999px', fontWeight: '900', fontSize: '15px', letterSpacing: '.04em', color: '#fff',
      whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.35)', display: 'none',
      textShadow: '0 1px 2px rgba(0,0,0,.35)',
    });
    this.shell.stage.appendChild(this.banner);
    this.ctx = this.cv.getContext('2d')!;
    this.bindInput();
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.layout();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    this.shell?.dispose();
  }

  // ----------------------------------------------------------- partida
  private start(cfg: StartConfig) {
    this.shell.beginMatch();
    this.cfg = cfg;
    this.m = new StackMatch(cfg.mode === 'solo' ? 1 : 2);
    // impactos: o impulso normal do passo (post-solve) diz a força real da batida; peças paradas geram ~0,13
    this.m.sw.world.on('post-solve', (contact, impulse) => {
      const imp = Math.max(...impulse.normalImpulses.slice(0, contact.getManifold().pointCount), 0);
      if (imp < IMPACT_MIN || (this.hit && this.hit.imp >= imp)) return;
      const wm = contact.getWorldManifold(null);
      const pt = wm?.points[0];
      if (pt) this.hit = { imp, x: pt.x, y: pt.y };
    });
    this.zoom = 1;
    this.shakeT = 0;
    this.hitCool = 0;
    this.hit = null;
    this.bannerKey = '';
    this.aimX = 0;
    this.aimA = 0;
    this.camY = -1.2;
    this.camTop = 0;
    this.plan = null;
    this.planned = null;
    this.overT = 0;
    this.fx.clear();
    this.shell.setTurn(cfg.mode === 'solo' ? null : 0);
    this.paintHud();
    this.shell.toast(T('Arraste ou toque para posicionar. Depois aperte SOLTAR.', 'Drag or tap to position. Then press DROP.'), 3000);
  }

  private aiTurn(): boolean {
    return !!this.m && this.cfg?.mode === 'ai' && this.m.current === 1;
  }

  private paintHud() {
    const m = this.m;
    if (!m) return this.shell.setScore('');
    const n = this.cfg!.names;
    if (this.cfg!.mode === 'solo') {
      this.shell.setScore(Shell.pill(0, n[0], plural(m.placed), true));
      this.shell.setSubtitle(this.best ? `${T('Recorde', 'Record')}: ${plural(this.best)}` : T('Empilhe o máximo que puder', 'Stack as many as you can'));
      return;
    }
    this.shell.setScore(Shell.pill(0, n[0], '', m.current === 0 && m.phase !== 'over') + Shell.pill(1, n[1], '', m.current === 1 && m.phase !== 'over'));
    this.shell.setSubtitle(m.phase === 'over' ? T('Fim de jogo', 'Game over') : `${plural(m.placed)} ${T('na pilha · vez de', 'stacked · turn:')} ${n[m.current]}`);
  }

  private doDrop() {
    const m = this.m;
    if (!m || m.phase !== 'aim' || this.shell.paused) return;
    m.drop(this.aimX, this.aimA);
    this.shell.sfx.tone(420, 0.08, 0.15, 'triangle', 0.6);
    this.paintHud();
  }

  private afterTurn(r: 'fell' | 'next') {
    const m = this.m!;
    const n = this.cfg!.names;
    if (r === 'next') {
      this.aimA = 0;
      this.plan = null;
      this.planned = null;
      if (this.cfg!.mode !== 'solo') this.shell.setTurn(m.current);
      this.shell.sfx.tone(660, 0.07, 0.12, 'sine', 1.3);
      this.paintHud();
      void n;
      return;
    }
    // caiu
    const f = m.fallenAt!;
    this.fx.burst('confete', f.x, Math.max(-0.5, f.y), 0.5);
    this.shell.sfx.noise(260, 0.5, 0.5, 1);
    this.shell.sfx.tone(220, 0.5, 0.25, 'sawtooth', 0.4);
    this.overT = 0;
    const solo = this.cfg!.mode === 'solo';
    if (solo) {
      this.shell.report(this.cfg!, null);
      const rec = m.placed > this.best;
      if (rec) {
        this.best = m.placed;
        try {
          localStorage.setItem(BEST_KEY, String(this.best));
        } catch {
          /* sem armazenamento */
        }
      }
      setTimeout(() => {
        if (this.disposed || this.m !== m) return;
        this.shell.showResult(rec ? T('Novo recorde!', 'New record!') : T('A pilha caiu!', 'The tower fell!'), `${plural(m.placed)} ${T('na pilha', 'stacked')}${rec ? '' : ` · ${T('recorde', 'record')}: ${plural(this.best)}`}`, () => this.start(this.cfg!));
      }, 1400);
    } else {
      const w = (1 - m.loser!) as 0 | 1;
      this.shell.setTurn(w);
      const ai = this.cfg!.mode === 'ai';
      this.shell.report(this.cfg!, w);
      if (ai && w === 1) this.shell.sfx.lose();
      else this.shell.sfx.win();
      setTimeout(() => {
        if (this.disposed || this.m !== m) return;
        this.shell.showResult(ai ? (w === 0 ? T('Vitória!', 'Victory!') : T('Derrota', 'Defeat')) : `${n[w]} ${T('venceu!', 'wins!')}`, `${n[m.loser!]} ${T('derrubou a pilha. Peças que ficaram de pé', 'toppled the tower. Pieces left standing')}: ${m.placed}.`, () => this.start(this.cfg!));
      }, 1400);
    }
    this.paintHud();
  }

  // ------------------------------------------------------------ entrada
  private canAim() {
    return !!this.m && this.m.phase === 'aim' && !this.aiTurn() && !this.shell.paused;
  }

  private bindInput() {
    const sig = { signal: this.ac.signal };
    const area = this.shell.stage;
    area.addEventListener(
      'pointerdown',
      (e) => {
        this.shell.sfx.unlock();
        if (e.target === this.rotBtn || this.rotBtn.contains(e.target as Node) || e.target === this.dropBtn) return;
        if (!this.canAim() || this.drag) return;
        this.drag = { id: e.pointerId, x0: e.clientX, aim0: this.aimX, moved: false };
        try {
          area.setPointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
      },
      sig,
    );
    area.addEventListener(
      'pointermove',
      (e) => {
        const d = this.drag;
        if (!d || d.id !== e.pointerId || !this.canAim()) return;
        const dx = (e.clientX - d.x0) / (this.scale * this.zoom);
        if (Math.abs(e.clientX - d.x0) > 6) d.moved = true;
        this.aimX = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, d.aim0 + dx));
      },
      sig,
    );
    const up = (e: PointerEvent) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      // toque rápido sem arrastar = gira a peça 45° (pedido do Leon, 01/11: substitui o botão ⟳); arrastar move; SOLTAR larga
      if (e.type === 'pointerup' && !d.moved && this.canAim()) this.rotate();
    };
    area.addEventListener('pointerup', up, sig);
    area.addEventListener('pointercancel', up, sig);
    this.dropBtn.addEventListener(
      'click',
      () => {
        this.shell.sfx.unlock();
        if (this.canAim()) this.doDrop();
      },
      sig,
    );
    this.rotBtn.addEventListener(
      'click',
      () => {
        if (this.canAim()) this.rotate();
      },
      sig,
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.canAim()) return;
        const k = e.key.toLowerCase();
        const step = e.shiftKey ? 0.04 : 0.15;
        if (k === 'arrowleft' || k === 'a') this.aimX = Math.max(-AIM_LIMIT, this.aimX - step);
        else if (k === 'arrowright' || k === 'd') this.aimX = Math.min(AIM_LIMIT, this.aimX + step);
        else if (k === 'arrowup' || k === 'w' || k === 'r') this.rotate();
        else if (k === ' ' || k === 'enter' || k === 'arrowdown' || k === 's') this.doDrop();
        else return;
        e.preventDefault();
      },
      sig,
    );
  }

  private rotate() {
    this.aimA = (this.aimA + Math.PI / 4) % (Math.PI * 2);
    this.shell.sfx.tone(880, 0.04, 0.08, 'square');
  }

  // --------------------------------------------------------------- laço
  private frame(now: number) {
    const can = this.canAim();
    if (this.dropBtn.disabled === can) {
      this.dropBtn.disabled = !can;
      this.rotBtn.disabled = !can;
      this.dropBtn.style.opacity = can ? '1' : '0.35';
    }
    this.dropBtn.style.display = this.m ? '' : 'none';
    this.rotBtn.style.display = 'none'; // aposentado: toque na tela gira
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.shell.sfx.frame();
    const m = this.m;
    if (m && !this.shell.paused) {
      this.t += dt;
      this.fx.update(dt);
      if (m.phase === 'aim' && this.aiTurn()) this.runAI(dt);
      if (m.phase === 'settle') {
        this.acc += dt;
        let n = 0;
        while (this.acc >= DT && n < 4 && m.phase === 'settle') {
          const r = m.tick();
          this.acc -= DT;
          n++;
          if (r) this.afterTurn(r);
        }
      } else if (m.phase === 'over' && this.overT < 3) {
        // a pilha continua caindo um pouco (só visual)
        this.overT += dt;
        this.acc += dt;
        let n = 0;
        while (this.acc >= DT && n++ < 4) { m.sw.step(); this.acc -= DT; }
      } else this.acc = 0;
      this.hitCool = Math.max(0, this.hitCool - dt);
      if (this.hit) {
        this.onImpact(this.hit);
        this.hit = null;
      }
      // câmera (01/11): a base fica sempre no mesmo lugar e a vista se afasta aos poucos conforme a torre cresce,
      // mantendo pedestal, pilha e peça pendurada na tela. Só atualiza a altura na mira (peça caindo não puxa a câmera).
      const viewH0 = (this.cv.height / this.dpr - this.floorPx) / this.scale;
      if (m.phase === 'aim') this.camTop = m.sw.topY();
      const need = this.camTop + CAM_ABOVE - CAM_BASE;
      const zWant = Math.min(1, viewH0 / need);
      this.zoom += (zWant - this.zoom) * Math.min(1, dt * 1.6);
      this.camY = CAM_BASE;
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.paintBanner();
    this.draw();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Batida forte: som seco, poeirinha no ponto de contato e tremor proporcional (só acima de IMPACT_SHAKE). */
  private onImpact(h: { imp: number; x: number; y: number }) {
    if (this.hitCool > 0) return;
    this.hitCool = 0.09;
    this.hits.n++;
    const k = Math.min(1, (h.imp - IMPACT_MIN) / (IMPACT_FULL - IMPACT_MIN));
    // "toc" de madeira: ruído grave bem curto + pancada senoidal descendo; sem cauda (seco)
    this.shell.sfx.noise(520 - 160 * k, 0.045 + 0.02 * k, 0.12 + 0.28 * k, 1.4);
    this.shell.sfx.tone(170 - 40 * k, 0.06, 0.1 + 0.22 * k, 'sine', 0.55);
    this.fx.burst('contato', h.x, h.y, 0.18 + 0.12 * k);
    if (h.imp >= IMPACT_SHAKE && !reducedMotion()) {
      const amp = 2 + 2 * Math.min(1, (h.imp - IMPACT_SHAKE) / (IMPACT_FULL - IMPACT_SHAKE));
      if (this.shakeT <= 0 || amp > this.shakeAmp) this.shakeAmp = amp;
      this.shakeT = SHAKE_S;
      this.hits.shakes++;
      this.hits.maxShake = Math.max(this.hits.maxShake, amp);
    }
  }

  private paintBanner() {
    const m = this.m;
    const show = !!m && !!this.cfg && this.cfg.mode !== 'solo' && m.phase !== 'over';
    let key = 'off';
    if (show) {
      const n = this.cfg!.names;
      const ai = this.aiTurn();
      const wait = m!.phase === 'settle';
      key = `${m!.current}|${ai}|${wait}|${ai && m!.phase === 'aim' ? Math.floor(this.t * 3) % 3 : 0}`;
      if (key !== this.bannerKey) {
        const turnChanged = this.bannerKey.split('|')[0] !== String(m!.current);
        const who = ai ? T('Vez da IA', 'AI’s turn') : `${T('Vez de', 'Turn:')} ${n[m!.current]}`;
        this.banner.textContent = wait ? T('Esperando a pilha parar…', 'Waiting for the tower to settle…') : ai ? `${who} · ${T('pensando', 'thinking')}${'.'.repeat(1 + (Math.floor(this.t * 3) % 3))}` : who;
        this.banner.style.background = wait ? 'rgba(10,20,51,.85)' : PLAYER_COLORS[m!.current];
        this.banner.style.display = '';
        if (turnChanged && !wait && !reducedMotion()) this.banner.animate?.([{ transform: 'translateX(-50%) scale(1.25)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 260, easing: 'ease-out' });
      }
    } else if (this.bannerKey !== 'off') this.banner.style.display = 'none';
    this.bannerKey = key;
  }

  private runAI(dt: number) {
    const m = this.m!;
    if (!this.plan && !this.planned) {
      this.plan = planStackDrop(m, this.cfg!.difficulty, Math.random);
      this.aiT = 0;
    }
    this.aiT += dt;
    if (this.plan) {
      const t0 = performance.now();
      while (performance.now() - t0 < 9) {
        const r = this.plan.next();
        if (r.done) {
          this.planned = r.value;
          this.plan = null;
          break;
        }
      }
    }
    if (this.planned) {
      // move a peça até o alvo de forma visível e solta
      const p = this.planned;
      this.aimX += (p.x - this.aimX) * Math.min(1, dt * 5);
      if (Math.abs(this.aimA - p.angle) > 1e-3) this.aimA = p.angle;
      if (this.aiT > 1 && Math.abs(p.x - this.aimX) < 0.03) {
        this.aimX = p.x;
        this.planned = null;
        this.doDrop();
      }
    }
  }

  // -------------------------------------------------------------- desenho
  private layout() {
    const st = this.shell.stage;
    const W = st.clientWidth - 12;
    const H = st.clientHeight - 10;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // 2 basta para nitidez; 2,5 custava 56% mais pixels
    this.cv.style.width = `${W}px`;
    this.cv.style.height = `${H}px`;
    this.cv.width = Math.floor(W * this.dpr);
    this.cv.height = Math.floor(H * this.dpr);
    // celular em pé: botões numa faixa própria embaixo (não cobrem o pedestal) e zoom maior (vista de 8,6 u em vez de 11)
    const portrait = H > W * 1.15;
    this.floorPx = portrait ? 86 : 0;
    // celular deitado tem pouca altura: garante ~6,6 u de altura visível (mesa + pilha + peça pendurada)
    this.scale = Math.min(W / (portrait ? 8.6 : VIEW_W), (H - this.floorPx) / 6.6);
  }

  private paintArena(ctx: CanvasRenderingContext2D, W: number, H: number) {
    // arena (referência 02): navy, holofotes e faixas de luz vermelho/azul; desenhado, nada de imagem fixa
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1840');
    g.addColorStop(0.7, '#0a1433');
    g.addColorStop(1, '#070e26');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (const [x0, col] of [[0.2, 'rgba(255,59,77,'], [0.8, 'rgba(47,107,255,']] as const) {
      const cg = ctx.createLinearGradient(0, 0, 0, H);
      cg.addColorStop(0, col + '0.20)');
      cg.addColorStop(1, col + '0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(W * x0 - 20, 0);
      ctx.lineTo(W * x0 + 20, 0);
      ctx.lineTo(W * 0.5 + (x0 - 0.5) * W * 0.25 + 90, H);
      ctx.lineTo(W * 0.5 + (x0 - 0.5) * W * 0.25 - 90, H);
      ctx.fill();
    }
  }

  private draw() {
    const ctx = this.ctx;
    const W = this.cv.width / this.dpr;
    const H = this.cv.height / this.dpr;
    const sc = this.scale * this.zoom;
    // tremor: deslocamento aleatório que decai linearmente em SHAKE_S (só o mundo treme; fundo e HUD ficam)
    const sk = this.shakeT > 0 ? this.shakeAmp * (this.shakeT / SHAKE_S) : 0;
    const sx = sk ? (Math.random() * 2 - 1) * sk : 0;
    const sy = sk ? (Math.random() * 2 - 1) * sk : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // arena estática (fundo + holofotes) numa camada própria, desenhada só quando o tamanho muda (otimização 01/11:
    // três preenchimentos de tela inteira com degradê por quadro derrubavam o FPS em celular fraco)
    const key = `${this.cv.width}x${this.cv.height}`;
    if (!this.bgLayer || this.bgKey !== key) {
      this.bgKey = key;
      this.bgLayer = document.createElement('canvas');
      this.bgLayer.width = this.cv.width;
      this.bgLayer.height = this.cv.height;
      const bctx = this.bgLayer.getContext('2d')!;
      bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.paintArena(bctx, W, H);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bgLayer, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // faixas de luz da arquibancada (sobem devagar com a câmera)
    for (let i = 0; i < 6; i++) {
      const wy = i * 2.6 + 0.8;
      const sy = H - this.floorPx - (wy - this.camY * 0.5) * sc;
      if (sy < -10 || sy > H + 10) continue;
      ctx.fillStyle = i % 2 ? 'rgba(47,107,255,0.35)' : 'rgba(255,59,77,0.32)';
      ctx.fillRect(0, sy, W * 0.16, 3);
      ctx.fillStyle = i % 2 ? 'rgba(255,59,77,0.32)' : 'rgba(47,107,255,0.35)';
      ctx.fillRect(W * 0.84, sy, W * 0.16, 3);
    }
    // mundo: y para cima
    ctx.setTransform(this.dpr * sc, 0, 0, -this.dpr * sc, this.dpr * (W / 2 + sx), this.dpr * (H - this.floorPx + this.camY * sc + sy));
    // pedestal (mesma geometria física da plataforma; só o desenho mudou). Referência empilha-arena-previa.png:
    // anel de luz no chão, coluna escura, tampo com borda âmbar e coroa na frente.
    const pw = PLATFORM.w;
    const ph = PLATFORM.h;
    const floorY = -ph - 1.1;
    for (const [rx, ry, a, c] of [[pw * 0.95, 0.42, 0.55, '#2f6bff'], [pw * 0.7, 0.3, 0.45, '#00e0ff']] as const) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.ellipse(0, floorY, rx, ry, 0, 0, Math.PI * 2);
      // brilho = traço largo transparente + traço fino (sem shadowBlur, caro no celular: otimização 01/11)
      ctx.lineWidth = 0.22;
      ctx.globalAlpha = a * 0.22;
      ctx.stroke();
      ctx.lineWidth = 0.05;
      ctx.globalAlpha = a;
      ctx.stroke();
      ctx.restore();
    }
    const bg = ctx.createLinearGradient(0, -ph, 0, floorY);
    bg.addColorStop(0, '#2a3557');
    bg.addColorStop(1, '#10162e');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-pw / 2 + 0.25, -ph);
    ctx.lineTo(pw / 2 - 0.25, -ph);
    ctx.lineTo(pw / 2 + 0.15, floorY);
    ctx.lineTo(-pw / 2 - 0.15, floorY);
    ctx.fill();
    // base larga no chão (continua para baixo da tela no celular deitado)
    ctx.fillStyle = '#0c1229';
    ctx.fillRect(-pw / 2 - 0.15, floorY - 6, pw + 0.3, 6);
    const tg = ctx.createLinearGradient(0, 0, 0, -ph);
    tg.addColorStop(0, '#46548a');
    tg.addColorStop(1, '#1b2337');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, -ph, pw, ph, 0.1);
    ctx.fill();
    // coroa âmbar na frente do tampo (desenhada, sem texto)
    ctx.save();
    ctx.translate(0, -ph / 2 - 0.02);
    ctx.fillStyle = '#ffc24a';
    ctx.beginPath();
    ctx.moveTo(-0.2, -0.1);
    ctx.lineTo(0.2, -0.1);
    ctx.lineTo(0.22, 0.1);
    ctx.lineTo(0.11, 0.0);
    ctx.lineTo(0, 0.14);
    ctx.lineTo(-0.11, 0.0);
    ctx.lineTo(-0.22, 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // anel âmbar de luz na borda do pedestal
    ctx.strokeStyle = '#ffc24a';
    ctx.beginPath();
    ctx.moveTo(-pw / 2 + 0.04, -0.03);
    ctx.lineTo(pw / 2 - 0.04, -0.03);
    ctx.moveTo(-pw / 2 + 0.1, -ph + 0.08);
    ctx.lineTo(-0.34, -ph + 0.08);
    ctx.moveTo(0.34, -ph + 0.08);
    ctx.lineTo(pw / 2 - 0.1, -ph + 0.08);
    ctx.lineWidth = 0.2;
    ctx.globalAlpha = 0.22;
    ctx.stroke();
    ctx.lineWidth = 0.05;
    ctx.globalAlpha = 1;
    ctx.stroke();

    const m = this.m;
    if (m) {
      for (const p of m.sw.pieces) {
        const pos = p.body.getPosition();
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(p.body.getAngle());
        pieceById(p.id).draw(ctx);
        ctx.restore();
      }
      if (m.phase === 'aim') {
        const def = pieceById(m.piece);
        const y = m.holdY(this.aimA);
        const col = this.cfg?.mode === 'solo' ? '#ffffff' : PLAYER_COLORS[m.current];
        // guia curta (pedido do Leon, 01/11): só o começo da queda, sumindo; não chega na pilha nem mostra onde a peça
        // para — calcular o ponto de queda faz parte do desafio. Comprimento: metade do vão até o topo, 0,4 a 1,1 u.
        const g0 = y - 0.35;
        const len = Math.max(0.4, Math.min(1.1, (g0 - this.camTop) * 0.5));
        const lg = ctx.createLinearGradient(0, g0, 0, g0 - len);
        lg.addColorStop(0, col);
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = lg;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 0.045;
        ctx.lineCap = 'round';
        ctx.setLineDash([0.13, 0.11]);
        ctx.beginPath();
        ctx.moveTo(this.aimX, g0);
        ctx.lineTo(this.aimX, g0 - len);
        ctx.stroke();
        ctx.setLineDash([]);
        // anel de luz da "garra" (referência): elipse âmbar acima da peça + feixe suave descendo até ela
        const ringY = y + 0.95;
        const beam = ctx.createLinearGradient(0, ringY, 0, y - 0.2);
        beam.addColorStop(0, 'rgba(255,214,120,0.30)');
        beam.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(this.aimX - 0.55, ringY);
        ctx.lineTo(this.aimX + 0.55, ringY);
        ctx.lineTo(this.aimX + 0.7, y - 0.2);
        ctx.lineTo(this.aimX - 0.7, y - 0.2);
        ctx.fill();
        ctx.save();
        ctx.strokeStyle = '#ffc24a';
        ctx.beginPath();
        ctx.ellipse(this.aimX, ringY, 0.6, 0.13, 0, 0, Math.PI * 2);
        ctx.lineWidth = 0.22;
        ctx.globalAlpha = 0.25;
        ctx.stroke();
        ctx.lineWidth = 0.06;
        ctx.globalAlpha = 1;
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 0.025;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.ellipse(this.aimX, ringY, 0.5, 0.09, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
        // halo da peça na mão: disco radial na cor de quem joga (antes shadowBlur no desenho inteiro da peça)
        const hy = y + Math.sin(this.t * 3) * 0.03;
        const halo = ctx.createRadialGradient(this.aimX, hy, 0.2, this.aimX, hy, 0.95);
        halo.addColorStop(0, col + '66');
        halo.addColorStop(1, col + '00');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(this.aimX, hy, 0.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(this.aimX, hy);
        ctx.rotate(this.aimA);
        def.draw(ctx);
        ctx.restore();
      }
      this.fx.draw(ctx);
      // próxima peça (canto)
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = 'rgba(10,8,24,0.55)';
      ctx.beginPath();
      ctx.roundRect(10, 10, 92, 74, 12);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(T('Próxima', 'Next'), 20, 16);
      ctx.setTransform(this.dpr * 36, 0, 0, -this.dpr * 36, this.dpr * 56, this.dpr * 56);
      pieceById(m.nextPiece).draw(ctx);
    }
  }

  /** Para testes no navegador. */
  debug() {
    const m = this.m;
    return m
      ? {
          phase: m.phase,
          current: m.current,
          placed: m.placed,
          loser: m.loser,
          pieces: m.sw.pieces.length,
          top: m.sw.topY(),
          aimX: this.aimX,
          aimA: this.aimA,
          zoom: this.zoom,
          hits: { ...this.hits },
          banner: this.banner.style.display === 'none' ? '' : this.banner.textContent,
          baseScreenY: (this.cv.height / this.dpr - this.floorPx + (this.camY + PLATFORM.h) * this.scale * this.zoom),
          canvasH: this.cv.height / this.dpr,
          piece: m.piece,
          landing: m.phase === 'aim' ? landingY(m.sw, pieceById(m.piece), this.aimX, m.holdY(this.aimA), this.aimA) : null,
        }
      : null;
  }
}

/** Impulso normal (planck) mínimo para contar como batida; peça parada em cima de outra gera ~0,13. */
const IMPACT_MIN = 0.9;
/** A partir daqui a tela treme (2 px), chegando a 4 px em IMPACT_FULL. Medido: peça pousando dá 2,3–4,0 (p10–p90). */
const IMPACT_SHAKE = 2.5;
const IMPACT_FULL = 5.5;
const SHAKE_S = 0.08;
/** Câmera: y do mundo na linha de baixo da área de jogo e folga acima do topo da pilha (peça + anel da garra). */
const CAM_BASE = -1.3;
const CAM_ABOVE = 3.5;
const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const plural = (n: number) => `${n} ${n === 1 ? T('peça', 'piece') : T('peças', 'pieces')}`;


const stack: GameModule = {
  mount(container, { onExit }) {
    const g = new StackGame(container, onExit);
    (window as unknown as { __stack?: StackGame }).__stack = g;
    return {
      destroy() {
        g.dispose();
        delete (window as unknown as { __stack?: StackGame }).__stack;
      },
    };
  },
};
export default stack;
