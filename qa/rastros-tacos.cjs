// QA: todos os rastros (sobra algo depois que a bola para?) + escolha de taco por jogador no cartão 2P.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
const TRAILS = ['sombra', 'chama', 'neon', 'estrelas', 'fumaca', 'morcegos'];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 2 })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  await p.goto('http://localhost:4174/');
  await p.evaluate(() => localStorage.clear());
  // ---- taco por jogador (sinuca)
  await p.goto('http://localhost:4174/#sinuca');
  await p.waitForFunction(() => window.__sinuca);
  const before = await p.$$eval('.cue-pick', (b) => b.map((x) => x.textContent));
  await p.click('#btn-cue-p2');
  await W(300);
  const tabOn = await p.$eval('.cue-tab.on', (e) => e.textContent);
  await p.click('#cue-list button:not([disabled])');
  await p.click('#btn-cues-close');
  const after = await p.$$eval('.cue-pick', (b) => b.map((x) => x.textContent));
  console.log('SINUCA taco 2P: antes', JSON.stringify(before), '| aba aberta:', tabOn, '| depois', JSON.stringify(after));
  await p.screenshot({ path: OUT + '/sinuca-menu-tacos.png' });
  // ---- rastros (sinuca): cada um numa tacada; depois que tudo para, nada pode sobrar
  for (const t of TRAILS) {
    await p.evaluate((t) => { const a = window.__sinuca; a.prefs.trail = t; }, t);
    await p.evaluate(() => { const a = window.__sinuca; if (!a.game) document.getElementById('btn-play-local').click(); });
    await W(300);
    await p.waitForFunction(() => window.__sinuca.game.phase !== 'rolling', null, { timeout: 30000 });
    await p.evaluate(() => { const a = window.__sinuca; const g = a.game; const c = g.world.balls[0];
      const alvo = g.world.balls.find((b) => b.id !== 0 && !b.pocketed); a.beginStrike(Math.atan2(alvo.y - c.y, alvo.x - c.x), 0.8); });
    let maxPts = 0, shot = false;
    for (let i = 0; i < 12; i++) { await W(60); const n = await p.evaluate(() => window.__sinuca.trailBuf.pts.length); maxPts = Math.max(maxPts, n); if (!shot && n > 8) { await p.screenshot({ path: `${OUT}/rastro-${t}.png` }); shot = true; } }
    await p.waitForFunction(() => window.__sinuca.game.phase !== 'rolling', null, { timeout: 30000 });
    await W(1500);
    const left = await p.evaluate(() => ({ pts: window.__sinuca.trailBuf.pts.length, fx: window.__sinuca.fx.items.length }));
    console.log(`SINUCA rastro ${t}: máx ${maxPts} pontos | depois de parar: rastro ${left.pts}, partículas ${left.fx}`);
  }
  // ---- golfe: rastro + taco 2P
  await p.goto('http://localhost:4174/#minigolfe');
  await p.waitForFunction(() => window.__minigolf);
  await p.click('#mg-putter-p2');
  await W(300);
  const gtab = await p.$eval('.mg-ptab.on', (e) => e.textContent);
  await p.click('#mg-putter-grid button:not([disabled])');
  await p.click('#mg-putters-close');
  console.log('GOLFE taco 2P: aba aberta:', gtab, '| botões', JSON.stringify(await p.$$eval('.mg-cue-pick', (b) => b.map((x) => x.textContent))));
  await p.evaluate(() => window.__minigolf.start('solo', ['Leon'], [0, 1, 2, 3, 4, 5, 6, 7, 8]));
  await W(500);
  for (const t of TRAILS) {
    const r = await p.evaluate(async (t) => {
      const a = window.__minigolf; a.save.trail = t; const w = a.world; const h = a.level.hole;
      w.x = w.px = h.x - 20; w.y = w.py = h.y - 6; w.vx = 12; w.vy = 0; w.status = 'moving'; w.events = []; a.phase = 'rolling';
      await new Promise((r) => setTimeout(r, 400)); const mid = a.trail.pts.length;
      await new Promise((r) => setTimeout(r, 3500));
      return { mid, left: a.trail.pts.length, fx: a.fx.items.length, status: w.status };
    }, t);
    console.log(`GOLFE rastro ${t}: andando ${r.mid} pontos | parado: rastro ${r.left}, partículas ${r.fx} (${r.status})`);
    await p.evaluate(() => document.querySelectorAll('.show').forEach((e) => e.classList.remove('show')));
  }
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
