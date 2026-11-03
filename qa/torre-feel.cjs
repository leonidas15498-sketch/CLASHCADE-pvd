// QA: game feel da Torre de Bichinhos (01/11) — faixa de vez, impacto (som/partículas/tremor), câmera com zoom que
// nunca esconde a base. Celular deitado e em pé. Uso: node qa/torre-feel.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const vp of [{ width: 915, height: 412, n: 'deitado' }, { width: 412, height: 860, n: 'em-pe' }]) {
    const p = await (await b.newContext({ viewport: vp, locale: 'pt-BR', hasTouch: true })).newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    const dbg = () => p.evaluate(() => window.__stack.debug());
    await p.goto('http://localhost:4174/#empilha');
    await p.waitForFunction(() => window.__stack);
    await p.click('[data-k="play-local"]');
    await p.waitForTimeout(300);
    const d0 = await dbg();
    console.log(`[${vp.n}] faixa no início: "${d0.banner}" | cor`, await p.$eval('[data-k="turn-banner"]', (e) => e.style.background));
    let zoomMin = 1;
    let baseOk = true;
    let banners = new Set();
    for (let i = 0; i < 14; i++) {
      // pequenas variações de posição: pilha cresce no centro
      await p.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await p.keyboard.press(' ');
      await p.waitForTimeout(80);
      banners.add((await dbg()).banner);
      const r = await p.waitForFunction(() => { const d = window.__stack.debug(); return d && (d.phase === 'aim' || d.phase === 'over') ? d.phase : null; }, null, { timeout: 12000 }).then((h) => h.jsonValue());
      await p.waitForTimeout(900); // câmera alcança
      const d = await dbg();
      banners.add(d.banner);
      zoomMin = Math.min(zoomMin, d.zoom);
      if (d.baseScreenY > d.canvasH + 1 || d.baseScreenY < 0) baseOk = false;
      if (r === 'over') break;
    }
    const d = await dbg();
    console.log(`[${vp.n}] peças ${d.placed} | topo ${d.top.toFixed(2)} u | zoom mínimo ${zoomMin.toFixed(2)} | topo do pedestal sempre na tela: ${baseOk} (y ${d.baseScreenY.toFixed(0)} de ${d.canvasH.toFixed(0)} px)`);
    console.log(`[${vp.n}] impactos ${d.hits.n} | tremores ${d.hits.shakes} | maior tremor ${d.hits.maxShake.toFixed(1)} px | faixas vistas: ${[...banners].filter(Boolean).join(' / ')}`);
    await p.screenshot({ path: `${out}/torre-${vp.n}.png` });
    await p.close();
  }
  console.log('ERROS:', errs.length ? [...new Set(errs)].join(' | ') : 'nenhum');
  await b.close();
})();
