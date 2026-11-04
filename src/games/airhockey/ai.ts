import type { Difficulty } from '../shared/shell';
import { AH, clampMallet, HockeyState, MALLET_R, PUCK_R, setTarget, TABLE } from './physics';

/**
 * IA do Jogador 2 (gol da direita). Usa só o que está na mesa (posição e velocidade do disco) e move o
 * rebatedor pelo mesmo caminho do humano (alvo + velocidade máxima).
 *
 * Comportamento (revisto em 01/11, medido em scripts/bench-hockey.ts):
 * - Disco no campo adversário: volta para a frente do gol e acompanha o disco ("sombra").
 * - Disco vindo para o gol: prevê onde ele cruza a linha de defesa (com tabelas nas laterais) e vai até lá.
 * - Disco no próprio campo: posiciona-se ATRÁS do disco em relação ao ponto de mira e passa por ele (tacada).
 * Dificuldade = tempo de reação, erro de previsão, velocidade do rebatedor, força e pontaria da tacada
 * e chance de "distração" (não reagir naquela decisão).
 */
export interface Cfg {
  reaction: number; // s entre decisões
  aimError: number; // m de erro na previsão de defesa
  speedScale: number; // fração da velocidade máxima ao se mover
  strikeScale: number; // fração da velocidade máxima na tacada
  shotError: number; // m de erro no ponto de mira do gol adversário
  bankShots: boolean; // tenta tabelas (mira refletida nas laterais)
  lapse: number; // chance (0–1) de ignorar uma decisão e ficar parado
  lead: number; // 0–1: quanto antecipa o movimento do disco ao atacar
  homeDist: number; // m: distância da linha do gol onde espera (longe = deixa o gol aberto)
  track: number; // 0–1: quanto acompanha o disco lateralmente na espera (1 = sai da frente do gol)
  smartAim: boolean; // mira o lado do gol longe do rebatedor adversário
}
export const AI_CFG: Record<Difficulty, Cfg> = {
  easy: { reaction: 0.5, aimError: 0.22, speedScale: 0.3, strikeScale: 0.45, shotError: 0.3, bankShots: false, lapse: 0.35, lead: 0.2, homeDist: 0.55, track: 0.9, smartAim: false },
  medium: { reaction: 0.22, aimError: 0.08, speedScale: 0.58, strikeScale: 0.75, shotError: 0.12, bankShots: false, lapse: 0.1, lead: 0.6, homeDist: 0.26, track: 0.55, smartAim: false },
  hard: { reaction: 0.12, aimError: 0.05, speedScale: 0.85, strikeScale: 1, shotError: 0.04, bankShots: true, lapse: 0.03, lead: 1, homeDist: 0.18, track: 0.35, smartAim: true },
};

export class HockeyAI {
  private timer = 0;
  private target = { x: TABLE.w - 0.2, y: TABLE.h / 2 };
  private moveScale = 1;
  private shotAim = { x: 0, y: TABLE.h / 2 };
  private aimChosenAt = -1;
  constructor(
    public difficulty: Difficulty,
    private rng: () => number = Math.random,
    private cfgOverride?: Cfg,
  ) {}

  get cfg(): Cfg {
    return this.cfgOverride ?? AI_CFG[this.difficulty];
  }

  update(s: HockeyState, dt: number): void {
    const c = this.cfg;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = c.reaction * (0.75 + this.rng() * 0.5);
      if (this.rng() >= c.lapse) {
        const d = this.decide(s, c);
        this.target = d.p;
        this.moveScale = d.scale;
      }
    }
    const m = s.mallets[1];
    const dx = this.target.x - m.x;
    const dy = this.target.y - m.y;
    const d = Math.hypot(dx, dy);
    const maxStep = AH.maxMalletSpeed * this.moveScale * dt;
    const k = d > maxStep ? maxStep / d : 1;
    setTarget(s, 1, m.x + dx * k, m.y + dy * k);
  }

  private home(pkY: number, c: Cfg) {
    // espera na frente do gol, deslocado na direção do disco (iniciante sai da frente do gol)
    return { x: TABLE.w - c.homeDist, y: TABLE.h / 2 + (pkY - TABLE.h / 2) * c.track };
  }

  private decide(s: HockeyState, c: Cfg): { p: { x: number; y: number }; scale: number } {
    const pk = s.puck;
    const m = s.mallets[1];
    if (s.freeze > 0) return { p: this.home(TABLE.h / 2, c), scale: c.speedScale };
    const half = TABLE.w / 2;
    const sp = Math.hypot(pk.vx, pk.vy);

    // 1) defesa: disco vindo para o meu gol com velocidade
    if (pk.vx > 0.6 && !(pk.x > m.x - 0.02)) {
      const defX = TABLE.w - Math.max(0.2, c.homeDist);
      const t = (defX - pk.x) / pk.vx;
      // se o disco já está no meu campo e eu estou atrás dele, posso atacar em vez de só bloquear
      if (pk.x < half || t > 0.18 || sp > 3) {
        const y = reflectY(pk.y + pk.vy * Math.max(0, t)) + (this.rng() - 0.5) * 2 * c.aimError;
        const g0 = (TABLE.h - TABLE.goal) / 2 - 0.06;
        return { p: { x: defX, y: Math.min(TABLE.h - g0, Math.max(g0, y)) }, scale: c.speedScale };
      }
    }

    // 2) disco no campo adversário: sombra na frente do gol
    if (pk.x < half - 0.02) return { p: this.home(pk.y, c), scale: c.speedScale };

    // 3) ataque: disco no meu campo
    // posição futura do disco (antecipação)
    const tl = Math.min(0.35, Math.hypot(pk.x - m.x, pk.y - m.y) / (AH.maxMalletSpeed * c.speedScale)) * c.lead;
    const fx = Math.max(half + 0.02, Math.min(TABLE.w - PUCK_R, pk.x + pk.vx * tl));
    const fy = reflectY(pk.y + pk.vy * tl);
    // ponto de mira no gol adversário (sorteado de novo a cada novo ataque)
    if (s.t - this.aimChosenAt > 1.2) {
      this.aimChosenAt = s.t;
      // mira esperta: lado do gol longe do rebatedor adversário; senão um ponto qualquer do gol
      const opp = s.mallets[0];
      const open = opp.y > TABLE.h / 2 ? -1 : 1;
      const base = c.smartAim ? TABLE.h / 2 + open * TABLE.goal * 0.3 : TABLE.h / 2 + (this.rng() - 0.5) * TABLE.goal * 0.6;
      const gy = base + (this.rng() - 0.5) * 2 * c.shotError;
      // tabela: mira o reflexo do gol em uma das laterais
      if (c.bankShots && this.rng() < 0.35) this.shotAim = { x: 0, y: this.rng() < 0.5 ? -gy : 2 * TABLE.h - gy };
      else this.shotAim = { x: 0, y: gy };
    }
    let ux = this.shotAim.x - fx;
    let uy = this.shotAim.y - fy;
    const ud = Math.hypot(ux, uy) || 1;
    ux /= ud;
    uy /= ud;
    const contact = PUCK_R + MALLET_R;
    // ponto atrás do disco
    const back = { x: fx - ux * (contact + 0.06), y: fy - uy * (contact + 0.06) };
    const bc = clampMallet(1, back.x, back.y);
    const blocked = Math.hypot(bc.x - back.x, bc.y - back.y) > 0.03; // não dá para ficar atrás (disco no canto/fundo)
    // estou atrás e alinhado? (projeção na direção de mira e distância lateral)
    const rx = m.x - fx;
    const ry = m.y - fy;
    const along = rx * ux + ry * uy; // negativo = atrás
    const lateral = Math.abs(-rx * uy + ry * ux);
    if (blocked || (along < -contact * 0.6 && lateral < contact * 0.75)) {
      // tacada: passa pelo disco
      const dir = blocked ? norm(fx - m.x, fy - m.y) : { x: ux, y: uy };
      return { p: { x: fx + dir.x * 0.25, y: fy + dir.y * 0.25 }, scale: c.strikeScale };
    }
    // contorna: se estou à frente do disco, desvia lateralmente para não empurrá-lo para o meu gol
    if (along > 0) {
      const side = -rx * uy + ry * ux >= 0 ? 1 : -1;
      const nx = -uy * side;
      const ny = ux * side;
      return { p: { x: back.x + nx * contact * 1.2, y: back.y + ny * contact * 1.2 }, scale: c.speedScale };
    }
    return { p: back, scale: c.speedScale };
  }
}

function norm(x: number, y: number) {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d };
}

/** Reflete uma coordenada y nas laterais (onde o disco estará após tabelas). */
function reflectY(y: number): number {
  const H = TABLE.h - 2 * PUCK_R;
  let v = y - PUCK_R;
  v = ((v % (2 * H)) + 2 * H) % (2 * H);
  if (v > H) v = 2 * H - v;
  return v + PUCK_R;
}
