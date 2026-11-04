import { enterGameFullscreen, exitGameFullscreen } from '../../shared/fullscreen';
import { onMountRollback } from '../../shared/lifecycle';
import { isEn, T } from '../../../i18n/lang';
import { newMatchId, reportMatch } from '../../../services/match';
import { mountBalance, tierTag, wireLocked } from '../../shared/shopUi';
import { chooseAIShot, makeRng } from '../ai/ai';
import { GameController } from '../game/controller';
import { ballIcon } from '../game/ballSprite';
import type { PocketAnim } from '../game/pocketFx';
import { cueById, CUES, CueSkin, DEFAULT_CUE, isCueAvailable, paintCue } from '../game/cues';
import { Renderer } from '../game/renderer';
import { isTableAvailable, shadeHex, tableById, TABLE_THEMES, TableTheme } from '../game/tables';
import { Music } from '../../shared/music';
import { PowerGauge } from '../../shared/powerGauge';
import { mountMusicControl } from '../../shared/musicControl';
import { PLAYER_COLORS, setTurnColor } from '../../shared/players';
import { drawTrail, isTrailAvailable, mountBurstToggle, ParticleSystem, TrailBuffer, TRAILS, usableTrail } from '../../shared/fx';
import { Sound } from '../game/sound';
import { aimRaycast, objectBallPath, RayHit } from '../physics/raycast';
import { TABLE } from '../physics/table';
import { clampSpin, getBall, Spin } from '../physics/world';
import { Difficulty, groupBalls, legalTargets, Mode } from '../rules/rules';
import { loadPrefs, loadStats, Prefs, resetStats, savePrefs, saveStats } from '../storage/storage';
import { availableRooms } from '../../../services/online/supabaseRooms';
import { RoomLobby } from '../../../services/online/roomLobby';
import type { Room } from '../../../services/online/types';
import { applyState, encodeState, parsePoolState, PoolNetState } from '../online';

/** Online: tempo fixo da tacada (o servidor aceita o "tempo esgotado" de quem joga após 35 s e do outro após 55 s). */
const NET_SHOT_TIME = 45;
const NET_CLAIM_AFTER = 62;
/** Mira ao vivo (online): envio no máximo a cada 90 ms (~11/s), só quando muda; o outro suaviza entre as mensagens. */
const NET_AIM_EVERY = 90;
/** Sem mensagem nova por este tempo (ms), o outro aparelho esconde a mira remota (ex.: rede caiu). */
const NET_AIM_STALE = 4000;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** Quanto puxar o taco na mesa (m) para chegar a 100% de força. */
const STICK_PULL_RANGE = 0.42;
const DIFF_PT: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };
const DIFF_EN: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const DIFF_LABEL = new Proxy(DIFF_PT, { get: (o, k: Difficulty) => (isEn() ? DIFF_EN : o)[k] });

export class App {
  private game: GameController | null = null;
  private matchId: string | null = null;
  private renderer: Renderer;
  private sound = new Sound();
  private music = new Music();
  private musicCtl: { destroy(): void } | null = null;
  private prefs: Prefs = loadPrefs();
  private canvas = $<HTMLCanvasElement>('cv');

  private aimAngle = 0;
  private power = 0.35;
  private aimHit: RayHit | null = null;
  private paused = false;
  private inputCleanups: (() => void)[] = [];
  private acc = 0;
  private last = 0;
  private time = 0;
  private eventIdx = 0;
  private toastTimer = 0;

  // interação
  private dragging: 'none' | 'aim' | 'cue' | 'power' | 'stick' = 'none';
  /** Segurando o taco na mesa: ângulo/raio iniciais do dedo e se o toque pegou o taco (permite puxar). */
  private stick = { aim0: 0, phi0: 0, r0: 0, pull: false };
  /** Taco de cada jogador [J1, J2/IA]. */
  private cueSel: [string, string] = [DEFAULT_CUE, 'ebano'];
  private cueTab = 0;
  private sideKey = '';
  // animação do taco
  private strikeAnim: { t: number; angle: number; power: number; spin: Spin } | null = null;
  private spin: Spin = { side: 0, top: 0 };
  // IA
  private aiBusy = false;
  private aiAnim: { from: number; to: number; t: number; dur: number; onDone: () => void } | null = null;
  private rng = makeRng(Date.now() & 0xffffffff);
  private rotateDismissed = false;
  private pocketAnims: PocketAnim[] = [];
  private railOrder: number[] = [];
  private fxNow = 0;
  /** Rastro da branca e explosões de caçapa (só visual). */
  /** 0,35 s de rastro, amostra a cada 1 cm (independe do FPS). */
  private trailBuf = new TrailBuffer(0.35, 0.01);
  private fx = new ParticleSystem();
  private matchTime = 0;
  private turnLeft = 45;

  /** Remove todos os listeners globais de uma vez ao sair do jogo. */
  private ac = new AbortController();
  private disposed = false;
  private raf = 0;
  private onExit: (() => void) | null = null;
  private gauge = new PowerGauge($('pbar'));

  // online (sala privada)
  private net: RoomLobby | null = null;
  /** sala:rodada da partida carregada. */
  private netKey = '';
  /** Quantas jogadas da sala já estão na mesa (room.moves). */
  private netMoves = -1;
  /** Tacada do outro aparelho sendo repetida; no fim a mesa vira exatamente este estado. */
  private netReplay: PoolNetState | null = null;
  /** Minha tacada rolando: ao parar, envio o resultado. */
  private netMine = false;
  /** Resultado da minha tacada já enviado (calculado no instante do impulso). */
  private netPredicted: PoolNetState | null = null;
  /** Relógio local de quando vi a vez mudar (não depende do horário do servidor). */
  private netTurnSeen = 0;
  private netClaimed = -1;
  /** Mira do outro jogador recebida ao vivo (só para mostrar; ninguém aqui mexe nela). */
  private netAim: { mv: number; a: number; p: number; at: number } | null = null;
  /** Ângulo/força mostrados (suavizados em direção ao último recebido). */
  private netAimShown = { a: 0, p: 0 };
  private netAimSent = { t: 0, key: '' };
  /** Aviso da bola 8: uma vez por vez de jogar (chave = partida + tacada + jogador). */
  private call8Key = '';
  private call8Timer = 0;
  private netOverKey = '';
  /** QA: maior diferença (m) entre a repetição local e o estado enviado na última tacada recebida. */
  netLastDrift = 0;

  constructor(opts: { onExit?: () => void } = {}) {
    onMountRollback(() => this.dispose());
    // Online não pausa sozinho: o outro jogador continua, e no Android copiar o código (aviso do sistema) tirava o foco.
    window.addEventListener('blur', () => { if (!this.net?.active) this.pause(); }, { signal: this.ac.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !this.net?.active) this.pause(); }, { signal: this.ac.signal });
    this.onExit = opts.onExit ?? null;
    this.renderer = new Renderer(this.canvas, TABLE);
    const tt = tableById(this.prefs.table);
    this.renderer.setTheme(isTableAvailable(tt) ? tt : tableById(undefined));
    this.power = 0;
    this.sound.enabled = this.prefs.sound;
    this.music.volume = this.prefs.musicVolume;
    this.musicCtl = mountMusicControl($('music-slot'), this.music, { enabled: this.prefs.music, volume: this.prefs.musicVolume }, (mp) => {
      this.prefs.music = mp.enabled;
      this.prefs.musicVolume = mp.volume;
      savePrefs(this.prefs);
    });
    // a música só pode começar depois de um toque (regra de autoplay)
    const kick = () => {
      this.music.start();
      window.removeEventListener('pointerdown', kick, true);
      window.removeEventListener('keydown', kick, true);
    };
    window.addEventListener('pointerdown', kick, { capture: true, signal: this.ac.signal });
    window.addEventListener('keydown', kick, { capture: true, signal: this.ac.signal });
    const ids = this.prefs.cues ?? [this.prefs.cue, 'ebano'];
    this.cueSel = [0, 1].map((i) => (isCueAvailable(cueById(ids[i])) ? cueById(ids[i]).id : DEFAULT_CUE)) as [string, string];
    this.bindMenu();
    this.bindGameUI();
    this.bindInput();
    this.updateSoundIcon();
    this.setPower(this.power);
    window.addEventListener('resize', () => this.layout(), { signal: this.ac.signal });
    window.addEventListener('orientationchange', () => setTimeout(() => !this.disposed && this.layout(), 200), {
      signal: this.ac.signal,
    });
    $('btn-back-catalog').addEventListener('click', () => this.onExit?.());
    this.layout();
    this.renderMenuStats();
    this.raf = requestAnimationFrame((t) => this.frame(t));
    $('btn-play-online').addEventListener('click', () => { enterGameFullscreen(); this.net?.open(); }, { signal: this.ac.signal });
    void this.setupOnline();
  }

  /** Encerra o jogo: para o laço, a música, os sons, timers e remove listeners globais. */
  dispose(): void {
    exitGameFullscreen();
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ac.abort();
    for (const cancel of this.inputCleanups) cancel();
    this.cancelAI();
    clearTimeout(this.toastTimer);
    clearTimeout(this.call8Timer);
    this.net?.dispose();
    this.net = null;
    this.music?.dispose();
    this.musicCtl?.destroy();
    this.sound.dispose();
    this.gauge?.dispose();
    this.game = null;
  }

  // ---------------------------------------------------------------- menu
  private bindMenu() {
    $<HTMLInputElement>('in-name').value = this.prefs.playerName === 'Você' ? '' : this.prefs.playerName;
    $<HTMLInputElement>('in-p1').value = this.prefs.names[0] === 'Jogador 1' ? '' : this.prefs.names[0];
    $<HTMLInputElement>('in-p2').value = this.prefs.names[1] === 'Jogador 2' ? '' : this.prefs.names[1];
    const segBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#diff button'));
    const paintSeg = () =>
      segBtns.forEach((b) => {
        const on = b.dataset.d === this.prefs.difficulty;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
    segBtns.forEach((b) =>
      b.addEventListener('click', () => {
        this.prefs.difficulty = b.dataset.d as Difficulty;
        savePrefs(this.prefs);
        paintSeg();
      }),
    );
    paintSeg();
    $('btn-play-ai').addEventListener('click', () => {
      enterGameFullscreen();
      const n = $<HTMLInputElement>('in-name').value.trim() || T('Você', 'You');
      this.prefs.playerName = n;
      savePrefs(this.prefs);
      this.start('ai', [n, `${T('IA', 'AI')} (${DIFF_LABEL[this.prefs.difficulty]})`]);
    });
    $('btn-play-local').addEventListener('click', () => {
      enterGameFullscreen();
      const a = $<HTMLInputElement>('in-p1').value.trim() || 'Jogador 1';
      const b = $<HTMLInputElement>('in-p2').value.trim() || 'Jogador 2';
      this.prefs.names = [a, b];
      savePrefs(this.prefs);
      this.start('local', [a, b]);
    });
    $('btn-menu-help').addEventListener('click', () => this.show('help'));
    $('btn-menu-settings').addEventListener('click', () => {
      this.syncSettings();
      this.show('settings');
    });
    $('btn-help-close').addEventListener('click', () => this.hide('help'));
    $('btn-settings-close').addEventListener('click', () => this.hide('settings'));
    $<HTMLSelectElement>('opt-time').addEventListener('change', (e) => {
      this.prefs.shotTime = Number((e.target as HTMLSelectElement).value);
      savePrefs(this.prefs);
      this.turnLeft = this.prefs.shotTime || Infinity;
      this.updateTimerRing();
    });
    $<HTMLInputElement>('opt-sound').addEventListener('change', (e) => this.setSound((e.target as HTMLInputElement).checked));
    $<HTMLInputElement>('opt-guide').addEventListener('change', (e) => {
      this.prefs.guide = (e.target as HTMLInputElement).checked;
      savePrefs(this.prefs);
    });

    $('btn-reset-stats').addEventListener('click', () =>
      this.confirm('Apagar as estatísticas salvas neste aparelho?', () => {
        resetStats();
        this.renderMenuStats();
      }),
    );
    $('btn-rotate-ok').addEventListener('click', () => {
      this.rotateDismissed = true;
      this.hide('rotate');
    });
  }

  private renderMenuStats() {
    const s = loadStats();
    const parts = (['easy', 'medium', 'hard'] as Difficulty[]).map((d) => `${DIFF_LABEL[d]} ${s.ai[d].w}${T('V', 'W')}/${s.ai[d].l}${T('D', 'L')}`);
    const last = s.local[0];
    $('menu-stats').textContent =
      `${T('Contra a IA (neste aparelho)', 'Vs AI (this device)')}: ${parts.join(' · ')}` + (last ? ` — ${T('Última 2P', 'Last 2P')}: ${last.winner} ${T('venceu', 'won')} (${last.p1} × ${last.p2})` : '');
  }

  private start(mode: Mode, names: [string, string]) {
    this.sound.unlock();
    this.cancelAI();
    this.game = new GameController({ mode, difficulty: this.prefs.difficulty, names });
    this.matchId = newMatchId('sinuca');
    this.matchTime = 0;
    this.clearFx();
    this.prepareTurn();
    this.hideAll();
    this.paused = false;
    this.toast(mode === 'ai' ? T(`Você contra a IA (${DIFF_LABEL[this.prefs.difficulty]}). Sua abertura!`, `You vs the AI (${DIFF_LABEL[this.prefs.difficulty]}). Your break!`) : `${names[0]} ${T('abre a partida.', 'breaks.')}`);
    this.updateHUD();
  }

  // ----------------------------------------------------------- game UI
  private bindGameUI() {
    $('btn-home').addEventListener('click', () => {
      if (!this.game) return this.show('menu');
      this.confirm('Sair da partida e voltar ao menu? O progresso desta partida será perdido.', () => this.toMenu());
    });
    $('btn-sound').addEventListener('click', () => this.setSound(!this.sound.enabled));
    $('btn-help').addEventListener('click', () => this.show('help'));
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-pause-help').addEventListener('click', () => this.show('help'));
    for (const id of ['btn-menu-cues', 'btn-pause-cues'])
      $(id).addEventListener('click', () => {
        const g = this.game;
        this.cueTab = g && g.match.winner === null && id === 'btn-pause-cues' ? g.match.current : 0;
        this.renderCueList();
        this.show('cues');
      });
    mountBalance($('shop-bal'), this.ac.signal);
    $('btn-cues-close').addEventListener('click', () => {
      this.hide('cues');
      this.paintCuePicks();
    });
    for (const i of [0, 1])
      $(`btn-cue-p${i + 1}`).addEventListener('click', () => {
        this.cueTab = i;
        $('sec-cues').click();
        this.renderCueList();
        this.show('cues');
      });
    this.paintCuePicks();
    const sec = (which: 'cues' | 'table' | 'trail') => {
      for (const k of ['cues', 'table', 'trail'] as const) {
        $(`sec-${k}`).classList.toggle('on', k === which);
        $(`pane-${k}`).hidden = k !== which;
      }
      if (which === 'table') this.renderTableList();
      if (which === 'trail') this.renderTrailList();
    };
    $('sec-cues').addEventListener('click', () => sec('cues'));
    $('sec-table').addEventListener('click', () => sec('table'));
    $('sec-trail').addEventListener('click', () => sec('trail'));
    $('btn-pause-settings').addEventListener('click', () => {
      this.syncSettings();
      this.show('settings');
    });
    $('btn-restart').addEventListener('click', () =>
      this.confirm('Reiniciar a partida do zero?', () => {
        this.cancelAI();
        this.game!.reset(this.game!.match.breaker);
        this.matchTime = 0;
    this.clearFx();
        this.prepareTurn();
        this.resume();
        this.toast('Partida reiniciada.');
      }),
    );
    $('btn-to-menu').addEventListener('click', () =>
      this.confirm('Voltar ao menu? A partida atual será perdida.', () => this.toMenu()),
    );
    $('btn-rematch').addEventListener('click', () => {
      if (this.net?.active) {
        if (this.net.room?.status === 'closed') return this.netLeave();
        void this.net.rematch().catch((e) => this.toast(e instanceof Error ? e.message : String(e), true));
        return;
      }
      this.cancelAI();
      this.game!.rematch();
      this.matchTime = 0;
    this.clearFx();
      this.prepareTurn();
      this.hide('over');
      this.paused = false;
      const g = this.game!;
      this.toast(`Revanche! ${g.match.players[g.match.current].name} abre.`);
    });
    $('btn-over-new').addEventListener('click', () => this.toMenu());
    $('btn-over-menu').addEventListener('click', () => (this.net?.active ? this.netLeave() : this.onExit?.()));

    // ajuste fino com repetição ao segurar
    const hold = (id: string, dir: number) => {
      const el = $(id);
      let timer = 0;
      let n = 0;
      const tick = () => {
        if (this.humanCanAim()) this.aimAngle += dir * (n < 8 ? 0.1 : n < 25 ? 0.3 : 0.9) * (Math.PI / 180);
        n++;
        timer = window.setTimeout(tick, n === 1 ? 300 : 40);
      };
      const stop = () => {
        clearTimeout(timer);
        n = 0;
      };
      this.inputCleanups.push(stop);
      this.ac.signal.addEventListener('abort', stop, { once: true });
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        tick();
      });
      el.addEventListener('pointerup', stop);
      el.addEventListener('pointerleave', stop);
      el.addEventListener('pointercancel', stop);
    };
    hold('btn-rot-l', -1);
    hold('btn-rot-r', 1);

    // efeito: escolher o ponto de batida na branca
    $('btn-spin').addEventListener('click', () => {
      if (!this.humanCanAim()) return;
      this.setSpin(this.spin);
      this.show('spin');
    });
    $('btn-spin-ok').addEventListener('click', () => this.hide('spin'));
    $('btn-spin-center').addEventListener('click', () => this.setSpin({ side: 0, top: 0 }));
    const sb = $('spin-ball');
    const fromPointer = (e: PointerEvent) => {
      const r = sb.getBoundingClientRect();
      const side = ((e.clientX - r.left) / r.width) * 2 - 1;
      const top = -(((e.clientY - r.top) / r.height) * 2 - 1);
      // a borda útil fica a 80% do raio desenhado
      this.setSpin({ side: side / 0.8, top: top / 0.8 });
    };
    sb.addEventListener('pointerdown', (e) => {
      sb.setPointerCapture(e.pointerId);
      fromPointer(e);
    });
    sb.addEventListener('pointermove', (e) => {
      if (sb.hasPointerCapture(e.pointerId)) fromPointer(e);
    });

    // taco lateral: puxe para baixo (força) e solte para tacar
    const bar = $('pbar');
    let startY = 0;
    const travel = () => bar.clientHeight * 0.62;
    bar.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      if (!this.humanCanAim()) return;
      bar.setPointerCapture(e.pointerId);
      this.dragging = 'power';
      startY = e.clientY;
            bar.classList.add('pulling');
      this.setPower(0);
    });
    bar.addEventListener('pointermove', (e) => {
      if (this.dragging === 'power') this.setPower((e.clientY - startY) / travel());
    });
    const release = (fire: boolean) => {
      if (this.dragging !== 'power') return;
      this.dragging = 'none';
      bar.classList.remove('pulling');
      if (fire && this.power >= 0.03) this.humanShoot();
      else {
        this.snapCue();
        if (fire) this.toast('Tacada cancelada.');
      }
    };
    bar.addEventListener('pointerup', () => release(true));
    bar.addEventListener('pointercancel', () => release(false));
    this.inputCleanups.push(() => release(false));
    bar.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.humanCanAim()) this.setPower(this.power + Math.sign(e.deltaY) * 0.02);
    });
  }

  private bindInput() {
    const c = this.canvas;
    const toWorld = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return this.renderer.toWorld(e.clientX - r.left, e.clientY - r.top);
    };
    c.addEventListener('pointerdown', (e) => {
      this.sound.unlock();
      const g = this.game;
      if (!g || !this.humanCanAim()) return;
      const p = toWorld(e);
      c.setPointerCapture(e.pointerId);
      const R = g.world.params.ballRadius;
      const touchR = Math.max(R * 2.6, 26 / this.renderer.scale);
      const cue = g.cue;
      if (g.match.ballInHand !== 'none' && Math.hypot(p.x - cue.x, p.y - cue.y) < touchR) {
        this.dragging = 'cue';
        return;
      }
      if (g.needsCall()) {
        const pk = g.world.table.pockets.find((k) => Math.hypot(k.center.x - p.x, k.center.y - p.y) < Math.max(0.11, 30 / this.renderer.scale));
        if (pk) {
          g.callPocket(pk.id);
          this.toast(`Bola 8 cantada na caçapa ${pocketName(pk.id)}.`);
          this.updateHUD();
          this.dragging = 'none';
          return;
        }
      }
      // Atrás da branca = mexer no taco (gira em volta da bola; puxar para trás dá força; soltar taca).
      // À frente da branca = mirar direto no ponto tocado.
      const dx = Math.cos(this.aimAngle);
      const dy = Math.sin(this.aimAngle);
      const rx = p.x - cue.x;
      const ry = p.y - cue.y;
      const along = rx * dx + ry * dy;
      const perp = Math.abs(rx * dy - ry * dx);
      if (along < -R * 0.6) {
        this.dragging = 'stick';
        this.stick = {
          aim0: this.aimAngle,
          phi0: Math.atan2(ry, rx),
          r0: Math.hypot(rx, ry),
          pull: perp <= Math.max(0.07, 34 / this.renderer.scale) && -along <= 1.7,
        };
        if (this.stick.pull) {
                    this.setPower(0);
        }
        return;
      }
      this.dragging = 'aim';
      this.aimAt(p);
    });
    c.addEventListener('pointermove', (e) => {
      const g = this.game;
      if (!g || !this.humanCanAim()) return;
      const p = toWorld(e);
      if (this.dragging === 'aim') this.aimAt(p);
      else if (this.dragging === 'cue') this.moveCue(p.x, p.y);
      else if (this.dragging === 'stick') this.dragStick(p);
    });
    const end = () => {
      const was = this.dragging;
      this.dragging = 'none';
      if (was === 'stick' && this.stick.pull) {
        if (this.power >= 0.03) this.humanShoot();
        else this.snapCue();
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', () => {
      if (this.dragging === 'stick') this.snapCue();
      this.dragging = 'none';
    });
    this.inputCleanups.push(() => { if (this.dragging === 'stick') this.snapCue(); this.dragging = 'none'; });

    window.addEventListener(
      'keydown',
      (e) => {
      if (!this.game || document.querySelector('.overlay.show')) {
        if (e.key === 'Escape' && this.paused) this.resume();
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') return this.pause();
      if (!this.humanCanAim()) return;
      const step = (e.shiftKey ? 0.1 : 1) * (Math.PI / 180);
      if (e.key === 'ArrowLeft') this.aimAngle -= step;
      else if (e.key === 'ArrowRight') this.aimAngle += step;
      else if (e.key === 'ArrowDown') this.setPower(this.power + 0.02);
      else if (e.key === 'ArrowUp') this.setPower(this.power - 0.02);
      else if (e.key === ' ' || e.key === 'Enter') this.humanShoot();
      else return;
      e.preventDefault();
      },
      { signal: this.ac.signal },
    );
  }

  /** Taco seguro pelo dedo: rotação relativa em volta da branca e, se pegou o taco, puxada = força. */
  private dragStick(p: { x: number; y: number }) {
    const g = this.game!;
    const cue = g.cue;
    const rx = p.x - cue.x;
    const ry = p.y - cue.y;
    const r = Math.hypot(rx, ry);
    // Enquanto puxa o taco (força > 4%) a direção trava, para a puxada não desviar a mira.
    const locked = this.stick.pull && this.power > 0.04;
    if (!locked && r > g.world.params.ballRadius * 1.5) {
      let dphi = Math.atan2(ry, rx) - this.stick.phi0;
      while (dphi > Math.PI) dphi -= 2 * Math.PI;
      while (dphi < -Math.PI) dphi += 2 * Math.PI;
      this.aimAngle = this.stick.aim0 + dphi;
    }
    if (this.stick.pull) this.setPower((r - this.stick.r0) / STICK_PULL_RANGE);
  }

  private aimAt(p: { x: number; y: number }) {
    const cue = this.game!.cue;
    const R = this.game!.world.params.ballRadius;
    if (Math.hypot(p.x - cue.x, p.y - cue.y) < R * 1.2) return;
    this.aimAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
  }

  private moveCue(x: number, y: number) {
    const g = this.game!;
    // tenta a posição exata; se inválida, mantém a branca onde estava (feedback vermelho no render)
    if (!g.placeCue(x, y)) {
      const R = g.world.params.ballRadius;
      const maxX = g.maxCueX();
      const cx = Math.min(Math.max(x, R), (maxX ?? g.world.table.length) - R);
      const cy = Math.min(Math.max(y, R), g.world.table.width - R);
      g.placeCue(cx, cy);
    }
  }

  private setPower(p: number) {
    this.power = Math.min(1, Math.max(0, p));
    const pct = Math.round(this.power * 100);
    $('pval').textContent = `${pct}%`;
    const bar = $('pbar');
    bar.setAttribute('aria-valuenow', String(pct));
    const pulling = this.power > 0 && (this.dragging === 'power' || this.dragging === 'stick');
    bar.classList.toggle('pulling', pulling);
    this.gauge.set(this.power, pulling);
  }

  private skinFor(i: number): CueSkin {
    const c = cueById(this.cueSel[i]);
    return isCueAvailable(c) ? c : cueById(DEFAULT_CUE);
  }

  /** Taco de quem está jogando agora (fora de partida: Jogador 1). */
  private get cueSkin(): CueSkin {
    const g = this.game;
    return this.skinFor(g && g.match.winner === null ? g.match.current : 0);
  }

  /** Desenha o taco de quem joga na barra lateral (vertical, ponta para cima). */
  private drawSideCue(force = true) {
    const skin = this.cueSkin;
    if (!force && skin.id === this.sideKey) return;
    this.sideKey = skin.id;
    this.gauge.setTool((ctx, w, h) => paintCue(ctx, skin, w / 2, 1, 0, 1, h - 2, w * 0.22, w * 0.46, 1));
  }

  /** Rótulos "Taco J1/J2" no cartão de 2 jogadores. */
  private paintCuePicks() {
    for (const i of [0, 1]) $(`btn-cue-p${i + 1}`).innerHTML = `${T('Taco J', 'Cue P')}${i + 1}: <b>${this.skinFor(i).name}</b> ▸`;
  }

  private renderCueList() {
    const g = this.game;
    const ai = g ? g.match.mode === 'ai' : false;
    const names = g ? g.match.players.map((p) => p.name) : [this.prefs.names[0] || 'Jogador 1', this.prefs.names[1] || 'Jogador 2'];
    const tab = this.cueTab;
    const tabs = $('cue-tabs');
    tabs.innerHTML = [0, 1]
      .map((i) => `<button class="cue-tab${i === tab ? ' on' : ''}" data-i="${i}" style="--pc:${PLAYER_COLORS[i]}"><span></span>${i === 1 && ai ? 'IA' : names[i]} · ${this.skinFor(i).name}</button>`)
      .join('');
    tabs.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        this.cueTab = Number(b.dataset.i);
        this.renderCueList();
      }),
    );
    const list = $('cue-list');
    list.innerHTML = '';
    for (const c of CUES) {
      const card = document.createElement('div');
      const free = isCueAvailable(c);
      const sel = c.id === this.cueSel[tab];
      card.className = `cue-card${sel ? ' sel' : ''}${free ? '' : ' locked'}${c.tier === 'premium' ? ' premium' : ''}`;
      card.innerHTML = `<div class="cue-head"><b>${c.name}</b><span class="tier ${c.tier}">${tierTag(`pool.cue.${c.id}`)}</span></div>
        <canvas></canvas><span class="cue-desc">${c.description}</span>`;
      const btn = document.createElement('button');
      btn.textContent = sel ? 'Em uso ✓' : free ? 'Usar este taco' : '';
      btn.disabled = sel || !free;
      wireLocked(btn, `pool.cue.${c.id}`, () => this.renderCueList());
      if (free && !sel)
        btn.addEventListener('click', () => {
          this.cueSel[tab] = c.id;
          this.prefs.cues = [...this.cueSel];
          this.prefs.cue = this.cueSel[0];
          savePrefs(this.prefs);
          this.drawSideCue();
          this.renderCueList();
        });
      card.appendChild(btn);
      list.appendChild(card);
      const cv = card.querySelector('canvas')!;
      requestAnimationFrame(() => {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        const w = cv.clientWidth || 240;
        const h = cv.clientHeight || 26;
        cv.width = w * dpr;
        cv.height = h * dpr;
        const ctx = cv.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // horizontal, ponta à direita
        paintCue(ctx, c, w - 4, h / 2, -1, 0, w - 8, h * 0.13, h * 0.3, 1);
      });
    }
  }

  private renderTrailList() {
    mountBurstToggle($('fx-toggle-host'), 'a bola cai na caçapa');
    const list = $('trail-list');
    list.innerHTML = '';
    const cur = usableTrail(this.prefs.trail, 'nenhum');
    for (const t of TRAILS) {
      const free = isTrailAvailable(t);
      const sel = t.id === cur;
      const card = document.createElement('div');
      card.className = `table-card${sel ? ' sel' : ''}`;
      card.innerHTML = `<div class="cue-head"><b>${t.name}</b><span class="tier ${t.tier}">${tierTag(`fx.trail.${t.id}`)}</span></div><canvas></canvas><span class="cue-desc">${t.description}</span>`;
      const btn = document.createElement('button');
      btn.textContent = sel ? 'Em uso ✓' : free ? 'Usar este rastro' : '';
      btn.disabled = sel || !free;
      wireLocked(btn, `fx.trail.${t.id}`, () => this.renderTrailList());
      if (free && !sel)
        btn.addEventListener('click', () => {
          this.prefs.trail = t.id;
          savePrefs(this.prefs);
          this.renderTrailList();
        });
      card.appendChild(btn);
      list.appendChild(card);
      const cv = card.querySelector('canvas')!;
      requestAnimationFrame(() => paintTrailPreview(cv, t.id, tableById(this.prefs.table).cloth[1]));
    }
  }

  private renderTableList() {
    const list = $('table-list');
    list.innerHTML = '';
    const cur = tableById(this.prefs.table);
    for (const t of TABLE_THEMES) {
      const free = isTableAvailable(t);
      const sel = t.id === cur.id;
      const card = document.createElement('div');
      card.className = `table-card${sel ? ' sel' : ''}`;
      card.innerHTML = `<div class="cue-head"><b>${t.name}</b><span class="tier ${t.tier}">${tierTag(`pool.table.${t.id}`)}</span></div><canvas></canvas><span class="cue-desc">${t.description}</span>`;
      const btn = document.createElement('button');
      btn.textContent = sel ? 'Em uso ✓' : free ? 'Usar esta mesa' : '';
      btn.disabled = sel || !free;
      wireLocked(btn, `pool.table.${t.id}`, () => this.renderTableList());
      if (free && !sel)
        btn.addEventListener('click', () => {
          this.prefs.table = t.id;
          savePrefs(this.prefs);
          this.renderer.setTheme(t);
          this.renderTableList();
        });
      card.appendChild(btn);
      list.appendChild(card);
      const cv = card.querySelector('canvas')!;
      requestAnimationFrame(() => paintTablePreview(cv, t));
    }
  }

  private setSpin(sp: Spin) {
    this.spin = clampSpin(sp);
    const { side, top } = this.spin;
    for (const [id, f] of [['spin-dot', 0.8], ['spin-mini-dot', 0.8]] as const) {
      const d = $(id);
      d.style.left = `${50 + side * f * 50}%`;
      d.style.top = `${50 - top * f * 50}%`;
    }
    const parts: string[] = [];
    if (top > 0.15) parts.push('alto (segue)');
    if (top < -0.15) parts.push('baixo (volta)');
    if (side > 0.15) parts.push('direita');
    if (side < -0.15) parts.push('esquerda');
    $('spin-desc').textContent = parts.length ? `Efeito: ${parts.join(' + ')}` : 'Sem efeito (centro)';
    $('btn-spin').classList.toggle('has-spin', parts.length > 0);
  }

  /** O taco da lateral volta ao topo (animado), como se batesse na branca. */
  private snapCue(fired = false) {
    $('pbar').classList.remove('pulling');
    if (fired) {
      this.gauge.fire();
      try {
        navigator.vibrate?.(18);
      } catch {
        /* vibração indisponível */
      }
    } else this.gauge.cancel();
    this.power = 0;
    $('pval').textContent = '0%';
  }

  private setSound(on: boolean) {
    this.sound.enabled = on;
    if (on) this.sound.unlock();
    this.prefs.sound = on;
    savePrefs(this.prefs);
    this.updateSoundIcon();
  }

  private syncSettings() {
    $<HTMLInputElement>('opt-sound').checked = this.sound.enabled;
    $<HTMLInputElement>('opt-guide').checked = this.prefs.guide;
    $('build-ver').textContent = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : 'dev';
    $<HTMLSelectElement>('opt-time').value = String(this.prefs.shotTime);
  }

  private updateSoundIcon() {
    $('btn-sound').innerHTML = this.sound.enabled
      ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9zm18.6 6.2-1.4 1.4L17 13.4l-3.2 3.2-1.4-1.4 3.2-3.2-3.2-3.2 1.4-1.4 3.2 3.2 3.2-3.2 1.4 1.4-3.2 3.2z"/></svg>';
    $('btn-sound').setAttribute('aria-pressed', String(this.sound.enabled));
  }

  // ---------------------------------------------------------- turns
  private humanCanAim(): boolean {
    const g = this.game;
    if (!g || this.paused || g.phase !== 'aiming' || g.currentIsAI() || this.strikeAnim || this.aiBusy) return false;
    if (this.net?.active) return !this.netMine && !this.netReplay && this.net.canMove() && this.net.player === g.match.current;
    return true;
  }

  /** Mira inicial razoável para o jogador da vez: na bola legal mais próxima. */
  private prepareTurn() {
    const g = this.game!;
    this.eventIdx = 0;
    const cue = g.cue;
    const targets = legalTargets(g.match, g.match.current, g.onTable());
    let best = Infinity;
    for (const id of targets) {
      const b = getBall(g.world, id)!;
      const d = Math.hypot(b.x - cue.x, b.y - cue.y);
      if (d < best) {
        best = d;
        this.aimAngle = Math.atan2(b.y - cue.y, b.x - cue.x);
      }
    }
    if (g.match.isBreak) this.aimAngle = Math.atan2(g.world.table.footSpot.y - cue.y, g.world.table.footSpot.x - cue.x);
    this.turnLeft = this.net?.active ? NET_SHOT_TIME : this.prefs.shotTime || Infinity;
    this.setSpin({ side: 0, top: 0 });
    this.updateHUD();
  }

  private humanShoot() {
    if (!this.humanCanAim()) return;
    const g = this.game!;
    if (g.needsCall() && g.match.calledPocket === null) {
      this.toast('Cante a caçapa da bola 8: toque em uma caçapa.', true);
      this.snapCue();
      return;
    }
    if (this.power < 0.01) {
      this.toast('Puxe o taco da lateral para baixo e solte.', true);
      return;
    }
    if (!g.canShoot()) {
      this.toast('Posição da branca inválida.', true);
      this.snapCue();
      return;
    }
    this.beginStrike(this.aimAngle, this.power, this.spin);
  }

  /** Animação curta do taco (~110 ms) e, ao final, UM único impulso. */
  private beginStrike(angle: number, power: number, spin: Spin = { side: 0, top: 0 }) {
    this.strikeAnim = { t: 0, angle, power, spin };
  }

  private fireStrike() {
    const s = this.strikeAnim!;
    this.strikeAnim = null;
    const g = this.game!;
    if (g.shoot(s.angle, s.power, s.spin)) {
      if (this.net?.active) {
        // online: calcula o fim da tacada agora e já envia; o outro aparelho começa a animar quase junto
        this.netMine = true;
        const done = g.predictOutcome();
        this.netPredicted = done ? encodeState(done, g.lastShot) : null;
        if (done) this.netSend('shot', done);
      }
      this.setSpin({ side: 0, top: 0 });
      this.snapCue(true);
      this.sound.cue(s.power);
      this.eventIdx = 0;
      this.updateHUD();
    }
  }

  private onShotResolved() {
    const g = this.game!;
    if (this.netReplay) {
      // tacada do outro aparelho: a verdade é o estado que ele enviou (drift = quanto a repetição local errou)
      this.netLastDrift = Math.max(0, ...this.netReplay.balls.map((nb) => {
        const b = g.world.balls.find((o) => o.id === nb.id)!;
        return nb.p !== (b.pocketed ? 1 : 0) ? Infinity : nb.p ? 0 : Math.hypot(nb.x - b.x, nb.y - b.y);
      }));
      applyState(g, this.netReplay, this.netNames());
      this.netReplay = null;
      this.railOrder = [...g.pocketOrder];
      if (g.match.lastFoul) this.sound.foul();
      this.toast(g.match.lastMessage, !!g.match.lastFoul);
      this.prepareTurn();
      this.netTurnSeen = performance.now();
      if (this.net?.room) this.netStatus(this.net.room);
      return;
    }
    if (this.netMine) {
      this.netMine = false;
      const sent = this.netPredicted;
      this.netPredicted = null;
      // a animação local deve bater com o que foi enviado; se não bater, vale o enviado
      if (sent) applyState(g, sent, this.netNames());
      else this.netSend('shot');
      this.railOrder = [...g.pocketOrder];
      if (g.match.lastFoul) this.sound.foul();
      this.toast(g.match.lastMessage, !!g.match.lastFoul);
      if (g.match.winner === null) this.prepareTurn();
      else this.updateHUD();
      this.netTurnSeen = performance.now();
      // se a jogada seguinte do outro chegou enquanto minha animação rodava, ela é aplicada agora
      if (sent && this.net?.room) this.remoteState(this.net.room);
      return;
    }
    // a canaleta segue a ordem oficial (a 8 recolocada na abertura sai dela)
    this.railOrder = [...g.pocketOrder];
    this.pocketAnims = this.pocketAnims.filter((a) => this.fxNow - a.t0 < 6);
    const res = g.lastResult!;
    if (res.foul) this.sound.foul();
    this.toast(res.state.lastMessage, !!res.foul);
    if (g.match.winner !== null) {
      this.finishMatch();
      return;
    }
    this.prepareTurn();
  }

  private finishMatch() {
    const g = this.game!;
    const m = g.match;
    const w = m.winner!;
    if (this.matchId) {
      // placar de sessão (2P local) + fichas; uma vez por partida
      reportMatch({ matchId: this.matchId, game: 'sinuca', mode: m.mode === 'ai' ? 'ai' : 'local', winner: w as 0 | 1, difficulty: m.mode === 'ai' ? m.difficulty : undefined });
      this.matchId = null;
    }
    const stats = loadStats();
    if (m.mode === 'ai') {
      const rec = stats.ai[m.difficulty];
      if (w === 0) rec.w++;
      else rec.l++;
      $('over-title').textContent = w === 0 ? 'Vitória!' : 'Derrota';
    } else {
      stats.local.unshift({ at: new Date().toISOString(), p1: m.players[0].name, p2: m.players[1].name, winner: m.players[w].name });
      stats.local = stats.local.slice(0, 20);
      $('over-title').textContent = `${m.players[w].name} venceu!`;
    }
    saveStats(stats);
    if (w === 0 || m.mode === 'local') this.sound.win();
    $('over-reason').textContent = m.winReason;
    this.updateHUD();
    setTimeout(() => this.show('over'), 900);
  }


  // ------------------------------------------------------------ online
  private async setupOnline() {
    const network = await availableRooms('pool');
    if (!network) return;
    if (this.disposed) { network.dispose(); return; }
    this.net?.dispose();
    const app = $('app');
    this.net = new RoomLobby(app.parentElement ?? app, network, (room) => this.remoteState(room), () => this.netEnded(), {
      title: T('Sinuca online', 'Online Pool'),
      savedKey: 'clashcade.pool.room.v1',
      overlayClass: 'overlay',
      boxClass: 'dialog',
      primaryClass: 'primary',
      placeBar: (bar) => $('msgbar').append(bar),
      live: (d) => this.netLiveIn(d),
    });
    $('online-card').hidden = false;
  }

  private netNames(): [string, string] {
    const r = this.net?.room;
    return r ? [r.host_name, r.guest_name || T('Aguardando J2', 'Waiting for P2')] : ['Jogador 1', 'Jogador 2'];
  }

  /** Estado novo da sala (resposta do servidor ou Realtime). */
  private remoteState(room: Room) {
    if (this.disposed) return;
    const names = this.netNames();
    const st = room.state === null ? null : parsePoolState(room.state);
    if (room.state !== null && !st) {
      this.toast(T('Estado online inválido; reconecte à sala.', 'Invalid online state; reconnect to the room.'), true);
      return;
    }
    const key = `${room.id}:${room.round}`;
    if (key !== this.netKey || !this.game) {
      // partida nova, revanche ou reconexão
      this.sound.unlock();
      this.cancelAI();
      this.hideAll();
      this.game = new GameController({ mode: 'local', names, breaker: room.first_player });
      this.matchId = null;
      this.matchTime = 0;
      this.clearFx();
      this.railOrder = [];
      this.netKey = key;
      this.netMoves = -1;
      this.netReplay = null;
      this.netMine = false;
      this.netPredicted = null;
      this.netOverKey = '';
      this.netAim = null;
      this.paused = false;
    }
    const g = this.game;
    g.match = { ...g.match, players: [{ ...g.match.players[0], name: names[0] }, { ...g.match.players[1], name: names[1] }] };
    if (room.moves > this.netMoves) {
      if (this.netMine) {
        // minha tacada ainda rolando: o que chegou é aplicado quando ela terminar (onShotResolved)
      } else {
        if (this.netReplay && g.phase === 'rolling') {
          // chegou a próxima jogada antes de terminar a animação: encaixa a anterior
          applyState(g, this.netReplay, names);
          this.netReplay = null;
        }
        if (st?.shot && this.netMoves >= 0 && room.moves === this.netMoves + 1 && g.phase === 'aiming') {
          this.netReplay = st;
          g.replayShot(st.shot);
          this.cancelAI();
          this.eventIdx = 0;
          this.sound.cue(Math.min(1, Math.hypot(st.shot.cue[0], st.shot.cue[1]) / 9));
        } else {
          const first = this.netMoves < 0;
          if (st) applyState(g, st, names);
          this.railOrder = [...g.pocketOrder];
          if (st && !first) this.toast(g.match.lastMessage, !!g.match.lastFoul);
          this.prepareTurn();
        }
        this.netMoves = room.moves;
        this.netAim = null;
        this.netTurnSeen = performance.now();
      }
    }
    this.updateHUD();
    this.netStatus(room);
  }

  /** Mira ao vivo: na minha vez, envia ângulo, força puxada e (com bola na mão) a posição da branca. */
  private netLiveOut() {
    const g = this.game;
    const net = this.net;
    if (!g || !net?.active || !this.humanCanAim()) return;
    const now = performance.now();
    if (now - this.netAimSent.t < NET_AIM_EVERY) return;
    const cb = g.cue;
    const hand = g.match.ballInHand !== 'none';
    const r = (n: number) => Math.round(n * 1e4) / 1e4;
    const d: Record<string, unknown> = { k: 'aim', mv: this.netMoves, a: r(this.aimAngle), p: r(this.power) };
    if (hand) { d.x = r(cb.x); d.y = r(cb.y); }
    const key = JSON.stringify(d);
    if (key === this.netAimSent.key) return;
    this.netAimSent = { t: now, key };
    net.sendLive(d);
  }

  /** Mira recebida do outro aparelho: só aceita do jogador da vez, desta mesma jogada, com números válidos. */
  private netLiveIn(d: Record<string, unknown>) {
    const g = this.game;
    const net = this.net;
    if (!g || !net?.active || d.k !== 'aim' || this.netReplay || this.netMine || g.phase !== 'aiming') return;
    const pl = d.pl, mv = d.mv, a = d.a, p = d.p;
    if (pl !== g.match.current || pl === net.player || mv !== this.netMoves) return;
    if (typeof a !== 'number' || !Number.isFinite(a) || Math.abs(a) > 100 || typeof p !== 'number' || !(p >= 0 && p <= 1)) return;
    if (!this.netAim) this.netAimShown = { a, p };
    this.netAim = { mv, a, p, at: performance.now() };
    const x = d.x, y = d.y;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) g.placeCue(x, y);
  }

  /** O outro jogador está mirando agora e eu recebo a mira dele? */
  private netAimVisible(): boolean {
    const g = this.game;
    const a = this.netAim;
    return !!g && !!this.net?.active && !!a && a.mv === this.netMoves && g.phase === 'aiming' && g.match.winner === null &&
      !this.netReplay && !this.netMine && this.net.player !== g.match.current && performance.now() - a.at < NET_AIM_STALE;
  }

  /**
   * Bola 8 (todos os modos, pedido do Leon 03/11): quem precisa cantar vê um aviso amarelo no MEIO da mesa;
   * depois de 1,9 s ele "voa" até a linha de status (onde o lembrete continua); ao escolher a caçapa, some.
   * Não bloqueia o toque (pointer-events: none): dá para tocar na caçapa com o aviso na tela.
   */
  private updateCall8() {
    const g = this.game;
    const el = $('call8');
    const need = !!g && g.phase === 'aiming' && g.match.winner === null && !g.currentIsAI() && !this.strikeAnim &&
      (!this.net?.active || this.net.player === g.match.current) && g.needsCall() && g.match.calledPocket === null;
    if (!need) {
      if (el.className) { el.className = ''; el.setAttribute('aria-hidden', 'true'); clearTimeout(this.call8Timer); }
      return;
    }
    const key = `${this.netKey}:${this.matchId}:${g.match.shotCount}:${g.match.current}`;
    if (key === this.call8Key) return;
    this.call8Key = key;
    clearTimeout(this.call8Timer);
    el.className = 'show';
    el.setAttribute('aria-hidden', 'false');
    this.call8Timer = window.setTimeout(() => {
      if (this.disposed || el.className !== 'show') return;
      const a = el.getBoundingClientRect();
      const sub = $('sub');
      const b = sub.getBoundingClientRect();
      el.style.setProperty('--dx', `${b.left + b.width / 2 - (a.left + a.width / 2)}px`);
      el.style.setProperty('--dy', `${b.top + b.height / 2 - (a.top + a.height / 2)}px`);
      el.className = 'dock';
      // pisca o lembrete quando o aviso chega (Web Animations: o updateHUD troca a classe do #sub o tempo todo)
      sub.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', color: '#ffd54a' }, { transform: 'scale(1)' }],
        { duration: 450, iterations: 2, delay: 450 });
    }, 1900);
  }

  /** Envia o estado depois da minha tacada (ou do meu tempo esgotado / do tempo do outro). */
  private netSend(kind: 'shot' | 'timeout', result?: GameController) {
    const g = this.game;
    const net = this.net;
    if (!g || !net?.active) return;
    const src = result ?? g;
    this.netMoves++;
    const payload = {
      kind,
      next_turn: src.match.current,
      winner: src.match.winner === null ? null : (String(src.match.winner) as '0' | '1'),
      state: encodeState(src, kind === 'shot' ? g.lastShot : null) as unknown as Record<string, unknown>,
    };
    void net.submit(payload).then(
      (room) => { this.netTurnSeen = performance.now(); this.netStatus(room); },
      (e) => {
        this.toast(e instanceof Error ? e.message : String(e), true);
        this.netResync();
      },
    );
  }

  /** Descarta a mesa local e recarrega exatamente o que está no servidor. */
  private netResync() {
    const room = this.net?.room;
    this.netKey = '';
    this.netMine = false;
    this.netPredicted = null;
    this.netReplay = null;
    if (room) this.remoteState(room);
  }

  /** O outro sumiu/travou na vez dele: depois de 62 s eu aplico o tempo esgotado (o servidor confere o prazo). */
  private netMaybeClaim() {
    const g = this.game;
    const net = this.net;
    if (!g || !net?.active || net.room?.status !== 'playing' || net.pending || this.netMine || this.netReplay) return;
    if (g.phase !== 'aiming' || net.player === null || net.player === g.match.current || !net.connected) return;
    if (this.netClaimed === this.netMoves || performance.now() - this.netTurnSeen < NET_CLAIM_AFTER * 1000) return;
    this.netClaimed = this.netMoves;
    if (!g.timeout()) return;
    this.sound.foul();
    this.toast(g.match.lastMessage, true);
    this.netSend('timeout');
    this.prepareTurn();
  }

  /** Fim de partida, revanche e sala encerrada (só depois da animação da tacada). */
  private netStatus(room: Room) {
    const g = this.game;
    if (!g || this.disposed) return;
    if (room.status === 'playing' || room.status === 'waiting') {
      if (this.netOverKey) { this.hide('over'); this.netOverKey = ''; }
      return;
    }
    if (this.netReplay || this.netMine || g.phase === 'rolling') return;
    const me = this.net?.player ?? null;
    const mine = me !== null && room.rematch[me];
    const theirs = me !== null && room.rematch[1 - me];
    const key = `${room.id}:${room.round}:${room.status}:${mine}:${theirs}`;
    if (key === this.netOverKey) return;
    const firstTime = !this.netOverKey.startsWith(`${room.id}:${room.round}:`);
    this.netOverKey = key;
    const names = this.netNames();
    const other = me === null ? '' : names[1 - me];
    const w = room.winner === '0' || room.winner === '1' ? Number(room.winner) : null;
    $('over-title').textContent = room.status === 'closed' ? T('Sala encerrada', 'Room closed') : w === null ? '' : w === me ? T('Vitória!', 'Victory!') : `${names[w]} ${T('venceu!', 'wins!')}`;
    let msg = room.status === 'closed' ? '' : `${g.match.winReason}\n`;
    msg += `${names[0]} ${room.scores[0]} × ${room.scores[1]} ${names[1]}`;
    if (room.status === 'finished' && mine) msg += `\n${T('Revanche pedida. Aguardando', 'Rematch requested. Waiting for')} ${other}…`;
    else if (room.status === 'finished' && theirs) msg += `\n${other} ${T('quer revanche!', 'wants a rematch!')}`;
    const reason = $('over-reason');
    reason.textContent = msg;
    reason.style.whiteSpace = 'pre-line';
    const again = $<HTMLButtonElement>('btn-rematch');
    again.textContent = room.status === 'closed' ? T('Sair', 'Leave') : mine ? T('Aguardando…', 'Waiting…') : theirs ? T('Aceitar revanche', 'Accept rematch') : T('Pedir revanche', 'Request rematch');
    again.disabled = room.status === 'finished' && mine;
    $('btn-over-new').hidden = true;
    $('btn-over-menu').textContent = T('Sair da sala', 'Leave room');
    if (firstTime && room.status === 'finished' && w === me) this.sound.win();
    this.updateHUD();
    setTimeout(() => !this.disposed && this.netOverKey === key && this.show('over'), firstTime ? 900 : 0);
  }

  /** Botão "Sair da sala" (barra, pausa, resultado). */
  private netLeave() {
    const net = this.net;
    this.net = null;
    if (net) void net.leave().catch(() => this.toast(T('Não foi possível confirmar a saída no servidor.', 'Could not confirm leaving on the server.'), true)).finally(() => net.dispose());
    this.netEnded();
  }

  private netEnded() {
    this.net?.dispose();
    this.net = null;
    this.netKey = '';
    this.netMoves = -1;
    this.netReplay = null;
    this.netMine = false;
    this.netPredicted = null;
    this.netOverKey = '';
    $('btn-over-new').hidden = false;
    $('btn-restart').hidden = false;
    $<HTMLButtonElement>('btn-rematch').disabled = false;
    $('btn-rematch').textContent = T('Revanche', 'Rematch');
    $('btn-over-menu').textContent = T('Voltar aos jogos', 'Back to games');
    $('over-reason').style.whiteSpace = '';
    $('online-card').hidden = true;
    this.toMenu();
    void this.setupOnline();
  }

  // ---------------------------------------------------------------- IA
  private maybeRunAI() {
    const g = this.game;
    if (!g || this.paused || this.aiBusy || g.phase !== 'aiming' || !g.currentIsAI() || this.strikeAnim) return;
    this.aiBusy = true;
    this.updateHUD();
    const token = g;
    // pequena pausa para o humano acompanhar; o cálculo roda fora do quadro de render
    window.setTimeout(() => {
      if (this.game !== token || !this.aiBusy) return;
      if (this.paused) {
        this.aiBusy = false;
        return;
      }
      const shot = chooseAIShot(g, g.match.difficulty, this.rng);
      if (shot.cuePos) g.placeCue(shot.cuePos.x, shot.cuePos.y);
      if (g.needsCall()) {
        g.callPocket(shot.calledPocket ?? 0);
        this.toast(`IA canta a 8 na caçapa ${pocketName(g.match.calledPocket ?? 0)}.`);
      }
      const from = this.aimAngle;
      let to = shot.angle;
      while (to - from > Math.PI) to -= 2 * Math.PI;
      while (to - from < -Math.PI) to += 2 * Math.PI;
      this.aiAnim = {
        from,
        to,
        t: 0,
        dur: 0.7,
        onDone: () => {
          if (this.game !== token) return;
          if (this.paused) {
            // retoma depois da pausa
            this.aiBusy = false;
            return;
          }
          this.setPower(shot.power);
          window.setTimeout(() => {
            if (this.game !== token || this.paused) {
              this.aiBusy = false;
              return;
            }
            this.aiBusy = false;
            this.beginStrike(shot.angle, shot.power);
          }, 280);
        },
      };
    }, 650);
  }

  private cancelAI() {
    this.aiBusy = false;
    this.aiAnim = null;
    this.strikeAnim = null;
  }

  // ---------------------------------------------------------- overlays
  private show(id: string) {
    if (this.disposed) return;
    $(id).classList.add('show');
  }
  private hide(id: string) {
    $(id).classList.remove('show');
  }
  private hideAll() {
    document.querySelectorAll('.overlay').forEach((o) => o.classList.remove('show'));
  }
  private confirm(msg: string, yes: () => void) {
    const wasPaused = this.paused;
    this.paused = true;
    for (const cancel of this.inputCleanups) cancel();
    $('confirm-msg').textContent = msg;
    this.show('confirm');
    const y = $('btn-confirm-yes');
    const n = $('btn-confirm-no');
    const done = () => {
      this.hide('confirm');
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
  private pause() {
    if (!this.game || this.game.match.winner !== null) return;
    this.paused = true;
    const m = this.game.match;
    $('btn-restart').hidden = !!this.net?.active;
    $('pause-mode').textContent = this.net?.active ? T('Modo: online (sala privada)', 'Mode: online (private room)') : m.mode === 'ai' ? T(`Modo: 1 jogador vs IA (${DIFF_LABEL[m.difficulty]})`, `Mode: 1 player vs AI (${DIFF_LABEL[m.difficulty]})`) : T('Modo: 2 jogadores locais', 'Mode: 2 players, same device');
    this.show('pause');
  }
  private resume() {
    this.paused = false;
    this.last = performance.now();
    this.hide('pause');
  }
  private toMenu() {
    if (this.net?.active) return this.netLeave();
    this.cancelAI();
    this.game = null;
    this.paused = false;
    this.hideAll();
    this.renderMenuStats();
    this.show('menu');
    this.updateHUD();
  }

  private toast(msg: string, foul = false) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('foul', foul);
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), foul ? 3600 : 2600);
  }

  // --------------------------------------------------------------- HUD
  private updateHUD() {
    const g = this.game;
    setTurnColor($('app'), g && g.match.winner === null ? g.match.current : null);
    this.drawSideCue(false);
    const st = $('status');
    const sub = $('sub');
    sub.className = '';
    for (const i of [0, 1] as const) {
      const card = $(`p${i}`);
      const nm = card.querySelector('.nm')!;
      const grp = card.querySelector('.pgroup')!;
      const tray = card.querySelector('.ptray')!;
      const av = card.querySelector('.avatar')!;
      if (!g) {
        card.classList.remove('active');
        nm.textContent = '';
        grp.textContent = '';
        tray.innerHTML = '';
        av.textContent = '';
        continue;
      }
      const p = g.match.players[i];
      card.classList.toggle('active', g.match.winner === null && g.match.current === i);
      nm.textContent = p.name;
      av.textContent = p.isAI ? '🤖' : p.name.slice(0, 1).toUpperCase();
      if (!p.group || g.match.tableOpen) {
        grp.textContent = '';
        tray.innerHTML = `<span class="hint">${g.match.isBreak ? 'Abertura' : 'Mesa aberta: qualquer bola menos a 8'}</span>`;
        continue;
      }
      const balls = groupBalls(p.group);
      const remain = balls.filter((b) => !getBall(g.world, b)!.pocketed);
      const onEight = remain.length === 0;
      grp.textContent = onEight ? '· na bola 8' : `· ${p.group === 'solids' ? 'lisas' : 'listradas'}, faltam ${remain.length}`;
      tray.innerHTML =
        balls.map((b) => chipHTML(b, remain.includes(b) ? '' : 'done')).join('') + chipHTML(8, onEight ? 'next' : 'later');
    }
    if (!g) {
      st.textContent = '';
      sub.textContent = '';
      return;
    }
    const m = g.match;
    const cur = m.players[m.current];
    const clock = fmtTime(this.matchTime);
    if (m.winner !== null) {
      st.textContent = `⏱ ${clock} · ${m.players[m.winner].name} venceu`;
      sub.textContent = m.winReason;
    } else {
      st.textContent = `⏱ ${clock} · Vez de ${cur.name}`;
      if (g.phase === 'rolling') sub.textContent = 'Bolas em movimento…';
      else if (cur.isAI) sub.textContent = 'IA pensando…';
      else if (this.net?.active && this.net.player !== m.current) sub.textContent = `${cur.name} está jogando…`;
      else if (g.needsCall() && m.calledPocket === null) {
        sub.textContent = 'Toque numa caçapa para cantar a 8';
        sub.className = 'foul';
      } else if (m.ballInHand !== 'none' && this.dragging !== 'aim') {
        sub.textContent = m.isBreak ? 'Abertura: arraste a branca na área clara' : 'Bola na mão: arraste a branca';
      } else if (this.aimHit?.kind === 'ball') {
        const id = this.aimHit.ballId!;
        const legal = legalTargets(m, m.current, g.onTable()).includes(id);
        sub.textContent = legal ? 'Puxe o taco e solte para tacar' : 'Bola errada: acertar primeiro é falta';
        sub.className = legal ? 'ok' : 'foul';
      } else sub.textContent = 'Puxe o taco e solte para tacar';
      if (g.needsCall() && m.calledPocket !== null && sub.className !== 'foul') sub.textContent += ` · 8 → ${pocketName(m.calledPocket)}`;
    }
    this.gauge.setLocked(!this.humanCanAim() && this.dragging !== 'power');
  }

  /** Anel do tempo em volta da foto do jogador da vez (atualizado a cada quadro). */
  private updateTimerRing() {
    const g = this.game;
    // online o tempo é sempre o da sala (45 s), mesmo com "sem limite" nas Configurações, e aparece também na vez do outro
    const limit = this.net?.active ? NET_SHOT_TIME : this.prefs.shotTime;
    for (const i of [0, 1] as const) {
      const wrap = $(`p${i}`).querySelector<HTMLElement>('.avatar-wrap')!;
      const t = wrap.querySelector<HTMLElement>('.ptime')!;
      const active = !!g && g.match.winner === null && g.match.current === i;
      const human = active && !g!.match.players[i].isAI;
      const frac = human && limit > 0 ? Math.max(0, this.turnLeft / limit) : 1;
      wrap.style.setProperty('--p', active ? frac.toFixed(4) : '0');
      const warn = human && limit > 0 && this.turnLeft <= 10;
      wrap.classList.toggle('warn', warn);
      const show = human && limit > 0;
      t.classList.toggle('on', show);
      if (show) t.textContent = `${Math.ceil(Math.max(0, this.turnLeft))}s`;
    }
  }

  private handleTimeout() {
    const g = this.game!;
    this.dragging = 'none';
    $('pbar').classList.remove('pulling');
    this.snapCue();
    if (!g.timeout()) return;
    this.sound.foul();
    this.toast(g.match.lastMessage, true);
    if (this.net?.active) this.netSend('timeout');
    this.prepareTurn();
  }

  // ------------------------------------------------------------ layout
  private layout() {
    const wrap = $('table-box');
    this.renderer.resize(wrap.clientWidth, wrap.clientHeight);
    this.setPower(this.power);
    this.drawSideCue();
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
    if (portrait && !this.rotateDismissed) this.show('rotate');
    else this.hide('rotate');
  }

  // -------------------------------------------------------------- loop
  private frame(now: number) {
    if (this.disposed) return;
    const dtReal = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.time += dtReal;
    this.sound.frame();
    const g = this.game;
    let alpha = 1;

    if (g && !this.paused) {
      this.fxNow += dtReal;
      // animação do golpe
      if (this.strikeAnim) {
        this.strikeAnim.t += dtReal;
        if (this.strikeAnim.t >= 0.11) this.fireStrike();
      }
      // animação da mira da IA
      if (this.aiAnim) {
        const a = this.aiAnim;
        a.t += dtReal;
        const k = Math.min(1, a.t / a.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.aimAngle = a.from + (a.to - a.from) * e;
        if (k >= 1) {
          this.aiAnim = null;
          a.onDone();
        }
      }
      // física em passo fixo com acumulador
      if (g.phase === 'rolling') {
        const dt = g.world.params.dt;
        this.acc += dtReal;
        let n = 0;
        while (this.acc >= dt && n < 12) {
          const res = g.tick();
          this.acc -= dt;
          n++;
          this.playEvents();
          if (res) {
            this.acc = 0;
            this.onShotResolved();
            break;
          }
        }
        if (this.acc > dt * 4) this.acc = dt * 4;
        alpha = g.phase === 'rolling' ? Math.min(1, this.acc / dt) : 1;
      } else {
        this.acc = 0;
        this.maybeRunAI();
      }
      // relógios: param com pausa ou com qualquer janela aberta (ajuda, configurações, confirmação)
      const overlayOpen = !!document.querySelector('.overlay.show:not(#spin)');
      if (!overlayOpen && g.match.winner === null) {
        this.matchTime += dtReal;
        if (this.net?.active) {
          // online: o relógio corre para os dois (cada aparelho mostra a vez de quem joga); só quem joga aplica o tempo esgotado
          if (g.phase === 'aiming' && !this.netMine && !this.netReplay && this.net.room?.status === 'playing') {
            this.turnLeft = Math.max(0, this.turnLeft - dtReal);
            if (this.turnLeft <= 0 && this.humanCanAim()) this.handleTimeout();
          }
        } else if (this.prefs.shotTime > 0 && this.humanCanAim()) {
          this.turnLeft -= dtReal;
          if (this.turnLeft <= 0) this.handleTimeout();
        }
        this.netMaybeClaim();
      }
    }
    this.updateTimerRing();

    if (g) {
      // online: na vez do outro não desenha taco/mira locais (ele mira no aparelho dele)
      const aiming = g.phase === 'aiming' && g.match.winner === null && (!this.net?.active || this.net.player === g.match.current);
      // online, vez do outro: mostra a mira e o taco DELE (recebidos ao vivo), sem deixar mexer
      const remote = !aiming && this.netAimVisible();
      if (remote) {
        const t = this.netAim!;
        let da = t.a - this.netAimShown.a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const k = Math.min(1, dtReal * 14);
        this.netAimShown = { a: this.netAimShown.a + da * k, p: this.netAimShown.p + (t.p - this.netAimShown.p) * k };
      }
      const angle = remote ? this.netAimShown.a : this.aimAngle;
      const showing = aiming || remote;
      this.aimHit = showing ? aimRaycast(g.world, angle) : null;
      let legal = true;
      if (this.aimHit && this.aimHit.kind === 'ball') {
        legal = legalTargets(g.match, g.match.current, g.onTable()).includes(this.aimHit.ballId!);
      }
      const pull = this.strikeAnim
        ? this.strikeAnim.power * Math.max(0, 1 - this.strikeAnim.t / 0.11)
        : remote ? this.netAimShown.p : this.power;
      const cue = g.cue;
      const cb = getBall(g.world, 0);
      if (g.phase === 'rolling' && cb && !cb.pocketed && (cb.vx !== 0 || cb.vy !== 0)) {
        this.trailBuf.push(cb.px + (cb.x - cb.px) * alpha, cb.py + (cb.y - cb.py) * alpha, performance.now() / 1000);
      } else this.trailBuf.prune(performance.now() / 1000);
      if (!this.paused) this.fx.update(dtReal);
      const trailId = usableTrail(this.prefs.trail, 'nenhum');
      this.renderer.render({
        trail: trailId !== 'nenhum' ? { id: trailId, pts: this.trailBuf.pts, color: PLAYER_COLORS[g.match.current] } : null,
        particles: this.fx,
        world: g.world,
        alpha,
        aimAngle: angle,
        showAim: showing && !this.strikeAnim,
        aimHit: this.aimHit,
        aimLegal: legal,
        objectPath: this.prefs.guide && this.aimHit ? objectBallPath(g.world, this.aimHit) : null,
        cuePull: pull,
        showCue: showing,
        ballInHand: showing ? g.match.ballInHand : 'none',
        cueValid: g.match.ballInHand === 'none' || g.canPlaceCue(cue.x, cue.y) || g.canShoot(),
        callMode: aiming && g.needsCall(),
        calledPocket: g.match.calledPocket,
        time: this.time,
        pocketAnims: this.pocketAnims,
        railOrder: this.railOrder,
        fxNow: this.fxNow,
        cueSkin: this.cueSkin,
        cueGrabbed: this.dragging === 'stick' && this.stick.pull,
      });
      this.gauge.setLocked(!this.humanCanAim() && this.dragging !== 'power');
      ($('btn-spin') as HTMLButtonElement).disabled = !this.humanCanAim();
      this.netLiveOut();
      this.updateCall8();
      if (this.frameCount++ % 15 === 0) this.updateHUD();
    } else {
      this.renderIdle();
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  private frameCount = 0;
  private idleGame: GameController | null = null;

  /** Mesa de fundo no menu (sem partida ativa). */
  private renderIdle() {
    if (!this.idleGame) this.idleGame = new GameController({ mode: 'local' });
    this.renderer.render({
      world: this.idleGame.world,
      alpha: 1,
      aimAngle: 0,
      showAim: false,
      aimHit: null,
      aimLegal: true,
      cuePull: 0,
      showCue: false,
      ballInHand: 'none',
      cueValid: true,
      callMode: false,
      calledPocket: null,
      time: this.time,
      pocketAnims: [],
      railOrder: [],
      fxNow: 0,
      cueSkin: this.cueSkin,
      cueGrabbed: false,
    });
  }

  private playEvents() {
    const ev = this.game!.world.events;
    for (; this.eventIdx < ev.length; this.eventIdx++) {
      const e = ev[this.eventIdx];
      if (e.type === 'ball') this.sound.ball(e.impulse);
      else if (e.type === 'cushion') this.sound.cushion(e.impulse);
      else {
        this.sound.pocket();
        const g = this.game!;
        const b = getBall(g.world, e.ball)!;
        const pk = g.world.table.pockets[e.pocket];
        this.fx.burst(this.renderer.burstStyle, pk.center.x, pk.center.y, g.world.params.ballRadius);
        this.pocketAnims.push({
          id: e.ball,
          fromX: b.x,
          fromY: b.y,
          pocketX: pk.center.x,
          pocketY: pk.center.y,
          t0: this.fxNow,
          q: [...b.q] as [number, number, number, number],
          slot: e.ball === 0 ? null : 0,
        });
        if (e.ball !== 0 && !this.railOrder.includes(e.ball)) this.railOrder.push(e.ball);
      }
    }
  }

  private clearFx() {
    this.pocketAnims = [];
    this.fx.clear();
    this.trailBuf.clear();
    this.railOrder = [];
  }

  /** Gancho de teste (QA automatizado no navegador). */
  debug() {
    return { game: this.game, app: this, chooseAIShot, rng: this.rng, music: this.music };
  }
}

function fmtTime(sec: number): string {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function chipHTML(b: number, cls: string): string {
  return `<img class="chip${cls ? ' ' + cls : ''}" src="${ballIcon(b, 22)}" alt="Bola ${b}" title="Bola ${b}" draggable="false" />`;
}

function pocketName(id: number): string {
  return ['superior esquerda', 'superior do meio', 'superior direita', 'inferior esquerda', 'inferior do meio', 'inferior direita'][id];
}

/** Miniatura da mesa para a escolha de tema (madeira, feltro, caçapas e diamantes). */
/** Prévia do rastro: curva com a bola branca no fim, sobre o feltro da mesa em uso. */
function paintTrailPreview(cv: HTMLCanvasElement, id: (typeof TRAILS)[number]['id'], cloth: string) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 220;
  const h = cv.clientHeight || 70;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = cloth;
  ctx.fillRect(0, 0, w, h);
  const u = h * 0.11;
  const pts = Array.from({ length: 22 }, (_, i) => {
    const k = i / 21;
    return { x: w * (0.08 + 0.72 * k), y: h * (0.62 - 0.28 * Math.sin(k * Math.PI)) };
  });
  drawTrail(ctx, id, pts, u, PLAYER_COLORS[0], 0.6);
  const b = pts[pts.length - 1];
  const gr = ctx.createRadialGradient(b.x - u * 0.3, b.y - u * 0.3, u * 0.1, b.x, b.y, u);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(1, '#cfd3d6');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(b.x, b.y, u, 0, Math.PI * 2);
  ctx.fill();
}

function paintTablePreview(cv: HTMLCanvasElement, t: TableTheme) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 160;
  const h = cv.clientHeight || 80;
  cv.width = w * dpr;
  cv.height = h * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = h * 0.12;
  const wood = ctx.createLinearGradient(0, 0, 0, h);
  t.wood.forEach((c, i) => wood.addColorStop(i / 2, c));
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
  const cloth = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.6);
  t.cloth.forEach((c, i) => cloth.addColorStop(i / 2, c));
  ctx.fillStyle = cloth;
  ctx.fillRect(r, r, w - 2 * r, h - 2 * r);
  ctx.strokeStyle = shadeHex(t.cloth[2], -0.3);
  ctx.lineWidth = 2;
  ctx.strokeRect(r + 1, r + 1, w - 2 * r - 2, h - 2 * r - 2);
  ctx.fillStyle = '#050505';
  for (const [x, y] of [[r, r], [w / 2, r * 0.8], [w - r, r], [r, h - r], [w / 2, h - r * 0.8], [w - r, h - r]]) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = t.diamond;
  for (let i = 1; i < 8; i++) if (i !== 4) for (const y of [r / 2, h - r / 2]) ctx.fillRect((w / 8) * i - 1, y - 1, 2, 2);
  // bolas de exemplo
  const balls: [number, number, string][] = [[0.3, 0.5, '#f6f1e3'], [0.68, 0.5, '#f2b705'], [0.72, 0.42, '#d42a2a'], [0.72, 0.58, '#141414']];
  for (const [bx, by, c] of balls) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(w * bx, h * by, h * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}
