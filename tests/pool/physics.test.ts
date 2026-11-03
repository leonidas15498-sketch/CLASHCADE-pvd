import { describe, expect, it } from 'vitest';
import { aimRaycast } from '../../src/games/pool/physics/raycast';
import { initialPositions, rackPositions } from '../../src/games/pool/physics/rack';
import { DEFAULT_PARAMS, TABLE } from '../../src/games/pool/physics/table';
import { createWorld, getBall, isAtRest, simulateUntilRest, step, strike, World } from '../../src/games/pool/physics/world';

const R = DEFAULT_PARAMS.ballRadius;
const momentum = (w: World) =>
  w.balls.reduce((acc, b) => ({ x: acc.x + b.vx, y: acc.y + b.vy }), { x: 0, y: 0 });

function maxOverlap(w: World): number {
  let worst = 0;
  const bs = w.balls.filter((b) => !b.pocketed);
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const d = Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y);
      worst = Math.max(worst, 2 * R - d);
    }
  return worst;
}

describe('física — colisões bola-bola', () => {
  it('colisão frontal transfere quase todo o momento e não deixa interpenetração', () => {
    const w = createWorld([
      { id: 0, x: 0.6, y: 0.635 },
      { id: 1, x: 1.2, y: 0.635 },
    ]);
    strike(w, 0, 0.5);
    let p0 = momentum(w);
    let hit = false;
    for (let i = 0; i < 2000 && !hit; i++) {
      p0 = momentum(w);
      step(w);
      hit = w.events.some((e) => e.type === 'ball');
    }
    expect(hit).toBe(true);
    const cue = getBall(w, 0)!;
    const obj = getBall(w, 1)!;
    // restituição 0,95: branca fica com ~2,5% da velocidade, objeto com ~97,5%
    expect(Math.abs(cue.vx)).toBeLessThan(0.05 * Math.abs(obj.vx));
    const p1 = momentum(w);
    // conservação (o atrito do próprio passo explica uma perda mínima)
    expect(Math.abs(p1.x - p0.x) / p0.x).toBeLessThan(0.02);
    expect(Math.abs(p1.y)).toBeLessThan(1e-9);
    expect(maxOverlap(w)).toBeLessThan(1e-6);
  });

  it('colisão oblíqua separa as bolas em ~90° e ambas param completamente', () => {
    const w = createWorld([
      { id: 0, x: 0.6, y: 0.635 },
      { id: 1, x: 1.2, y: 0.635 + R }, // meia bola: corte de 30°
    ]);
    strike(w, 0, 0.35);
    let after = false;
    for (let i = 0; i < 2000 && !after; i++) {
      step(w);
      after = w.events.some((e) => e.type === 'ball');
    }
    const c = getBall(w, 0)!;
    const o = getBall(w, 1)!;
    const dotv = c.vx * o.vx + c.vy * o.vy;
    const cosang = dotv / (Math.hypot(c.vx, c.vy) * Math.hypot(o.vx, o.vy));
    // com e=0,95 o ângulo fica perto de 90° (cos pequeno)
    expect(Math.abs(cosang)).toBeLessThan(0.1);
    simulateUntilRest(w);
    expect(isAtRest(w)).toBe(true);
    for (const b of w.balls) expect(b.vx === 0 && b.vy === 0).toBe(true);
  });

  it('desaceleração: bola sozinha para sem vibração residual', () => {
    const w = createWorld([{ id: 0, x: 0.3, y: 0.635 }]);
    strike(w, 0, 0.2);
    const xs: number[] = [];
    while (!isAtRest(w)) {
      step(w);
      xs.push(getBall(w, 0)!.x);
    }
    // monotônico (sem ir e voltar) e parado
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    const x = getBall(w, 0)!.x;
    for (let i = 0; i < 50; i++) step(w);
    expect(getBall(w, 0)!.x).toBe(x);
  });

  it('abertura forte não deixa bolas sobrepostas nem fora da mesa', () => {
    const w = createWorld(initialPositions());
    strike(w, 0, 1);
    let worst = 0;
    while (!isAtRest(w)) {
      step(w);
      worst = Math.max(worst, maxOverlap(w));
    }
    expect(worst).toBeLessThan(0.25 * R);
    for (const b of w.balls) {
      if (b.pocketed) continue;
      expect(b.x).toBeGreaterThanOrEqual(R - 1e-6);
      expect(b.y).toBeGreaterThanOrEqual(R - 1e-6);
      expect(b.x).toBeLessThanOrEqual(TABLE.length - R + 1e-6);
      expect(b.y).toBeLessThanOrEqual(TABLE.width - R + 1e-6);
    }
  });
});

describe('física — tabelas e caçapas', () => {
  it('rebote em tabela perpendicular inverte a direção e perde energia', () => {
    const w = createWorld([{ id: 0, x: 1.0, y: 0.635 }]);
    strike(w, -Math.PI / 2, 0.4); // para cima, em direção à tabela superior
    const v0 = Math.abs(getBall(w, 0)!.vy);
    let bounced = false;
    for (let i = 0; i < 2000 && !bounced; i++) {
      step(w);
      bounced = w.events.some((e) => e.type === 'cushion');
    }
    const b = getBall(w, 0)!;
    expect(b.vy).toBeGreaterThan(0);
    expect(b.vy).toBeLessThan(v0 * DEFAULT_PARAMS.cushionRestitution + 1e-9);
    expect(b.y).toBeGreaterThanOrEqual(R - 1e-9);
  });

  it('bola mirada no centro da caçapa de canto cai', () => {
    const w = createWorld([{ id: 0, x: 0.5, y: 0.5 }]);
    const pk = TABLE.pockets[0];
    strike(w, Math.atan2(pk.aim.y - 0.5, pk.aim.x - 0.5), 0.3);
    simulateUntilRest(w);
    expect(getBall(w, 0)!.pocketed).toBe(true);
    expect(getBall(w, 0)!.pocketId).toBe(0);
  });

  it('bola entra na caçapa lateral de frente', () => {
    const w = createWorld([{ id: 0, x: TABLE.length / 2, y: 0.6 }]);
    strike(w, Math.PI / 2, 0.3);
    simulateUntilRest(w);
    expect(getBall(w, 0)!.pocketId).toBe(4);
  });

  it('bola que passa rente à boca lateral em ângulo raso NÃO é absorvida (sem captura mágica)', () => {
    // percorre a tabela superior a ~1,5 raio da linha, passando pela boca lateral
    const w = createWorld([{ id: 0, x: 0.4, y: R * 2.6 }]);
    strike(w, 0, 0.45);
    simulateUntilRest(w);
    const b = getBall(w, 0)!;
    expect(b.pocketId === 1).toBe(false);
  });

  it('bola lenta para antes da caçapa e não cai', () => {
    const w = createWorld([{ id: 0, x: 0.5, y: 0.5 }]);
    const pk = TABLE.pockets[0];
    strike(w, Math.atan2(pk.aim.y - 0.5, pk.aim.x - 0.5), 0.12);
    simulateUntilRest(w);
    expect(getBall(w, 0)!.pocketed).toBe(false);
  });
});

describe('raycast da guia', () => {
  it('para na primeira bola atingida e o contato previsto coincide com o motor', () => {
    const w = createWorld([
      { id: 0, x: 0.5, y: 0.6 },
      { id: 3, x: 1.4, y: 0.62 },
    ]);
    const ang = 0.0;
    const hit = aimRaycast(w, ang);
    expect(hit.kind).toBe('ball');
    expect(hit.ballId).toBe(3);
    // posição real da branca no primeiro contato
    strike(w, ang, 0.6);
    let pos = { x: 0, y: 0 };
    for (let i = 0; i < 3000; i++) {
      step(w);
      const e = w.events.find((ev) => ev.type === 'ball');
      if (e && e.type === 'ball') {
        pos = { x: e.x, y: e.y };
        break;
      }
    }
    expect(Math.hypot(pos.x - hit.ghost.x, pos.y - hit.ghost.y)).toBeLessThan(0.004);
  });

  it('bola intermediária bloqueia a bola mais distante', () => {
    const w = createWorld([
      { id: 0, x: 0.5, y: 0.6 },
      { id: 5, x: 1.5, y: 0.6 },
      { id: 2, x: 1.0, y: 0.6 + R },
    ]);
    const hit = aimRaycast(w, 0);
    expect(hit.ballId).toBe(2);
    expect(hit.t).toBeLessThan(0.5);
  });

  it('sem bolas no caminho, termina na tabela (primeiro encontro) e não continua', () => {
    const w = createWorld([{ id: 0, x: 0.5, y: 0.6 }]);
    const hit = aimRaycast(w, -Math.PI / 2 + 0.3);
    expect(hit.kind).toBe('cushion');
    expect(hit.ghost.y).toBeCloseTo(R, 6);
    // a guia é um único segmento: o resultado tem apenas um ponto final, sem ricochete
    expect(Object.keys(hit).sort()).toEqual(['contact', 'ghost', 'kind', 't']);
  });

  it('mira direta na boca de uma caçapa termina na zona de captura', () => {
    const w = createWorld([{ id: 0, x: 0.5, y: 0.5 }]);
    const pk = TABLE.pockets[0];
    const hit = aimRaycast(w, Math.atan2(pk.aim.y - 0.5, pk.aim.x - 0.5));
    expect(hit.kind).toBe('pocket');
  });
});

describe('determinismo e regras de tacada', () => {
  it('mesma tacada no mesmo estado produz o mesmo resultado', () => {
    const run = () => {
      const w = createWorld(initialPositions());
      strike(w, 0.013, 0.93);
      simulateUntilRest(w);
      return w.balls.map((b) => [b.id, b.x, b.y, b.pocketed]);
    };
    expect(run()).toEqual(run());
  });

  it('não permite tacada enquanto alguma bola se move', () => {
    const w = createWorld(initialPositions());
    expect(strike(w, 0, 0.5)).toBe(true);
    step(w);
    const vx = getBall(w, 0)!.vx;
    expect(strike(w, Math.PI, 1)).toBe(false);
    expect(getBall(w, 0)!.vx).toBe(vx);
  });

  it('triângulo: 15 bolas, 8 no centro, sem sobreposição', () => {
    const r = rackPositions();
    expect(r.length).toBe(15);
    expect(new Set(r.map((b) => b.id)).size).toBe(15);
    const eight = r.find((b) => b.id === 8)!;
    const cx = r.reduce((s, b) => s + b.x, 0) / 15;
    expect(eight.y).toBeCloseTo(TABLE.footSpot.y, 9);
    expect(Math.abs(eight.x - cx)).toBeLessThan(R * 0.2 + 2 * R); // fileira central
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++)
        expect(Math.hypot(r[i].x - r[j].x, r[i].y - r[j].y)).toBeGreaterThanOrEqual(2 * R);
  });

  it('abertura forte termina em tempo razoável (calibração)', () => {
    const w = createWorld(initialPositions());
    strike(w, 0, 1);
    const steps = simulateUntilRest(w);
    const secs = steps * DEFAULT_PARAMS.dt;
    expect(secs).toBeGreaterThan(3);
    expect(secs).toBeLessThan(20);
  });
});

describe('física — efeito (giro) e rolamento', () => {
  it('bola branca começa deslizando e passa a rolar sem escorregar', () => {
    const w = createWorld([{ id: 0, x: 0.4, y: 0.635 }]);
    strike(w, 0, 0.3);
    const b = getBall(w, 0)!;
    expect(b.wy).toBe(0); // tacada no centro: sem giro inicial
    for (let i = 0; i < 72; i++) step(w);
    expect(w.events.length).toBe(0); // ainda não bateu em nada
    // rolando: v = −R·wy
    expect(Math.abs(b.vx + R * b.wy)).toBeLessThan(1e-6);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('efeito alto faz a branca seguir; efeito baixo faz voltar; centro fica no meio', () => {
    // velocidade da branca ~0,6 s depois do choque frontal (já terminou de deslizar)
    const vxAfter = (top: number) => {
      const w = createWorld([
        { id: 0, x: 0.6, y: 0.635 },
        { id: 1, x: 1.1, y: 0.635 },
      ]);
      strike(w, 0, 0.4, { side: 0, top });
      for (let i = 0; i < 2000 && !w.events.some((e) => e.type === 'ball'); i++) step(w);
      for (let i = 0; i < 70; i++) step(w);
      return getBall(w, 0)!.vx;
    };
    const follow = vxAfter(1);
    const stun = vxAfter(0);
    const draw = vxAfter(-1);
    expect(follow).toBeGreaterThan(0.2);
    expect(draw).toBeLessThan(-0.15);
    expect(follow).toBeGreaterThan(stun);
    expect(stun).toBeGreaterThan(draw);
  });

  it('efeito lateral muda o ângulo de saída da tabela (e em sentidos opostos)', () => {
    const vxAfter = (side: number) => {
      const w = createWorld([{ id: 0, x: 1.0, y: 0.635 }]);
      strike(w, -Math.PI / 2, 0.45, { side, top: 0 });
      for (let i = 0; i < 3000; i++) {
        step(w);
        if (w.events.some((e) => e.type === 'cushion')) break;
      }
      return getBall(w, 0)!.vx;
    };
    const right = vxAfter(1);
    const left = vxAfter(-1);
    const none = vxAfter(0);
    expect(Math.abs(none)).toBeLessThan(1e-9);
    expect(Math.abs(right)).toBeGreaterThan(0.1);
    expect(Math.sign(right)).toBe(-Math.sign(left));
  });

  it('a guia continua exata com efeito (trecho até o 1º contato é reto)', () => {
    for (const spin of [{ side: 1, top: 0 }, { side: 0, top: -1 }, { side: -0.7, top: 0.7 }]) {
      const w = createWorld([
        { id: 0, x: 0.5, y: 0.6 },
        { id: 3, x: 1.4, y: 0.64 },
      ]);
      const hit = aimRaycast(w, 0.01);
      strike(w, 0.01, 0.5, spin);
      let pos = { x: 0, y: 0 };
      for (let i = 0; i < 3000; i++) {
        step(w);
        const e = w.events.find((ev) => ev.type === 'ball');
        if (e && e.type === 'ball') {
          pos = { x: e.x, y: e.y };
          break;
        }
      }
      expect(Math.hypot(pos.x - hit.ghost.x, pos.y - hit.ghost.y)).toBeLessThan(0.004);
    }
  });

  it('rotação visual acompanha a distância rolada (ângulo ≈ distância / raio)', () => {
    const w = createWorld([{ id: 0, x: 0.3, y: 0.635 }]);
    strike(w, 0, 0.35);
    for (let i = 0; i < 150; i++) step(w); // já rolando
    const b = getBall(w, 0)!;
    const q1 = [...b.q];
    const x1 = b.x;
    for (let i = 0; i < 6; i++) step(w);
    const dotq = Math.abs(q1[0] * b.q[0] + q1[1] * b.q[1] + q1[2] * b.q[2] + q1[3] * b.q[3]);
    const angle = 2 * Math.acos(Math.min(1, dotq));
    expect(Math.abs(angle - (b.x - x1) / R)).toBeLessThan(0.02 * angle);
    expect(Math.hypot(...b.q)).toBeCloseTo(1, 9);
  });

  it('determinismo com efeito', () => {
    const run = () => {
      const w = createWorld(initialPositions());
      strike(w, 0.02, 0.9, { side: 0.6, top: -0.5 });
      simulateUntilRest(w);
      return w.balls.map((b) => [b.id, b.x, b.y, b.pocketed]);
    };
    expect(run()).toEqual(run());
  });
});

describe('caçapas — área de queda = buraco desenhado', () => {
  it('bola mirada até 3 cm fora do centro da boca de canto cai', () => {
    const pk = TABLE.pockets[0];
    for (const off of [-0.03, 0, 0.03]) {
      const from = { x: 0.5, y: 0.5 };
      const tx = pk.aim.x - pk.axis.y * off;
      const ty = pk.aim.y + pk.axis.x * off;
      const w = createWorld([{ id: 0, ...from }]);
      strike(w, Math.atan2(ty - from.y, tx - from.x), 0.3);
      simulateUntilRest(w);
      expect(getBall(w, 0)!.pocketId).toBe(0);
    }
  });

  it('quando a bola cai, o centro dela está dentro do círculo do buraco', () => {
    const pk = TABLE.pockets[4];
    const w = createWorld([{ id: 0, x: TABLE.length / 2 + 0.02, y: 0.7 }]);
    strike(w, Math.PI / 2, 0.3);
    let pos = { x: 0, y: 0 };
    for (let i = 0; i < 4000; i++) {
      const b = getBall(w, 0)!;
      pos = { x: b.x, y: b.y };
      step(w);
      if (b.pocketed) break;
    }
    expect(getBall(w, 0)!.pocketed).toBe(true);
    expect(Math.hypot(pos.x - pk.center.x, pos.y - pk.center.y)).toBeLessThan(pk.captureRadius + 0.02);
  });
});
