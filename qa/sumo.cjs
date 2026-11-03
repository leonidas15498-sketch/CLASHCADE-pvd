// QA: Sumô Neon — abre pelo catálogo, contra IA (joystick move, toque rápido = avanço), 2P com dois dedos ao mesmo
// tempo (multitoque real por CDP), partida até o fim, em pé e deitado. Uso: node qa/sumo.cjs <pasta-de-saida>
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
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q[0], y: q[1], id: q[2] ?? i })) });
    const dbg = () => p.evaluate(() => window.__sumo.debug());
    await p.goto('http://localhost:4174/');
    await p.waitForTimeout(300);
    const card = !!(await p.$('text=Sumô Neon'));
    await p.goto('http://localhost:4174/#sumo-neon');
    await p.waitForFunction(() => window.__sumo);
    await p.click('[data-k="diff"] button[data-d="medium"]');
    await p.click('[data-k="play-ai"]');
    await p.waitForTimeout(1300); // contagem
    const box = await p.$eval('.gs-stage canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const cx = box.x + box.w * 0.5;
    const cy = box.y + box.h * 0.75;
    // joystick: arrasta "para a direita da tela"
    await touch('touchStart', [[cx, cy]]);
    await touch('touchMove', [[cx + 60, cy]]);
    await p.waitForTimeout(250);
    const mv = await dbg();
    await touch('touchEnd', []);
    // toque rápido = avanço
    const cd0 = (await dbg()).w[0].cd;
    await touch('touchStart', [[cx, cy]]);
    await touch('touchEnd', []);
    await p.waitForTimeout(50);
    const cd1 = (await dbg()).w[0].cd;
    console.log(`[${vp.n}] catálogo tem o cartão: ${card} | joystick: entrada (${mv.w[0].ix.toFixed(2)}, ${mv.w[0].iy.toFixed(2)}) vel ${Math.hypot(mv.w[0].vx, mv.w[0].vy).toFixed(2)} u/s | avanço: recarga ${cd0.toFixed(2)} → ${cd1.toFixed(2)} | em pé detectado: ${mv.portrait}`);
    // deixa a IA terminar a partida (humano parado)
    await p.waitForFunction(() => window.__sumo.debug()?.winner !== null, null, { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(1300);
    const end = await dbg();
    console.log(`[${vp.n}] vs IA Médio (humano parado): placar ${end.wins.join(' × ')} vencedor ${end.winner} | resultado: "${await p.$eval('[data-k="r-title"]', (e) => e.textContent)}" | choques ${end.stats.hits}`);
    await p.screenshot({ path: `${out}/sumo-${vp.n}-fim.png` });
    // 2P: dois dedos ao mesmo tempo, cada um na sua metade
    await p.click('[data-k="r-new"]');
    await p.click('[data-k="play-local"]');
    await p.waitForTimeout(1300);
    const half = vp.width > vp.height ? [[box.x + box.w * 0.25, box.y + box.h * 0.5], [box.x + box.w * 0.75, box.y + box.h * 0.5]] : [[box.x + box.w * 0.5, box.y + box.h * 0.75], [box.x + box.w * 0.5, box.y + box.h * 0.25]];
    await touch('touchStart', [[half[0][0], half[0][1], 1], [half[1][0], half[1][1], 2]]);
    await touch('touchMove', [[half[0][0] + 50, half[0][1] - 20, 1], [half[1][0] - 50, half[1][1] + 20, 2]]);
    await p.waitForTimeout(200);
    const two = await dbg();
    console.log(`[${vp.n}] 2P dois dedos: J1 entrada (${two.w[0].ix.toFixed(2)}, ${two.w[0].iy.toFixed(2)}) · J2 entrada (${two.w[1].ix.toFixed(2)}, ${two.w[1].iy.toFixed(2)}) · joysticks ativos ${two.sticks}`);
    await p.screenshot({ path: `${out}/sumo-${vp.n}-2p.png` });
    await touch('touchEnd', []);
    await ctx.close();
  }
  console.log('ERROS:', errs.length ? [...new Set(errs)].join(' | ') : 'nenhum');
  await b.close();
})();
