const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  const music = [];
  p.on('response', (r) => r.url().includes('/music/') && music.push(r.url().split('/').pop() + ' ' + r.status()));
  const W = (ms) => p.waitForTimeout(ms);

  // ---------- SINUCA
  await p.goto('http://localhost:4174/');
  await p.evaluate(() => localStorage.setItem('sinuca8.prefs.v1', JSON.stringify({ table: 'halloween', trail: 'chama' })));
  await p.goto('http://localhost:4174/#sinuca');
  await p.waitForFunction(() => window.__sinuca);
  await p.click('#btn-play-local');
  await W(500);
  // tacada de abertura forte direto no triângulo
  await p.evaluate(() => { const a = window.__sinuca; const g = a.game; const c = g.world.balls[0]; const s = g.world.table.footSpot; a.beginStrike(Math.atan2(s.y - c.y, s.x - c.x), 1); });
  let maxTrail = 0, maxFx = 0, pots = 0, shot = false;
  for (let i = 0; i < 60; i++) {
    await W(80);
    const r = await p.evaluate(() => { const a = window.__sinuca; return { t: a.trailBuf.pts.length, f: a.fx.items.length, pk: a.game.world.balls.filter((b) => b.pocketed).length }; });
    maxTrail = Math.max(maxTrail, r.t); maxFx = Math.max(maxFx, r.f); pots = r.pk;
    if (i === 2) { await p.screenshot({ path: OUT + '/sinuca-rastro-chama.png' }); shot = true; }
  }
  console.log('SINUCA break: rastro max pts', maxTrail, '| partículas max', maxFx, '| bolas encaçapadas', pots);
  await p.waitForFunction(() => window.__sinuca.game.phase !== 'rolling', null, { timeout: 30000 });
  // bola 1 encaçapada de verdade no canto superior esquerdo (com branca alinhada atrás)
  await p.evaluate(() => { const a = window.__sinuca; const g = a.game; a.clearFx();
    const pk = g.world.table.pockets.reduce((m, k) => (k.center.x + k.center.y < m.center.x + m.center.y ? k : m));
    const d = Math.SQRT1_2; const ob = g.world.balls.find((b) => b.id === 1); const c = g.world.balls[0];
    for (const b of g.world.balls) if (b.id > 1) { b.pocketed = false; }
    ob.x = ob.px = pk.center.x + 0.18 * d; ob.y = ob.py = pk.center.y + 0.18 * d; ob.vx = ob.vy = 0;
    c.x = c.px = pk.center.x + 0.4 * d; c.y = c.py = pk.center.y + 0.4 * d; c.vx = c.vy = 0;
    window.__pk = pk; });
  await W(600);
  const before = await p.evaluate(() => ({ phase: window.__sinuca.game.phase, cur: window.__sinuca.game.match.current }));
  await p.evaluate(() => window.__sinuca.beginStrike(Math.PI + Math.PI / 4, 0.35));
  let potFx = 0, potted = false;
  for (let i = 0; i < 40; i++) { await W(30); const r = await p.evaluate(() => ({ f: window.__sinuca.fx.items.length, pk: window.__sinuca.game.world.balls.find((b) => b.id === 1).pocketed })); if (r.f > potFx) { potFx = r.f; if (r.f > 8 && i === 6) { await p.screenshot({ path: OUT + '/sinuca-explosao-halloween.png' }); } } potted = r.pk; if (potted && potFx > 8 && i > 8) break; }
  console.log('SINUCA caçapa real:', JSON.stringify(before), 'encaçapou', potted, '| partículas', potFx);
  // aba Rastro no Personalizar
  await p.evaluate(() => window.__sinuca.pause?.());
  await p.evaluate(() => { document.getElementById('btn-pause-cues')?.click() || document.getElementById('btn-menu-cues')?.click(); });
  await W(300);
  await p.click('#sec-trail').catch((e) => errs.push('click sec-trail: ' + e.message));
  await W(500);
  const cards = await p.$$eval('#trail-list .table-card', (c) => c.length);
  console.log('SINUCA aba Rastro: cartões', cards);
  await p.screenshot({ path: OUT + '/sinuca-aba-rastro.png' });

  // ---------- MINIGOLFE
  await p.evaluate(() => localStorage.setItem('jogaco.minigolf', JSON.stringify({ v: 1, data: { sound: true, music: { enabled: true, volume: 0.4 }, name1: 'Leon', names: ['', ''], bestTotal: null, bestHole: Array(9).fill(null), rounds: 0, course: 'halloween', trail: 'morcegos' } })));
  await p.goto('http://localhost:4174/#minigolfe');
  await p.waitForFunction(() => window.__minigolf);
  await p.evaluate(() => { const a = window.__minigolf; a.start('solo', ['Leon'], [0,1,2,3,4,5,6,7,8]); });
  await W(600);
  const hole = await p.evaluate(async () => {
    const a = window.__minigolf; const w = a.world; const h = a.level.hole;
    w.x = w.px = h.x - 1.6; w.y = w.py = h.y + 0.3; w.vx = 6; w.vy = 0; w.status = 'moving'; w.events = []; w.overCup = false; a.phase = 'rolling';
    await new Promise((r) => setTimeout(r, 330));
    return { status: w.status, lip: w.events.filter((e) => e.type === 'lip').length, fx: a.fx.items.length, toast: document.getElementById('mg-toast').textContent };
  });
  console.log('GOLFE devagar:', JSON.stringify(hole));
  await p.screenshot({ path: OUT + '/golfe-explosao-halloween.png' });

  await p.evaluate(() => { document.querySelectorAll('.show').forEach((e) => e.classList.remove('show')); const a = window.__minigolf; a.restartHole ? a.restartHole() : 0; });
  await W(800);
  const lip = await p.evaluate(async () => {
    const a = window.__minigolf; const w = a.world; const h = a.level.hole;
    w.x = w.px = h.x - 4; w.y = w.py = h.y; w.vx = 24; w.vy = 0; w.status = 'moving'; w.events = []; w.overCup = false; a.phase = 'rolling';
    await new Promise((r) => setTimeout(r, 450));
    return { toast: document.getElementById('mg-toast').textContent, show: document.getElementById('mg-toast').classList.contains('show'), lip: w.events.filter((e) => e.type === 'lip').length };
  });
  console.log('GOLFE rápido demais:', JSON.stringify(lip));
  await p.screenshot({ path: OUT + '/golfe-forte-demais.png' });
  // ---------- AIR HOCKEY
  await p.goto('http://localhost:4174/#air-hockey');
  await p.waitForFunction(() => window.__airhockey);
  await p.mouse.click(400, 200);
  await W(400);
  const btns = await p.$$eval('button', (bs) => bs.filter((b) => b.offsetParent).map((b) => b.textContent.trim()).slice(0, 12));
  console.log('HOCKEY botões visíveis:', btns.join(' | '));
  const play = await p.$('button:has-text("IA")');
  if (play) await play.click();
  await W(2500);
  await p.screenshot({ path: OUT + '/hockey.png' });
  console.log('MÚSICAS baixadas:', music.join(', '));
  console.log('ERROS:', errs.length ? errs.join('\n') : 'nenhum');
  await b.close();
})();
