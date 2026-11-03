import { initialPositions } from '../physics/rack';
import { DEFAULT_PARAMS, PhysicsParams } from '../physics/table';
import {
  createWorld,
  getBall,
  isAtRest,
  isValidCuePlacement,
  NO_SPIN,
  Spin,
  step,
  strike,
  World,
} from '../physics/world';
import {
  createMatch,
  Difficulty,
  evaluateShot,
  isOnEight,
  MatchState,
  Mode,
  ShotResult,
  summarizeShot,
  timeoutFoul,
} from '../rules/rules';
import { applyBalls, encodeBalls, NetShot } from '../online';

export type Phase = 'aiming' | 'rolling' | 'over';

export interface GameOptions {
  mode: Mode;
  difficulty?: Difficulty;
  names?: [string, string];
  breaker?: 0 | 1;
  params?: PhysicsParams;
}

/**
 * Orquestra mundo físico + regras. Sem DOM: é usado pela UI, pela IA e pelos testes.
 */
export class GameController {
  world!: World;
  match!: MatchState;
  phase: Phase = 'aiming';
  lastResult: ShotResult | null = null;
  private onTableBefore: number[] = [];
  /** Bolas encaçapadas na partida, em ordem (sem a branca e sem a 8 recolocada). */
  pocketOrder: number[] = [];
  private opts: GameOptions;
  /** Online: mesa antes do impulso e velocidades da branca depois (para o outro aparelho repetir a tacada). */
  lastShot: NetShot | null = null;

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.reset(opts.breaker ?? 0);
  }

  /** Reinicia completamente (posições, grupos, faltas, turno). */
  reset(breaker: 0 | 1 = 0): void {
    const params = this.opts.params ?? DEFAULT_PARAMS;
    this.world = createWorld(initialPositions(), params);
    this.match = createMatch({ ...this.opts, breaker });
    this.phase = 'aiming';
    this.lastResult = null;
    this.pocketOrder = [];
    this.onTableBefore = [];
  }

  /** Revanche: quem abre alterna. */
  rematch(): void {
    const names: [string, string] = [this.match.players[0].name, this.match.players[1].name];
    this.opts = { ...this.opts, names };
    this.reset((1 - this.match.breaker) as 0 | 1);
  }

  get cue() {
    return getBall(this.world, 0)!;
  }

  onTable(): number[] {
    return this.world.balls.filter((b) => !b.pocketed).map((b) => b.id);
  }

  currentIsAI(): boolean {
    return this.match.players[this.match.current].isAI;
  }

  /** Jogador da vez está na bola 8 e precisa cantar a caçapa. */
  needsCall(): boolean {
    return this.match.winner === null && isOnEight(this.match, this.match.current, this.onTable());
  }

  maxCueX(): number | undefined {
    return this.match.ballInHand === 'kitchen' ? this.world.table.headStringX : undefined;
  }

  canPlaceCue(x: number, y: number): boolean {
    if (this.phase !== 'aiming' || this.match.ballInHand === 'none') return false;
    return isValidCuePlacement(this.world, x, y, this.maxCueX());
  }

  placeCue(x: number, y: number): boolean {
    if (!this.canPlaceCue(x, y)) return false;
    const c = this.cue;
    c.x = c.px = x;
    c.y = c.py = y;
    return true;
  }

  callPocket(id: number | null): void {
    if (this.phase === 'aiming') this.match = { ...this.match, calledPocket: id };
  }

  /** Aplica a falta por tempo esgotado (somente com a mesa parada, antes da tacada). */
  timeout(): boolean {
    if (this.phase !== 'aiming' || this.match.winner !== null) return false;
    const wasBreak = this.match.isBreak;
    this.match = timeoutFoul(this.match);
    if (wasBreak) {
      const hs = this.world.table.headSpot;
      this.cue.x = this.cue.px = hs.x;
      this.cue.y = this.cue.py = hs.y;
    }
    return true;
  }

  canShoot(): boolean {
    if (this.phase !== 'aiming' || this.match.winner !== null) return false;
    if (!isAtRest(this.world)) return false;
    if (this.needsCall() && this.match.calledPocket === null) return false;
    const c = this.cue;
    if (this.match.ballInHand !== 'none' && !isValidCuePlacement(this.world, c.x, c.y, this.maxCueX())) return false;
    return true;
  }

  /** Uma única aplicação de impulso. Retorna false (sem efeito) se a tacada não é permitida. */
  shoot(angle: number, power: number, spin: Spin = NO_SPIN): boolean {
    if (!this.canShoot()) return false;
    this.onTableBefore = this.onTable();
    const from = encodeBalls(this);
    if (!strike(this.world, angle, power, spin)) return false;
    const c = this.cue;
    this.lastShot = { from, cue: [c.vx, c.vy, c.wx, c.wy, c.wz] };
    this.phase = 'rolling';
    return true;
  }

  /**
   * Online: resolve a tacada em andamento numa CÓPIA, de uma vez (sem animar), e devolve a cópia já parada.
   * Mesmo motor, mesmo passo fixo e mesmos números ⇒ chega exatamente ao resultado que a animação vai mostrar.
   * Assim o resultado vai para o outro aparelho no instante da tacada, sem esperar as bolas pararem.
   */
  predictOutcome(): GameController | null {
    if (this.phase !== 'rolling') return null;
    const copy = Object.create(GameController.prototype) as GameController;
    Object.assign(copy, {
      opts: this.opts,
      world: structuredClone(this.world),
      match: structuredClone(this.match),
      phase: this.phase,
      lastResult: null,
      onTableBefore: [...this.onTableBefore],
      pocketOrder: [...this.pocketOrder],
      lastShot: this.lastShot,
    });
    for (let guard = 0; copy.phase === 'rolling' && guard < 120 * 600; guard++) copy.tick();
    return copy.phase === 'rolling' ? null : copy;
  }

  /**
   * Online: repete a tacada de outro aparelho a partir da mesa `from` e das velocidades da branca.
   * As regras locais rodam no fim, mas quem chamou deve trocar o resultado pelo estado recebido.
   */
  replayShot(shot: NetShot): void {
    applyBalls(this, shot.from);
    this.onTableBefore = this.onTable();
    const c = this.cue;
    [c.vx, c.vy, c.wx, c.wy, c.wz] = shot.cue;
    this.world.events = [];
    this.lastShot = shot;
    this.phase = 'rolling';
  }

  /** Avança um passo fixo de física. Retorna o resultado quando a tacada termina. */
  tick(): ShotResult | null {
    if (this.phase !== 'rolling') return null;
    step(this.world);
    if (isAtRest(this.world)) return this.resolve();
    return null;
  }

  private resolve(): ShotResult {
    const sum = summarizeShot(this.world.events);
    for (const p of sum.pocketed) if (p.ball !== 0 && !this.pocketOrder.includes(p.ball)) this.pocketOrder.push(p.ball);
    const res = evaluateShot(this.match, sum, this.onTableBefore);
    this.match = res.state;
    if (res.respotEight) {
      this.respotEight();
      this.pocketOrder = this.pocketOrder.filter((b) => b !== 8);
    }
    if (this.cue.pocketed) this.respotCue();
    this.lastResult = res;
    this.phase = this.match.winner !== null ? 'over' : 'aiming';
    return res;
  }

  /** Recoloca a 8 no ponto do pé (ou atrás dele, na linha longa, se ocupado). */
  private respotEight(): void {
    const b = getBall(this.world, 8)!;
    b.pocketed = false;
    b.pocketId = null;
    b.vx = b.vy = 0;
    const fs = this.world.table.footSpot;
    const R = this.world.params.ballRadius;
    for (let k = 0; k < 400; k++) {
      const x = fs.x + (k % 2 === 0 ? 1 : -1) * Math.floor((k + 1) / 2) * (R / 4);
      if (this.isFree(x, fs.y, 8)) {
        b.x = b.px = x;
        b.y = b.py = fs.y;
        return;
      }
    }
  }

  private isFree(x: number, y: number, self: number): boolean {
    const R = this.world.params.ballRadius;
    if (x < R || x > this.world.table.length - R) return false;
    return this.world.balls.every((o) => o.id === self || o.pocketed || Math.hypot(o.x - x, o.y - y) >= 2 * R + 1e-4);
  }

  /** Branca encaçapada volta à mesa no ponto de cabeceira (ou o ponto livre mais próximo); bola na mão permite movê-la. */
  private respotCue(): void {
    const c = this.cue;
    c.pocketed = false;
    c.pocketId = null;
    c.vx = c.vy = 0;
    const hs = this.world.table.headSpot;
    const R = this.world.params.ballRadius;
    for (let ring = 0; ring < 60; ring++) {
      const n = Math.max(1, ring * 8);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = hs.x + Math.cos(a) * ring * R;
        const y = hs.y + Math.sin(a) * ring * R;
        if (isValidCuePlacement(this.world, x, y)) {
          c.x = c.px = x;
          c.y = c.py = y;
          return;
        }
      }
    }
  }
}
