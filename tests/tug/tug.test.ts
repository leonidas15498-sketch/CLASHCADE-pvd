import { describe, expect, it } from 'vitest';
import { advance, bpmAt, createTug, tap, TUG } from '../../src/games/tug/logic';
import { tugDuel } from '../bench/tug';

describe('cabo de guerra — ritmo e regras', () => {
  it('batidas aceleram de 100 a 140 BPM e cobrem a partida inteira', () => {
    const s = createTug();
    expect(s.beats[0]).toBeCloseTo(TUG.lead, 6);
    expect(s.beats[1] - s.beats[0]).toBeCloseTo(60 / TUG.bpm0, 6);
    expect(bpmAt(1000)).toBe(TUG.bpm1);
    expect(s.beats[s.beats.length - 1]).toBeGreaterThan(TUG.maxTime);
  });

  it('perfeito puxa mais que bom; fora do tempo escorrega; o combo multiplica', () => {
    const s = createTug();
    const b = s.beats;
    expect(tap(s, 0, b[0] + 0.02)!.judge).toBe('perfect');
    expect(s.rope).toBeCloseTo(-TUG.pullPerfect, 6);
    expect(tap(s, 1, b[0] + 0.1)!.judge).toBe('good');
    expect(s.rope).toBeCloseTo(-TUG.pullPerfect + TUG.pullGood, 6);
    // 2º acerto seguido do J1 já vem com combo ×1,1
    const e = tap(s, 0, b[1])!;
    expect(e.pull).toBeCloseTo(TUG.pullPerfect * 1.1, 6);
    // fora da janela
    const mid = (b[2] + b[3]) / 2;
    const off = tap(s, 0, mid)!;
    expect(off.judge).toBe('off');
    expect(s.combo[0]).toBe(0);
  });

  it('dois toques na mesma batida: o segundo conta como erro (metralhar não compensa)', () => {
    const s = createTug();
    tap(s, 0, s.beats[0]);
    const r = s.rope;
    expect(tap(s, 0, s.beats[0] + 0.03)!.judge).toBe('double');
    expect(s.rope).toBeGreaterThan(r); // escorregou para o lado do J2
    // metralhar a 20 toques/s por 10 s perde para quem não toca nada
    const m = createTug();
    for (let t = TUG.lead; t < TUG.lead + 10; t += 0.05) {
      tap(m, 0, t);
      advance(m, t);
    }
    expect(m.rope).toBeGreaterThan(0);
  });

  it('batida sem toque zera o combo; corda no limite encerra; tempo esgotado decide pelo lado', () => {
    const s = createTug();
    tap(s, 0, s.beats[0]);
    advance(s, s.beats[1] + TUG.good + 0.01);
    expect(s.combo[0]).toBe(0);
    const w = createTug();
    w.rope = TUG.ropeWin - 1;
    tap(w, 1, w.beats[0]);
    expect(w.over).toBe(true);
    expect(w.winner).toBe(1);
    const tt = createTug();
    tt.rope = -0.5;
    advance(tt, TUG.maxTime);
    expect(tt.winner).toBe(0);
    const d = createTug();
    advance(d, TUG.maxTime);
    expect(d.winner).toBe(null);
  });

  it('IA: Fácil < Médio < Difícil com folga', () => {
    expect(tugDuel('medium', 'easy', 30).win).toBeGreaterThan(0.75);
    expect(tugDuel('hard', 'medium', 30).win).toBeGreaterThan(0.75);
  }, 60_000);
});
