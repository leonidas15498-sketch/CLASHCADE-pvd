import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/games/pool/ai/ai';
import { PLATFORM, StackMatch, StackWorld } from '../../src/games/stack/logic';
import { PIECES } from '../../src/games/stack/pieces';
import { soloHeight } from '../bench/stack';

const finish = (m: StackMatch) => {
  let r = null;
  for (let i = 0; i < 2000 && r === null; i++) r = m.tick();
  return r;
};

describe('empilha — física e regras', () => {
  it('toda peça, sozinha no centro da mesa, para em pé sem cair (em 0° e 90°)', () => {
    for (const p of PIECES)
      for (const a of [0, Math.PI / 2]) {
        const m = new StackMatch(2, makeRng(1));
        m.piece = p.id;
        m.drop(0, a);
        expect(finish(m), `${p.id} ${a}`).toBe('next');
        expect(m.sw.topY()).toBeGreaterThan(0.3);
      }
  });

  it('peça solta fora da mesa cai e quem jogou perde', () => {
    const m = new StackMatch(2, makeRng(2));
    m.drop(PLATFORM.w / 2 + 1, 0);
    expect(finish(m)).toBe('fell');
    expect(m.loser).toBe(0);
    expect(m.phase).toBe('over');
  });

  it('a vez alterna no 2P e não alterna no solo; contagem de peças', () => {
    const m = new StackMatch(2, makeRng(3));
    m.drop(0, 0);
    finish(m);
    expect(m.current).toBe(1);
    expect(m.placed).toBe(1);
    const s = new StackMatch(1, makeRng(3));
    s.drop(0, 0);
    finish(s);
    expect(s.current).toBe(0);
    expect(s.placed).toBe(1);
  });

  it('a peça pendurada fica acima do topo da pilha (não nasce dentro dela)', () => {
    const m = new StackMatch(2, makeRng(4));
    for (let i = 0; i < 3; i++) {
      m.drop(0, 0);
      finish(m);
    }
    const top = m.sw.topY();
    for (const a of [0, Math.PI / 4, Math.PI / 2]) expect(m.holdY(a)).toBeGreaterThan(top);
  });

  it('cópia do mundo (usada pela IA) reproduz posições', () => {
    const m = new StackMatch(2, makeRng(5));
    m.drop(0.3, 0);
    finish(m);
    const w2 = StackWorld.from(m.sw.snapshot());
    expect(w2.pieces[0].body.getPosition().x).toBeCloseTo(m.sw.pieces[0].body.getPosition().x, 6);
  });
});

describe('empilha — IA', () => {
  it('níveis: sozinha, Fácil empilha bem menos que Médio, e Difícil pelo menos tanto quanto Médio', () => {
    const e = soloHeight('easy', 6, 12, 11).pieces;
    const m = soloHeight('medium', 6, 12, 11).pieces;
    const h = soloHeight('hard', 4, 12, 11).pieces;
    expect(m).toBeGreaterThan(e + 2.5);
    expect(h).toBeGreaterThanOrEqual(m - 0.5);
  }, 240_000);
});
