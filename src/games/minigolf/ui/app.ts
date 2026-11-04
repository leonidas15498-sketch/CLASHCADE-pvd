import { onMountRollback } from '../../shared/lifecycle';
import { enterGameFullscreen, exitGameFullscreen } from '../../shared/fullscreen';
import { T } from '../../../i18n/lang';
/** Nome e dica dos buracos em inglês (chave = nome em português). */
const LEVEL_EN: Record<string, [string, string]> = {
  'Primeira Tacada': ['First Putt', 'Aim at the hole and adjust the power. A ball that is too fast skips over the cup.'],
  'Curva Suave': ['Gentle Curve', 'Use the back wall to turn the corner.'],
  Tabela: ['Bank Shot', 'The block covers the direct path: go above it, below it or bank it.'],
  Subida: ['Uphill', 'The ramp slows the ball and, without enough power, it rolls back. Hit it firmly.'],
  'Ponte da Ilha': ['Island Bridge', 'The bridge has no rails: fall in the water and you return to the last spot with a 1-stroke penalty.'],
  Moinho: ['Windmill', 'The blades never stop: wait for the gap and pass above or below the axle.'],
  'Zigue-Zague': ['Zigzag', 'Two S-shaped corridors. Watch out for the sand before the hole: it slows the ball a lot. Two lined-up gaps reward the brave.'],
  'Portão Deslizante': ['Sliding Gate', 'Go through the gate when the block is not in front of it.'],
  'Grande Final': ['Grand Finale', 'Go down the ramp, turn up, dodge the windmill and get around the last block.'],
};
import { newMatchId, reportMatch } from '../../../services/match';
import { mountBalance, tierTag, wireLocked } from '../../shared/shopUi';
import { Music } from '../../shared/music';
import { PowerGauge } from '../../shared/powerGauge';
import { mountMusicControl } from '../../shared/musicControl';
import { LEVELS } from '../levels/levels';
import { findShot } from '../levels/solver';
import { aimRay, createWorld, GolfWorld, step, strike } from '../physics/sim';
import { GOLF, Level, Vec } from '../physics/types';
import {
  CUSTOM_GRIPS,
  CUSTOM_HEADS,
  CUSTOM_SHAFTS,
  customPutter,
  DEFAULT_CUSTOM,
  isPutterAvailable,
  isValidCustom,
  paintPutter,
  paintPutterVertical,
  putterById,
  PUTTERS,
  PutterCustom,
  PutterSkin,
} from '../render/putters';
import { COURSE_THEMES, courseById, CourseTheme, isCourseAvailable } from '../render/courses';
import { GolfRenderer, Particle, PLAYER_COLORS } from '../render/renderer';
import { setTurnColor } from '../../shared/players';
import { burstsEnabled, drawTrail, isTrailAvailable, mountBurstToggle, ParticleSystem, TrailBuffer, TRAILS, TrailId, usableTrail } from '../../shared/fx';
import { advance, applyShot, createMatch, GolfMatch, holeComplete, result, ShotOutcome } from '../rules/rules';
import { golfStore, GolfSave } from '../storage';
import { GolfSfx } from './sfx';

/** Música do minigolfe: defina o caminho quando houver uma faixa (ex.: './music/minigolfe.mp3'). */
const MINIGOLF_MUSIC: string | null = './music/sunday-on-the-velvet-green.mp3';
const AIM_MAX = 20;
/** Comprimento da prévia da tabela (u): mostra a direção de saída, não o caminho inteiro. */
const BOUNCE_PREVIEW = 9;
/** Quanto puxar o taco no campo (u) para chegar a 100%. */
const PULL_RANGE = 14;
/** Descida do taco até a bola (s) e duração da queda no copo (s). */
const SWING_TIME = 0.14;
const HOLE_ANIM = 0.75;

type Phase = 'menu' | 'aim' | 'rolling' | 'holing' | 'out' | 'card';

export class MinigolfApp {
  private root: HTMLElement;
  private $ = <T extends HTMLElement = HTMLElement>(id: string) => this.root.querySelector<T>('#' + id)!;
  private renderer: GolfRenderer;
  private save: GolfSave = golfStore.load();
  private sfx = new GolfSfx();
  private music: Music | null = MINIGOLF_MUSIC ? new Music(MINIGOLF_MUSIC) : null;
  private musicCtl: { destroy(): void } | null = null;
  private ac = new AbortController();
  private raf = 0;
  private disposed = false;

  match: GolfMatch | null = null;
  private matchId: string | null = null;
  world: GolfWorld | null = null;
  phase: Phase = 'menu';
  aimAngle = 0;
  power = 0;
  private pulling = false;
  private paused = false;
  private inputCleanups: (() => void)[] = [];
  private last = 0;
  private acc = 0;
  private animT = 0;
  private splash: { x: number; y: number; age: number } | null = null;
  private toastTimer = 0;
  private eventIdx = 0;
  /** Taco de cada jogador ('custom' = personalizado) e o personalizado de cada um. */
  private putterSel: [string, string] = ['classico', 'classico'];
  private customs: [PutterCustom, PutterCustom] = [{ ...DEFAULT_CUSTOM }, { ...DEFAULT_CUSTOM, head: '#3d8bff' }];
  private putterTab = 0;
  private putterDuo = true;
  private sideKey = '';
  /** Balanço do taco antes do impulso (~90 ms). */
  private swing: { t: number; power: number; angle: number } | null = null;
  private follow: { t: number; power: number; angle: number; x: number; y: number } | null = null;
  private ballQ: [number, number, number, number][] = [
    [1, 0, 0, 0],
    [1, 0, 0, 0],
  ];
  private visPos: (Vec | null)[] = [null, null];
  /** Rastro por tempo (0,3 s) e distância (0,25 u): mesmo tamanho em qualquer FPS (auditoria de 01/11). */
  private trail = new TrailBuffer(0.3, 0.25);
  private fx = new ParticleSystem();
  private gauge: PowerGauge | null = null;
  private particles: (Particle & { vx: number; vy: number; life: number })[] = [];

  constructor(root: HTMLElement, private onExit: () => void) {
    onMountRollback(() => this.dispose());
    window.addEventListener('blur', () => this.pause(), { signal: this.ac.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); }, { signal: this.ac.signal });
    this.root = root;
    this.renderer = new GolfRenderer(this.$<HTMLCanvasElement>('mg-cv'));
    this.gauge = new PowerGauge(this.$('mg-power'));
    const ct = courseById(this.save.course);
    this.renderer.setTheme(isCourseAvailable(ct) ? ct : COURSE_THEMES[0]);
    this.sfx.enabled = this.save.sound;
    this.loadPutters();
    if (this.music) {
      this.musicCtl = mountMusicControl(this.$('mg-music-slot'), this.music, this.save.music, (m) => {
        this.save.music = m;
        golfStore.save(this.save);
      });
      const kick = () => this.music?.start();
      window.addEventListener('pointerdown', kick, { capture: true, once: true, signal: this.ac.signal });
    }
    this.bind();
    this.paintSound();
    this.setPower(0);
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    this.renderMenu();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose(): void {
    exitGameFullscreen();
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    for (const cancel of this.inputCleanups) cancel();
    clearTimeout(this.toastTimer);
    this.music?.dispose();
    this.musicCtl?.destroy();
    this.sfx.dispose();
    this.gauge?.dispose();
  }

  get level(): Level {
    return LEVELS[this.match ? this.match.holes[this.match.holeIdx] : 0];
  }

  // ------------------------------------------------------------- bindings
  private bind() {
    const $ = this.$;
    const sig = { signal: this.ac.signal };
    ($('mg-name1') as HTMLInputElement).value = this.save.name1;
    ($('mg-p1') as HTMLInputElement).value = this.save.names[0];
    ($('mg-p2') as HTMLInputElement).value = this.save.names[1];
    $('mg-back-catalog').addEventListener('click', () => this.onExit());
    $('mg-play-solo').addEventListener('click', () => this.startSolo(LEVELS.map((_, i) => i)));
    $('mg-pick').addEventListener('click', () => this.showLevels());
    $('mg-levels-close').addEventListener('click', () => this.hide('mg-levels'));
    $('mg-play-duo').addEventListener('click', () => {
      const a = ($('mg-p1') as HTMLInputElement).value.trim();
      const b = ($('mg-p2') as HTMLInputElement).value.trim();
      this.save.names = [a, b];
      golfStore.save(this.save);
      this.start('duo', [a || 'Jogador 1', b || 'Jogador 2'], LEVELS.map((_, i) => i));
    });
    $('mg-menu-help').addEventListener('click', () => this.show('mg-helpbox'));
    for (const id of ['mg-menu-putters', 'mg-pause-putters']) $(id).addEventListener('click', () => this.showPutters());
    mountBalance($('mg-shop-bal'), this.ac.signal);
    $('mg-putters-close').addEventListener('click', () => {
      this.hide('mg-putters');
      this.paintPutterPicks();
    });
    for (const i of [0, 1])
      $(`mg-putter-p${i + 1}`).addEventListener('click', () => {
        $('mg-sec-putters').click();
        this.showPutters(i);
      });
    this.paintPutterPicks();
    const sec = (which: 'putters' | 'course' | 'trail') => {
      for (const k of ['putters', 'course', 'trail'] as const) {
        $(`mg-sec-${k}`).classList.toggle('on', k === which);
        $(`mg-pane-${k}`).hidden = k !== which;
      }
      if (which === 'course') this.renderCourses();
      if (which === 'trail') this.renderTrails();
    };
    $('mg-sec-putters').addEventListener('click', () => sec('putters'));
    $('mg-sec-course').addEventListener('click', () => sec('course'));
    $('mg-sec-trail').addEventListener('click', () => sec('trail'));
    $('mg-help').addEventListener('click', () => this.show('mg-helpbox'));
    $('mg-help-close').addEventListener('click', () => this.hide('mg-helpbox'));
    $('mg-home').addEventListener('click', () => {
      if (!this.match || this.match.finished) return this.toMenu();
      this.confirm('Sair da partida e voltar ao menu do minigolfe? O placar desta partida será perdido.', () => this.toMenu());
    });
    $('mg-pause').addEventListener('click', () => this.pause());
    $('mg-resume').addEventListener('click', () => this.resume());
    $('mg-restart').addEventListener('click', () =>
      this.confirm(
        this.match?.mode === 'duo' ? 'Reiniciar este buraco para os DOIS jogadores?' : 'Reiniciar este buraco?',
        () => {
          this.restartHole();
          this.resume();
        },
      ),
    );
    $('mg-show-card').addEventListener('click', () => {
      this.hide('mg-pausebox');
      this.showCard(false);
    });
    $('mg-to-menu').addEventListener('click', () => this.confirm('Voltar ao menu? O placar desta partida será perdido.', () => this.toMenu()));
    $('mg-sound').addEventListener('click', () => {
      this.save.sound = !this.save.sound;
      this.sfx.enabled = this.save.sound;
      golfStore.save(this.save);
      this.paintSound();
    });
    $('mg-card-menu').addEventListener('click', () => this.toMenu());
    $('mg-card-new').addEventListener('click', () => this.toMenu());
    $('mg-card-exit').addEventListener('click', () => this.onExit());
    $('mg-card-next').addEventListener('click', () => this.cardNext());

    // mira fina com repetição ao segurar
    const hold = (id: string, dir: number) => {
      let timer = 0;
      let n = 0;
      const tick = () => {
        if (this.canAim()) this.aimAngle += dir * (n < 8 ? 0.2 : 0.8) * (Math.PI / 180);
        n++;
        timer = window.setTimeout(tick, n === 1 ? 300 : 45);
      };
      const stop = () => {
        clearTimeout(timer);
        n = 0;
      };
      this.inputCleanups.push(stop);
      this.ac.signal.addEventListener('abort', stop, { once: true });
      const el = $(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.sfx.unlock();
        tick();
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, stop);
      this.ac.signal.addEventListener('abort', stop);
    };
    hold('mg-rot-l', -1);
    hold('mg-rot-r', 1);

    // Padrão da plataforma (igual à Sinuca): o taco da barra lateral é puxado para baixo e solto para tacar.
    const bar = $('mg-power');
    let startY = 0;
    let barDrag = false;
    const travel = () => bar.clientHeight * 0.62;
    bar.addEventListener('pointerdown', (e) => {
      this.sfx.unlock();
      if (!this.canAim()) return;
      barDrag = true;
      this.pulling = true;
      bar.setPointerCapture(e.pointerId);
      startY = e.clientY;
            this.setPower(0);
    });
    bar.addEventListener('pointermove', (e) => barDrag && this.setPower((e.clientY - startY) / travel()));
    const barUp = (fire: boolean) => {
      if (!barDrag) return;
      barDrag = false;
      this.pulling = false;
      if (fire && this.power >= 0.03) this.shoot();
      else {
        this.snapPutter(false);
        if (fire) this.toast('Tacada cancelada.');
      }
    };
    bar.addEventListener('pointerup', () => barUp(true));
    bar.addEventListener('pointercancel', () => barUp(false));
    this.inputCleanups.push(() => barUp(false));

    // Campo: atrás da bola = mexer no taco (gira; se pegou no taco, puxar dá força e soltar taca);
    // à frente da bola = mirar direto no ponto tocado.
    const cv = this.$<HTMLCanvasElement>('mg-cv');
    const toW = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return this.renderer.toWorld(e.clientX - r.left, e.clientY - r.top);
    };
    let mode: 'none' | 'aim' | 'stick' = 'none';
    let st = { aim0: 0, phi0: 0, r0: 0, pull: false };
    cv.addEventListener('pointerdown', (e) => {
      this.sfx.unlock();
      if (!this.canAim() || !this.world) return;
      cv.setPointerCapture(e.pointerId);
      const p = toW(e);
      const rx = p.x - this.world.x;
      const ry = p.y - this.world.y;
      const dx = Math.cos(this.aimAngle);
      const dy = Math.sin(this.aimAngle);
      const along = rx * dx + ry * dy;
      const perp = Math.abs(rx * dy - ry * dx);
      if (along < -GOLF.ballR * 0.8) {
        mode = 'stick';
        st = { aim0: this.aimAngle, phi0: Math.atan2(ry, rx), r0: Math.hypot(rx, ry), pull: perp <= Math.max(2.2, 30 / this.renderer.scale) && -along <= 13 };
        if (st.pull) {
          this.pulling = true;
                    this.setPower(0);
        }
        return;
      }
      mode = 'aim';
      if (Math.hypot(rx, ry) > GOLF.ballR * 1.5) this.aimAngle = Math.atan2(ry, rx);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.canAim() || !this.world || mode === 'none') return;
      const p = toW(e);
      const rx = p.x - this.world.x;
      const ry = p.y - this.world.y;
      const r = Math.hypot(rx, ry);
      if (mode === 'aim') {
        if (r > GOLF.ballR * 1.5) this.aimAngle = Math.atan2(ry, rx);
        return;
      }
      const locked = st.pull && this.power > 0.04; // durante a puxada a direção trava
      if (!locked && r > GOLF.ballR * 1.5) {
        let d = Math.atan2(ry, rx) - st.phi0;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        this.aimAngle = st.aim0 + d;
      }
      if (st.pull) this.setPower((r - st.r0) / PULL_RANGE);
    });
    const cvUp = (fire: boolean) => {
      const was = mode;
      mode = 'none';
      if (was === 'stick' && st.pull) {
        this.pulling = false;
        if (fire && this.power >= 0.03) this.shoot();
        else this.snapPutter(false);
      }
    };
    cv.addEventListener('pointerup', () => cvUp(true));
    cv.addEventListener('pointercancel', () => cvUp(false));
    this.inputCleanups.push(() => cvUp(false));

    window.addEventListener(
      'keydown',
      (e) => {
        if (this.root.querySelector('.mg-overlay.show')) return;
        if (e.key === 'Escape' || e.key === 'p') return this.pause();
        if (!this.canAim()) return;
        const stepA = (e.shiftKey ? 0.2 : 1) * (Math.PI / 180);
        if (e.key === 'ArrowLeft') this.aimAngle -= stepA;
        else if (e.key === 'ArrowRight') this.aimAngle += stepA;
        else if (e.key === 'ArrowUp') this.setPower(this.power + 0.02);
        else if (e.key === 'ArrowDown') this.setPower(this.power - 0.02);
        else if (e.key === ' ' || e.key === 'Enter') this.shoot();
        else return;
        e.preventDefault();
      },
      sig,
    );
  }

  // ---------------------------------------------------------------- fluxo
  private startSolo(holes: number[]) {
    const n = (this.$('mg-name1') as HTMLInputElement).value.trim();
    this.save.name1 = n;
    golfStore.save(this.save);
    this.start('solo', [n || 'Você'], holes);
  }

  start(mode: 'solo' | 'duo', names: string[], holes: number[]) {
    // celular: partida em tela cheia, sem a barra do navegador (mesmo método da sinuca, pedido do Leon 03/11)
    enterGameFullscreen();
    this.sfx.unlock();
    this.match = createMatch(mode, names, holes, LEVELS[holes[0]].tee);
    this.matchId = newMatchId('minigolfe');
    this.hideAll();
    this.paused = false;
    this.loadHole();
  }

  private loadHole() {
    const m = this.match!;
    this.world = createWorld(this.level, m.ph[m.current].pos, 0);
    this.layout();
    this.beginTurn();
    this.toast(`${T('Buraco', 'Hole')} ${m.holeIdx + 1} · ${T(this.level.name, LEVEL_EN[this.level.name]?.[0] ?? this.level.name)} — ${T(this.level.tip, LEVEL_EN[this.level.name]?.[1] ?? this.level.tip)}`, false, 5000);
  }

  private beginTurn() {
    const m = this.match!;
    const pos = m.ph[m.current].pos;
    const t = this.world?.t ?? 0;
    this.world = createWorld(this.level, pos, t);
    this.eventIdx = 0;
    this.visPos[m.current] = { ...pos };
    this.trail.clear();
    this.aimAngle = Math.atan2(this.level.hole.y - pos.y, this.level.hole.x - pos.x);
    if (this.level.route.length > 2) {
      // primeira referência do caminho, para a mira inicial não apontar para a parede
      const next = this.level.route.find((p) => Math.hypot(p.x - pos.x, p.y - pos.y) > 4) ?? this.level.hole;
      this.aimAngle = Math.atan2(next.y - pos.y, next.x - pos.x);
    }
    this.phase = 'aim';
    this.updateHUD();
  }

  private restartHole() {
    const m = this.match!;
    const players = m.players.map((p) => ({ ...p, scores: p.scores.map((s, i) => (i === m.holeIdx ? null : s)) }));
    this.match = {
      ...m,
      players,
      ph: m.players.map(() => ({ strokes: 0, pos: { ...this.level.tee }, safe: { ...this.level.tee }, done: false })),
      current: 0,
    };
    this.loadHole();
  }

  canAim(): boolean {
    return !this.paused && this.phase === 'aim' && !this.swing && !!this.world && this.world.status === 'rest';
  }

  shoot(): boolean {
    if (!this.canAim() || this.power < 0.01 || this.swing) return false;
    this.sfx.unlock();
    this.swing = { t: 0, power: this.power, angle: this.aimAngle };
    return true;
  }

  /** Fim do balanço: aplica UM impulso. */
  private release() {
    const s = this.swing!;
    this.swing = null;
    this.follow = { t: 0, power: s.power, angle: s.angle, x: this.world!.x, y: this.world!.y };
    if (!strike(this.world!, s.angle, s.power)) return;
    this.sfx.putt(s.power);
    this.snapPutter(true);
    this.phase = 'rolling';
    this.eventIdx = 0;
    this.updateHUD();
  }

  private onShotEnd() {
    const w = this.world!;
    if (w.status === 'holed') {
      this.sfx.cup();
      const first = this.match!.ph[this.match!.current].strokes === 0;
      this.burst(this.level.hole.x, this.level.hole.y, first);
      if (first) this.toast('Buraco em uma!', false, 2500);
      this.phase = 'holing';
      this.animT = 0;
    } else if (w.status === 'out') {
      this.sfx.splash();
      this.phase = 'out';
      this.splash = { x: w.x, y: w.y, age: 0 };
      this.animT = 0;
    } else {
      this.resolve({ kind: 'rest', pos: { x: w.x, y: w.y } });
    }
  }

  private resolve(outcome: ShotOutcome) {
    const m = applyShot(this.match!, outcome);
    this.match = m;
    this.splash = null;
    this.toast(m.lastMessage, outcome.kind === 'out');
    if (holeComplete(m)) {
      this.phase = 'card';
      this.updateHUD();
      window.setTimeout(() => !this.disposed && this.showCard(true), 700);
      return;
    }
    this.beginTurn();
  }

  private cardNext() {
    const m = this.match!;
    if (m.finished) {
      // revanche com os mesmos jogadores e buracos
      this.start(m.mode, m.players.map((p) => p.name), m.holes);
      return;
    }
    if (!holeComplete(m)) {
      this.hide('mg-card');
      return;
    }
    const nextIdx = m.holeIdx + 1 < m.holes.length ? m.holes[m.holeIdx + 1] : null;
    this.match = advance(m, nextIdx === null ? null : LEVELS[nextIdx].tee);
    if (this.match.finished) {
      this.recordRecords();
      this.showCard(true);
      return;
    }
    this.hide('mg-card');
    this.loadHole();
  }

  private recordRecords() {
    const m = this.match!;
    if (m.mode !== 'solo') return; // 2P local não alimenta recordes competitivos
    const p = m.players[0];
    m.holes.forEach((lv, i) => {
      const s = p.scores[i];
      if (s !== null && (this.save.bestHole[lv] === null || s < this.save.bestHole[lv]!)) this.save.bestHole[lv] = s;
    });
    if (m.holes.length === 9) {
      const tot = result(m).totals[0];
      this.save.rounds += 1;
      if (this.save.bestTotal === null || tot < this.save.bestTotal) this.save.bestTotal = tot;
    }
    golfStore.save(this.save);
  }

  // ----------------------------------------------------------------- telas
  private showCard(final: boolean) {
    const m = this.match!;
    const pars = m.holes.map((i) => LEVELS[i].par);
    const parTot = pars.reduce((a, b) => a + b, 0);
    const head = `<tr><th>Buraco</th>${m.holes.map((_, i) => `<th class="${i === m.holeIdx ? 'cur' : ''}">${i + 1}</th>`).join('')}<th class="tot">Total</th></tr>`;
    const parRow = `<tr><td>Par</td>${pars.map((p, i) => `<td class="${i === m.holeIdx ? 'cur' : ''}">${p}</td>`).join('')}<td class="tot">${parTot}</td></tr>`;
    const rows = m.players
      .map((p, pi) => {
        const cells = p.scores
          .map((s, i) => {
            const cls = [i === m.holeIdx ? 'cur' : '', s === null ? '' : s < pars[i] ? 'under' : s > pars[i] ? 'over' : ''].join(' ');
            return `<td class="${cls}">${s ?? '–'}</td>`;
          })
          .join('');
        const tot = p.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
        return `<tr><td><span style="color:${PLAYER_COLORS[pi]}">●</span> ${escapeHtml(p.name)}</td>${cells}<td class="tot">${tot}</td></tr>`;
      })
      .join('');
    this.$('mg-table').innerHTML = head + parRow + rows;
    const done = m.finished;
    this.$('mg-card-new').hidden = !done;
    this.$('mg-card-exit').hidden = !done;
    this.$('mg-card-menu').hidden = done;
    const title = this.$('mg-card-title');
    const msg = this.$('mg-card-msg');
    const next = this.$<HTMLButtonElement>('mg-card-next');
    if (done) {
      const r = result(m);
      if (this.matchId) {
        reportMatch({ matchId: this.matchId, game: 'minigolfe', mode: m.mode === 'solo' ? 'solo' : 'local', winner: m.mode === 'solo' ? null : r.winner === null ? 'draw' : (r.winner as 0 | 1) });
        this.matchId = null;
      }
      if (m.mode === 'solo') {
        const diff = r.totals[0] - parTot;
        title.textContent = `Fim! ${r.totals[0]} tacadas`;
        msg.textContent =
          (diff === 0 ? 'No par do circuito.' : diff < 0 ? `${-diff} abaixo do par!` : `${diff} acima do par.`) +
          (m.holes.length === 9 && this.save.bestTotal !== null ? ` Seu recorde: ${this.save.bestTotal}.` : '');
      } else if (r.winner === null) {
        title.textContent = 'Empate!';
        msg.textContent = `Os dois fizeram ${r.totals[0]} tacadas e empataram também nos 3 últimos buracos.`;
      } else {
        title.textContent = `${m.players[r.winner].name} venceu!`;
        msg.textContent =
          r.reason === 'last3'
            ? `Empate no total (${r.totals[0]}); desempate pelos 3 últimos buracos.`
            : `${r.totals[r.winner]} × ${r.totals[1 - r.winner]} tacadas.`;
      }
      next.textContent = 'Revanche';
    } else if (final) {
      title.textContent = T(`Buraco ${m.holeIdx + 1} concluído`, `Hole ${m.holeIdx + 1} complete`);
      msg.textContent = m.holeIdx + 1 >= m.holes.length ? 'Último buraco! Veja o resultado.' : '';
      next.textContent = m.holeIdx + 1 >= m.holes.length ? 'Ver resultado' : 'Próximo buraco';
    } else {
      title.textContent = 'Placar';
      msg.textContent = '';
      next.textContent = 'Continuar';
    }
    this.show('mg-card');
  }

  private showLevels() {
    const grid = this.$('mg-level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      const best = this.save.bestHole[i];
      b.innerHTML = `<b>${i + 1}. ${escapeHtml(lv.name)}</b><small>Par ${lv.par} · Recorde ${best ?? '–'}</small>`;
      b.addEventListener('click', () => {
        this.hide('mg-levels');
        this.startSolo([i]);
      });
      grid.appendChild(b);
    });
    this.show('mg-levels');
  }

  private loadPutters() {
    const sv = this.save;
    const ids = sv.putters ?? [sv.putter ?? 'classico', sv.putter ?? 'classico'];
    this.putterSel = [0, 1].map((i) => ((ids[i] === 'custom' && isPutterAvailable(customPutter(this.customs[i]))) || PUTTERS.some((p) => p.id === ids[i] && isPutterAvailable(p)) ? ids[i] : 'classico')) as [string, string];
    if (sv.custom) sv.custom.forEach((c, i) => isValidCustom(c) && (this.customs[i] = { ...c }));
  }

  private savePutters() {
    this.save.putters = [...this.putterSel];
    this.save.putter = this.putterSel[0];
    this.save.custom = [{ ...this.customs[0] }, { ...this.customs[1] }];
    golfStore.save(this.save);
    this.drawSidePutter();
  }

  /** Taco do jogador i (0 = J1/solo, 1 = J2). */
  private skinFor(i: number): PutterSkin {
    const id = this.putterSel[i] ?? 'classico';
    if (id === 'custom') {
      const c = customPutter(this.customs[i]);
      return isPutterAvailable(c) ? c : PUTTERS[0];
    }
    const p = putterById(id);
    return isPutterAvailable(p) ? p : PUTTERS[0];
  }

  /** Taco de quem está jogando agora. */
  private get putter(): PutterSkin {
    return this.skinFor(this.match && !this.match.finished ? this.match.current : 0);
  }

  /** Rótulos "Taco J1/J2" no cartão de 2 jogadores. */
  private paintPutterPicks() {
    for (const i of [0, 1]) this.$(`mg-putter-p${i + 1}`).innerHTML = `${T('Taco J', 'Putter P')}${i + 1}: <b>${escapeHtml(this.skinFor(i).name)}</b> ▸`;
  }

  /** `forceTab`: abre direto no taco desse jogador (botões do cartão de 2 jogadores). */
  private showPutters(forceTab?: number, keep = false) {
    if (!keep) {
      this.putterDuo = forceTab !== undefined || (this.match ? this.match.players.length > 1 : true);
      if (forceTab !== undefined) this.putterTab = forceTab;
      else if (!this.putterDuo) this.putterTab = 0;
      else if (this.match && !this.match.finished && this.$('mg-putters').classList.contains('show') === false) this.putterTab = this.match.current;
    }
    const duo = this.putterDuo;
    const tab = this.putterTab;
    const names =
      this.match && this.match.players.length > 1
        ? this.match.players.map((p) => p.name)
        : [this.save.names[0] || 'Jogador 1', this.save.names[1] || 'Jogador 2'];
    const tabs = this.$('mg-putter-tabs');
    tabs.innerHTML = duo
      ? names
          .slice(0, 2)
          .map((n, i) => `<button class="mg-ptab${i === tab ? ' on' : ''}" data-i="${i}" style="--pc:${PLAYER_COLORS[i]}"><span></span>${escapeHtml(n)} · ${escapeHtml(this.skinFor(i).name)}</button>`)
          .join('')
      : '';
    tabs.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        this.putterTab = Number(b.dataset.i);
        this.showPutters(undefined, true);
      }),
    );
    const grid = this.$('mg-putter-grid');
    grid.innerHTML = '';
    const list: PutterSkin[] = [customPutter(this.customs[tab]), ...PUTTERS];
    for (const p of list) {
      const free = isPutterAvailable(p);
      const sel = p.id === this.putterSel[tab];
      const card = document.createElement('div');
      card.className = `mg-putter${sel ? ' sel' : ''}${p.tier === 'premium' ? ' premium' : ''}`;
      const tag = tierTag(`golf.putter.${p.id}`);
      card.innerHTML = `<div class="mg-putter-head"><b>${escapeHtml(p.name)}</b><span class="mg-tier ${p.tier}">${tag}</span></div><canvas></canvas><small>${escapeHtml(p.description)}</small>`;
      const btn = document.createElement('button');
      btn.textContent = sel ? 'Em uso ✓' : free ? 'Usar este taco' : '';
      btn.disabled = sel || !free;
      wireLocked(btn, `golf.putter.${p.id}`, () => this.showPutters(undefined, true));
      if (free && !sel)
        btn.addEventListener('click', () => {
          this.putterSel[tab] = p.id;
          this.savePutters();
          this.showPutters(undefined, true);
        });
      card.appendChild(btn);
      grid.appendChild(card);
      this.paintPutterCard(card.querySelector('canvas')!, p);
    }
    // editor do personalizado
    const ed = this.$('mg-putter-custom');
    const c = this.customs[tab];
    const sw = (kind: 'head' | 'grip', cols: string[]) =>
      cols.map((col) => `<button class="mg-sw${c[kind] === col ? ' on' : ''}" data-k="${kind}" data-v="${col}" style="--c:${col}" aria-label="Cor ${col}"></button>`).join('');
    ed.innerHTML = `<h3>Personalizar o seu taco</h3>
      <div class="mg-crow"><span>Cabeça</span><div>${sw('head', CUSTOM_HEADS)}</div></div>
      <div class="mg-crow"><span>Haste</span><div>${CUSTOM_SHAFTS.map((h) => `<button class="mg-chipbtn${c.shaft === h.id ? ' on' : ''}" data-k="shaft" data-v="${h.id}">${h.name}</button>`).join('')}</div></div>
      <div class="mg-crow"><span>Punho</span><div>${sw('grip', CUSTOM_GRIPS)}</div></div>`;
    ed.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as keyof PutterCustom;
        this.customs[tab] = { ...this.customs[tab], [k]: b.dataset.v! };
        this.putterSel[tab] = 'custom';
        this.savePutters();
        this.showPutters(undefined, true);
      }),
    );
    this.show('mg-putters');
  }

  private renderTrails() {
    mountBurstToggle(this.$('mg-fx-toggle-host'), 'a bola cai no buraco');
    const grid = this.$('mg-trail-grid');
    grid.innerHTML = '';
    const cur = usableTrail(this.save.trail, 'sombra');
    for (const t of TRAILS) {
      const free = isTrailAvailable(t);
      const sel = t.id === cur;
      const card = document.createElement('div');
      card.className = `mg-putter mg-course${sel ? ' sel' : ''}${t.tier === 'premium' ? ' premium' : ''}`;
      card.innerHTML = `<div class="mg-putter-head"><b>${escapeHtml(t.name)}</b><span class="mg-tier ${t.tier}">${tierTag(`fx.trail.${t.id}`)}</span></div><canvas></canvas><small>${escapeHtml(t.description)}</small>`;
      const btn = document.createElement('button');
      btn.textContent = sel ? 'Em uso ✓' : free ? 'Usar este rastro' : '';
      btn.disabled = sel || !free;
      wireLocked(btn, `fx.trail.${t.id}`, () => this.renderTrails());
      if (free && !sel)
        btn.addEventListener('click', () => {
          this.save.trail = t.id;
          golfStore.save(this.save);
          this.renderTrails();
        });
      card.appendChild(btn);
      grid.appendChild(card);
      const cv = card.querySelector('canvas')!;
      requestAnimationFrame(() => paintTrailPreview(cv, t.id, courseById(this.save.course).grass[0]));
    }
  }

  private renderCourses() {
    const grid = this.$('mg-course-grid');
    grid.innerHTML = '';
    const cur = courseById(this.save.course);
    for (const t of COURSE_THEMES) {
      const free = isCourseAvailable(t);
      const sel = t.id === cur.id;
      const card = document.createElement('div');
      card.className = `mg-putter mg-course${sel ? ' sel' : ''}${t.tier === 'premium' ? ' premium' : ''}`;
      card.innerHTML = `<div class="mg-putter-head"><b>${escapeHtml(t.name)}</b><span class="mg-tier ${t.tier}">${tierTag(`golf.course.${t.id}`)}</span></div><canvas></canvas><small>${escapeHtml(t.description)}</small>`;
      const btn = document.createElement('button');
      btn.textContent = sel ? 'Em uso ✓' : free ? 'Usar este campo' : '';
      btn.disabled = sel || !free;
      wireLocked(btn, `golf.course.${t.id}`, () => this.renderCourses());
      if (free && !sel)
        btn.addEventListener('click', () => {
          this.save.course = t.id;
          golfStore.save(this.save);
          this.renderer.setTheme(t);
          this.renderCourses();
        });
      card.appendChild(btn);
      grid.appendChild(card);
      const cv = card.querySelector('canvas')!;
      requestAnimationFrame(() => paintCoursePreview(cv, t));
    }
  }

  private paintPutterCard(cv: HTMLCanvasElement, p: PutterSkin) {
    requestAnimationFrame(() => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = cv.clientWidth || 200;
      const h = cv.clientHeight || 56;
      cv.width = w * dpr;
      cv.height = h * dpr;
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const unit = h / 9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.55, unit * 0.9, 0, Math.PI * 2);
      ctx.fill();
      paintPutter(ctx, p, w * 0.78, h * 0.55, 0, unit * 1.4, unit);
    });
  }

  private renderMenu() {
    const s = this.save;
    this.$('mg-best').textContent =
      s.bestTotal !== null ? `Recorde em 9 buracos: ${s.bestTotal} tacadas (${s.rounds} rodada${s.rounds === 1 ? '' : 's'})` : 'Ainda sem recorde neste aparelho.';
  }

  private toMenu() {
    this.match = null;
    this.world = null;
    this.phase = 'menu';
    this.paused = false;
    this.hideAll();
    this.renderMenu();
    this.show('mg-menu');
    this.updateHUD();
  }

  private pause() {
    if (!this.match || this.phase === 'menu') return;
    this.paused = true;
    for (const cancel of this.inputCleanups) cancel();
    this.show('mg-pausebox');
  }

  private resume() {
    this.paused = false;
    this.last = performance.now();
    this.hide('mg-pausebox');
  }

  private confirm(msg: string, yes: () => void) {
    const wasPaused = this.paused;
    this.paused = true;
    this.$('mg-confirm-msg').textContent = msg;
    this.show('mg-confirm');
    const y = this.$('mg-confirm-yes');
    const n = this.$('mg-confirm-no');
    const done = () => {
      this.hide('mg-confirm');
      y.onclick = null;
      n.onclick = null;
    };
    y.onclick = () => {
      done();
      this.paused = wasPaused;
      this.last = performance.now();
      yes();
    };
    n.onclick = () => {
      done();
      this.paused = wasPaused || document.hidden;
      this.last = performance.now();
      if (document.hidden) this.pause();
    };
  }

  private show(id: string) {
    if (!this.disposed) this.$(id).classList.add('show');
  }
  private hide(id: string) {
    if (!this.disposed) this.$(id).classList.remove('show');
  }
  private hideAll() {
    this.root.querySelectorAll('.mg-overlay').forEach((o) => o.classList.remove('show'));
  }

  private toast(msg: string, bad = false, ms = 2800) {
    const t = this.$('mg-toast');
    t.textContent = msg;
    t.classList.toggle('bad', bad);
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
  }

  setPower(p: number) {
    this.power = Math.min(1, Math.max(0, p));
    const bar = this.$('mg-power');
    this.$('mg-pct').textContent = `${Math.round(this.power * 100)}%`;
    bar.setAttribute('aria-valuenow', String(Math.round(this.power * 100)));
    bar.classList.toggle('pulling', this.pulling && this.power > 0);
    this.gauge?.set(this.power, this.pulling && this.power > 0);
  }

  /** O taco da barra volta ao topo; com `fired`, disparo, clarão e vibração da tacada. */
  private snapPutter(fired: boolean) {
    this.pulling = false;
    this.$('mg-power').classList.remove('pulling');
    if (fired) {
      this.gauge?.fire();
      try {
        navigator.vibrate?.(18);
      } catch {
        /* sem vibração */
      }
    } else this.gauge?.cancel();
    this.power = 0;
    this.$('mg-pct').textContent = '0%';
  }

  /** Desenha o taco escolhido, de pé, na barra lateral. */
  private drawSidePutter(force = true) {
    const skin = this.putter;
    const key = JSON.stringify(skin);
    if (!force && key === this.sideKey) return;
    this.sideKey = key;
    // cabeça no topo, haste descendo
    this.gauge?.setTool((ctx, w, h) => paintPutterVertical(ctx, skin, w / 2, 4, h - 6, w / 2.9));
  }

  private paintSound() {
    const on = this.save.sound;
    this.$('mg-sound').innerHTML = on
      ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm18.6 6.2-1.4 1.4L17 13.4l-3.2 3.2-1.4-1.4 3.2-3.2-3.2-3.2 1.4-1.4 3.2 3.2 3.2-3.2 1.4 1.4-3.2 3.2z"/></svg>';
    this.$('mg-sound').setAttribute('aria-pressed', String(on));
  }

  private updateHUD() {
    const m = this.match;
    setTurnColor(this.root, m && !m.finished ? m.current : null);
    this.drawSidePutter(false);
    const lv = this.level;
    this.$('mg-hole-label').textContent = m ? `${T('Buraco', 'Hole')} ${m.holeIdx + 1}/${m.holes.length} · ${T(lv.name, LEVEL_EN[lv.name]?.[0] ?? lv.name)}` : T('Escolha a modalidade', 'Choose a mode');
    this.$('mg-par').textContent = String(lv.par);
    this.$('mg-strokes').textContent = m ? String(m.ph[m.current]?.strokes ?? 0) : '0';
    const pl = this.$('mg-players');
    pl.innerHTML = m
      ? m.players
          .map((p, i) => {
            const tot = p.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
            const on = m.players.length > 1 && i === m.current && !holeComplete(m);
            return `<div class="mg-pl${on || m.players.length === 1 ? ' on' : ''}" style="--c:${PLAYER_COLORS[i]}"><i></i>${escapeHtml(p.name)}<em>${tot}</em></div>`;
          })
          .join('')
      : '';
    this.gauge?.setLocked(!this.canAim() && !this.pulling);
  }

  private layout() {
    const wrap = this.$('mg-canvas-wrap');
    this.renderer.resize(wrap.clientWidth, wrap.clientHeight, this.level);
    this.setPower(this.power);
    this.drawSidePutter();
  }

  // ------------------------------------------------------------------ laço
  private frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const w = this.world;
    if (w && !this.paused) {
      if (this.swing) {
        this.swing.t += dt;
        if (this.swing.t >= SWING_TIME) this.release();
      }
      if (this.follow) {
        this.follow.t += dt;
        if (this.follow.t > 0.35) this.follow = null;
      }
      this.acc += dt;
      let n = 0;
      while (this.acc >= GOLF.dt && n < 12) {
        const before = w.status;
        step(w);
        this.acc -= GOLF.dt;
        n++;
        for (; this.eventIdx < w.events.length; this.eventIdx++) {
          const e = w.events[this.eventIdx];
          if (e.type === 'wall') this.sfx.wall(e.speed);
          else if (e.type === 'lip') {
            this.sfx.lip();
            this.toast('Forte demais! A bola passou por cima do buraco.', false, 1800);
          }
        }
        if (before === 'moving' && w.status !== 'moving') {
          this.onShotEnd();
          break;
        }
      }
      if (this.acc > GOLF.dt * 4) this.acc = 0;
      if (this.phase === 'holing' || this.phase === 'out') {
        this.animT += dt;
        if (this.splash) this.splash.age = this.animT;
        if (this.animT > HOLE_ANIM) this.resolve(this.phase === 'holing' ? { kind: 'holed' } : { kind: 'out' });
      }
      this.stepParticles(dt);
      this.fx.update(dt);
    }
    if (w && this.match) {
      const m = this.match;
      const a = w.status === 'moving' ? this.acc / GOLF.dt : 1;
      const cx = w.px + (w.x - w.px) * a;
      const cy = w.py + (w.y - w.py) * a;
      // rolamento visual: gira a esfera pela distância percorrida (eixo perpendicular ao movimento)
      const cur = m.current;
      const last = this.visPos[cur];
      if (last) {
        const dx = cx - last.x;
        const dy = cy - last.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-6 && d < 5) this.ballQ[cur] = rotQ(this.ballQ[cur], dy / d, -dx / d, d / GOLF.ballR);
      }
      this.visPos[cur] = { x: cx, y: cy };
      if (w.status === 'moving') {
        this.trail.push(cx, cy, performance.now() / 1000);
      } else this.trail.prune(performance.now() / 1000);

      const holeT = this.phase === 'holing' ? Math.min(1, this.animT / HOLE_ANIM) : 0;
      const balls = m.players.map((_, i) => {
        const isCur = i === cur;
        const done = m.ph[i].done;
        let x = isCur ? cx : m.ph[i].pos.x;
        let y = isCur ? cy : m.ph[i].pos.y;
        let scale = 1;
        let dark = 0;
        if (isCur && this.phase === 'holing') {
          // escorrega para o centro do copo e afunda
          const e = 1 - (1 - Math.min(1, holeT * 1.6)) ** 2;
          x = w.x + (this.level.hole.x - w.x) * e;
          y = w.y + (this.level.hole.y - w.y) * e;
          scale = 1 - 0.6 * holeT;
          dark = 0.85 * holeT;
        }
        return {
          x,
          y,
          color: PLAYER_COLORS[i],
          active: isCur && this.phase === 'aim',
          scale,
          dark,
          q: this.ballQ[i],
          visible: isCur ? this.phase !== 'out' && !(this.phase === 'card' && done) && holeT < 1 : !done,
        };
      });
      let aim = null;
      if (this.canAim()) {
        const ray = aimRay(this.level, w, this.aimAngle, w.t, AIM_MAX);
        // prévia da tabela: só a direção de saída do 1º toque, num trecho curto (até o próximo obstáculo)
        let after: Vec | null = null;
        if (ray.bounce) {
          const back = aimRay(this.level, { x: ray.end.x + ray.bounce.x * 0.05, y: ray.end.y + ray.bounce.y * 0.05 }, Math.atan2(ray.bounce.y, ray.bounce.x), w.t, BOUNCE_PREVIEW);
          after = back.end;
        }
        aim = { from: { x: w.x, y: w.y }, to: ray.end, hit: ray.hit, after };
      }
      let putter = null;
      const R = GOLF.ballR;
      if (this.swing) {
        // descida acelerada do recuo até a bola
        const k = Math.min(1, this.swing.t / SWING_TIME);
        const pull = this.swing.power * (1 - k * k);
        putter = { skin: this.putter, angle: this.swing.angle, gap: R + 0.12 + pull * 3, x: w.x, y: w.y };
      } else if (this.follow) {
        // acompanhamento: o taco passa do ponto onde estava a bola e some
        const k = this.follow.t / 0.35;
        putter = { skin: this.putter, angle: this.follow.angle, gap: R + 0.12 - k * (1.2 + this.follow.power * 2.5), x: this.follow.x, y: this.follow.y };
      } else if (this.canAim()) {
        putter = { skin: this.putter, angle: this.aimAngle, gap: R + 0.12 + this.power * 3, x: w.x, y: w.y };
      }
      const trailId = usableTrail(this.save.trail, 'sombra');
      this.renderer.render({
        level: this.level,
        t: w.t,
        balls,
        aim,
        splash: this.splash,
        putter,
        trail: this.trail.pts.length > 1 && trailId !== 'nenhum' ? { id: trailId, pts: this.trail.pts, color: PLAYER_COLORS[cur] } : null,
        fx: this.fx,
        particles: this.particles,
      });
      this.gauge?.setLocked(!this.canAim() && !this.pulling);
    } else {
      this.renderer.render({ level: LEVELS[0], t: now / 1000, balls: [], aim: null, splash: null, putter: null, trail: null, particles: [] });
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Confete (buraco em uma) ou brilho curto (demais buracos). */
  private burst(x: number, y: number, big: boolean) {
    // efeito do tema do campo (Halloween: abóboras e caveiras); buraco em uma ganha confete por cima
    this.fx.burst(courseById(this.save.course).burst, x, y, GOLF.ballR);
    if (!big || !burstsEnabled()) return;
    const colors = ['#ffc93c', '#ff6b4a', '#3d8bff', '#7bd389', '#ffffff'];
    const n = 70;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 6 : 3) + Math.random() * (big ? 14 : 5);
      this.particles.push({ x, y, color: colors[i % colors.length], size: big ? 0.7 : 0.4, rot: a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (big ? 6 : 2), life: big ? 1.6 : 0.7 });
    }
  }

  private stepParticles(dt: number) {
    for (const p of this.particles) {
      p.vy += 18 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 8;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  /** Gancho para QA automatizado. */
  debug() {
    return { match: this.match, world: this.world, phase: this.phase, level: this.level, findShot };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Gira o quatérnio q em torno do eixo (ax, ay, 0) pelo ângulo ang. */
function rotQ(q: [number, number, number, number], ax: number, ay: number, ang: number): [number, number, number, number] {
  const s = Math.sin(ang / 2);
  const rw = Math.cos(ang / 2);
  const rx = ax * s;
  const ry = ay * s;
  const [w, x, y, z] = q;
  const nw = rw * w - rx * x - ry * y;
  const nx = rw * x + rx * w + ry * z;
  const ny = rw * y + ry * w - rx * z;
  const nz = rw * z + rx * y - ry * x;
  const l = Math.hypot(nw, nx, ny, nz) || 1;
  return [nw / l, nx / l, ny / l, nz / l];
}

/** Miniatura do campo: mar, areia, parede, gramado com faixas e o buraco com bandeira. */
function paintCoursePreview(cv: HTMLCanvasElement, t: CourseTheme) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 200;
  const h = cv.clientHeight || 100;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sea = ctx.createLinearGradient(0, 0, 0, h);
  t.sea.forEach((c, i) => sea.addColorStop(i / 2, c));
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, w, h);
  const g = { x: w * 0.12, y: h * 0.28, w: w * 0.76, h: h * 0.44 };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = t.shore[1];
  ctx.lineWidth = h * 0.14;
  ctx.strokeRect(g.x, g.y, g.w, g.h);
  ctx.strokeStyle = t.wall[0];
  ctx.lineWidth = h * 0.05;
  ctx.strokeRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = t.grass[0];
  ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = t.grass[1];
  for (let x = g.x; x < g.x + g.w; x += 16) ctx.fillRect(x, g.y, 8, g.h);
  ctx.fillStyle = t.block[1];
  ctx.fillRect(g.x + g.w * 0.48, g.y + g.h * 0.2, g.w * 0.06, g.h * 0.6);
  ctx.fillStyle = '#0d1a10';
  ctx.beginPath();
  ctx.arc(g.x + g.w * 0.85, g.y + g.h / 2, h * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(g.x + g.w * 0.85, g.y + g.h / 2);
  ctx.lineTo(g.x + g.w * 0.85, g.y + g.h * 0.05);
  ctx.stroke();
  ctx.fillStyle = '#e8343a';
  ctx.beginPath();
  ctx.moveTo(g.x + g.w * 0.85, g.y + g.h * 0.05);
  ctx.lineTo(g.x + g.w * 0.85 + h * 0.12, g.y + g.h * 0.12);
  ctx.lineTo(g.x + g.w * 0.85, g.y + g.h * 0.2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(g.x + g.w * 0.15, g.y + g.h / 2, h * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

/** Prévia do rastro sobre a grama do campo em uso, com a bola no fim. */
function paintTrailPreview(cv: HTMLCanvasElement, id: TrailId, grass: string) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 160;
  const h = cv.clientHeight || 80;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, w, h);
  const u = h * 0.1;
  const pts = Array.from({ length: 18 }, (_, i) => {
    const k = i / 17;
    return { x: w * (0.1 + 0.7 * k), y: h * (0.65 - 0.3 * Math.sin(k * Math.PI)) };
  });
  drawTrail(ctx, id, pts, u, PLAYER_COLORS[0], 0.6);
  const b = pts[pts.length - 1];
  ctx.fillStyle = PLAYER_COLORS[0];
  ctx.beginPath();
  ctx.arc(b.x, b.y, u, 0, Math.PI * 2);
  ctx.fill();
}
