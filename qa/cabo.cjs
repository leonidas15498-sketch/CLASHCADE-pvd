// QA: Cabo de Guerra — toque no tempo puxa (perfeito/bom), metralhar escorrega, 2P simultâneo (dois dedos na mesma
// batida), IA termina a partida. Uso: node qa/cabo.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const vp of [{ width: 915, height: 412, n: 'deitado' }, { width: 412, height: 860, n: 'em-pe' }]) {
    const ctx = await b.newContext({ viewport: vp, locale: 'pt-BR', hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: i })) });
    const dbg = () => p.evaluate(() => window.__tug.debug());
    await p.goto('http://localhost:4174/#cabo-de-guerra');
    await p.waitForFunction(() => window.__tug);
    await p.click('[data-k="play-local"]');
    const box = await p.$eval('.gs-stage canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const land = vp.width > vp.height;
    const P1 = land ? [box.x + box.w * 0.25, box.y + box.h * 0.6] : [box.x + box.w * 0.5, box.y + box.h * 0.8];
    const P2 = land ? [box.x + box.w * 0.75, box.y + box.h * 0.6] : [box.x + box.w * 0.5, box.y + box.h * 0.2];
    // espera a batida e toca no tempo: J1 sozinho em 4 batidas (corda vai para o lado do J1 = negativo)
    const onBeat = async (pts) => {
      const d = await dbg();
      const wait = (d.nextBeat - d.t) * 1000 - 8;
      if (wait > 0) await p.waitForTimeout(wait);
      await touch('touchStart', pts);
      await touch('touchEnd', []);
    };
    for (let i = 0; i < 4; i++) await onBeat([P1]);
    const a = await dbg();
    console.log(`[${vp.n}] J1 no tempo ×4: corda ${a.rope.toFixed(1)} (negativo = lado do J1) | J1 perfeitos ${a.stats[0].perfect}, bons ${a.stats[0].good}, fora ${a.stats[0].off}`);
    // dois dedos ao mesmo tempo na mesma batida: os dois contam
    const before = await dbg();
    await onBeat([P1, P2]);
    await p.waitForTimeout(30);
    const two = await dbg();
    const hits = (s) => s.perfect + s.good;
    console.log(`[${vp.n}] dois dedos juntos: J1 +${hits(two.stats[0]) - hits(before.stats[0])} acerto, J2 +${hits(two.stats[1]) - hits(before.stats[1])} acerto`);
    // metralhar: J2 toca 25× em ~1,2 s
    const r0 = (await dbg()).rope;
    for (let i = 0; i < 25; i++) {
      await touch('touchStart', [P2]);
      await touch('touchEnd', []);
      await p.waitForTimeout(45);
    }
    const r1 = await dbg();
    console.log(`[${vp.n}] J2 metralhou 25×: corda ${r0.toFixed(1)} → ${r1.rope.toFixed(1)} (positivo seria bom para o J2) | J2 fora ${r1.stats[1].off}`);
    await p.screenshot({ path: `${out}/cabo-${vp.n}.png` });
    // contra a IA Difícil, humano parado: IA deve vencer
    await p.click('[data-k="home"]');
    await p.click('[data-k="c-yes"]');
    await p.click('[data-k="diff"] button[data-d="hard"]');
    await p.click('[data-k="play-ai"]');
    await p.waitForFunction(() => window.__tug.debug()?.over, null, { timeout: 70000 });
    await p.waitForTimeout(1300);
    const e = await dbg();
    console.log(`[${vp.n}] IA Difícil sozinha: venceu ${e.winner === 1} em ${e.t.toFixed(1)} s | resultado "${await p.$eval('[data-k="r-title"]', (x) => x.textContent)}"`);
    await ctx.close();
  }
  console.log('ERROS:', errs.length ? [...new Set(errs)].join(' | ') : 'nenhum');
  await b.close();
})();
