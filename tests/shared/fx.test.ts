import { describe, expect, it } from 'vitest';
import { burstsEnabled, setBurstsEnabled, BURSTS, MAX_PARTICLES, ParticleSystem, TRAILS, TrailBuffer, usableTrail } from '../../src/games/shared/fx';
import { TABLE_THEMES } from '../../src/games/pool/game/tables';
import { COURSE_THEMES } from '../../src/games/minigolf/render/courses';

const rng = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('efeitos cosméticos (rastro e explosão)', () => {
  it('toda mesa e todo campo têm efeito válido; os grátis usam o simples', () => {
    for (const t of [...TABLE_THEMES, ...COURSE_THEMES]) {
      expect(BURSTS[t.burst]).toBeDefined();
      if (t.tier === 'free') expect(t.burst).toBe('simples');
    }
    expect(TABLE_THEMES.find((t) => t.id === 'halloween')!.burst).toBe('abobora');
    expect(COURSE_THEMES.find((t) => t.id === 'halloween')!.burst).toBe('abobora');
  });

  it('Halloween solta abóboras e caveiras; tudo some em menos de 1,2 s', () => {
    const fx = new ParticleSystem(rng(), 1);
    fx.burst('abobora', 0, 0, 1);
    const kinds = new Set(fx.items.map((p) => p.kind));
    expect(kinds.has('pumpkin') && kinds.has('skull')).toBe(true);
    for (let i = 0; i < 72; i++) fx.update(1 / 60);
    expect(fx.items.length).toBe(0);
  });

  it('partículas ficam perto da caçapa (≤ 6 raios de bola) e nunca passam do limite', () => {
    const fx = new ParticleSystem(rng(3), 1);
    fx.burst('faiscas', 0, 0, 1);
    let maxD = 0;
    while (fx.items.length) {
      fx.update(1 / 60);
      for (const p of fx.items) maxD = Math.max(maxD, Math.hypot(p.x, p.y));
    }
    expect(maxD).toBeLessThanOrEqual(6);
    for (let i = 0; i < 40; i++) fx.burst('confete', 0, 0, 1);
    expect(fx.items.length).toBeLessThanOrEqual(MAX_PARTICLES);
  });

  it('menos animação (densidade 0,35) cria bem menos partículas', () => {
    const a = new ParticleSystem(rng(), 1);
    const b = new ParticleSystem(rng(), 0.35);
    a.burst('abobora', 0, 0, 1);
    b.burst('abobora', 0, 0, 1);
    expect(b.items.length).toBeLessThan(a.items.length * 0.5);
  });

  it('rastro: por tempo e distância (igual em qualquer FPS), some quando a bola para; id inválido cai no padrão', () => {
    // mesmo trajeto (0 → 3 m em 1 s) a 30 e a 120 FPS: comprimento do rastro igual, independe do FPS
    const len = (fps: number) => {
      const t = new TrailBuffer(0.3, 0.05);
      for (let i = 0; i <= fps; i++) t.push((3 * i) / fps, 0, i / fps);
      const p = t.pts;
      return p[p.length - 1].x - p[0].x;
    };
    expect(Math.abs(len(30) - len(120))).toBeLessThan(0.11);
    expect(len(60)).toBeCloseTo(0.9, 0);
    // bola lenta não acumula pontos (distância mínima)
    const slow = new TrailBuffer(0.3, 0.05);
    for (let i = 0; i < 100; i++) slow.push(i * 0.001, 0, i / 1000);
    expect(slow.pts.length).toBeLessThanOrEqual(3);
    // parou: some depois de maxAge
    slow.prune(10);
    expect(slow.pts.length).toBe(0);
    expect(usableTrail('nao-existe', 'sombra')).toBe('sombra');
    expect(TRAILS.filter((x) => x.tier === 'premium').length).toBeGreaterThanOrEqual(5);
  });
});

describe('efeitos podem ser desligados', () => {
  it('com a opção desligada, a explosão não cria partículas; religar volta', () => {
    setBurstsEnabled(false);
    expect(burstsEnabled()).toBe(false);
    const fx = new ParticleSystem(rng(), 1);
    fx.burst('abobora', 0, 0, 1);
    expect(fx.items.length).toBe(0);
    setBurstsEnabled(true);
    fx.burst('abobora', 0, 0, 1);
    expect(fx.items.length).toBeGreaterThan(0);
  });
});
