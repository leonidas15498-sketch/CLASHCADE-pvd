// QA: interruptor "Efeito quando a bola cai" desligado → nenhuma partícula (sinuca e golfe); religado → volta.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto('http://localhost:4174/#sinuca');
  await p.waitForFunction(() => window.__sinuca);
  await p.click('#btn-menu-cues'); await p.click('#sec-trail'); await W(200);
  await p.click('.fx-toggle input'); // desliga
  const checked = await p.$eval('.fx-toggle input', (i) => i.checked);
  await p.click('#btn-cues-close');
  await p.click('#btn-play-local'); await W(300);
  const pot = async () => p.evaluate(async () => { const a = window.__sinuca; const g = a.game;
    const pk = g.world.table.pockets.reduce((m, k) => (k.center.x + k.center.y < m.center.x + m.center.y ? k : m)); const d = Math.SQRT1_2;
    const ob = g.world.balls.find((b) => b.id !== 0 && !b.pocketed); const c = g.world.balls[0];
    ob.x = ob.px = pk.center.x + 0.18 * d; ob.y = ob.py = pk.center.y + 0.18 * d; ob.vx = ob.vy = 0;
    c.x = c.px = pk.center.x + 0.4 * d; c.y = c.py = pk.center.y + 0.4 * d; c.vx = c.vy = 0; c.pocketed = false;
    a.beginStrike(Math.PI * 1.25, 0.35); let mx = 0;
    for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 30)); mx = Math.max(mx, a.fx.items.length); }
    return { caiu: ob.pocketed, particulas: mx }; });
  console.log('SINUCA desligado (checkbox marcado?', checked, '):', JSON.stringify(await pot()));
  await p.reload(); await p.waitForFunction(() => window.__sinuca);
  console.log('SINUCA preferência guardada após recarregar:', await p.evaluate(() => localStorage.getItem('jogaco.fx.v1')));
  await p.goto('http://localhost:4174/#minigolfe'); await p.waitForFunction(() => window.__minigolf);
  await p.evaluate(() => window.__minigolf.start('solo', ['Leon'], [0, 1, 2, 3, 4, 5, 6, 7, 8])); await W(400);
  const golf = await p.evaluate(async () => { const a = window.__minigolf; const w = a.world; const h = a.level.hole;
    w.x = w.px = h.x - 1.6; w.y = w.py = h.y; w.vx = 6; w.vy = 0; w.status = 'moving'; w.events = []; a.phase = 'rolling';
    let mx = 0; for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 30)); mx = Math.max(mx, a.fx.items.length + a.particles.length); }
    return { status: w.status, particulas: mx }; });
  console.log('GOLFE desligado:', JSON.stringify(golf));
  // religa pela aba do golfe
  await p.evaluate(() => document.querySelectorAll('.show').forEach((e) => e.classList.remove('show')));
  await p.evaluate(() => { document.getElementById('mg-pause-putters')?.click(); }); await W(200);
  await p.click('#mg-sec-trail'); await W(200); await p.click('.fx-toggle input');
  console.log('Religado pelo golfe:', await p.evaluate(() => localStorage.getItem('jogaco.fx.v1')));
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
