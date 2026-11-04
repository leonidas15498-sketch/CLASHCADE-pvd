// QA: aviso "Cante a caçapa da bola 8" (pedido do Leon 03/11). Força a situação "só falta a 8" em 2P local e contra a IA.
// Uso: npx vite preview --port 4174 --strictPort  →  node qa/sinuca-bola8.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const [mode, vp] of [['local', { width: 915, height: 412 }], ['ai', { width: 732, height: 276 }]]) {
    const p = await b.newPage({ viewport: vp, locale: 'pt-BR' });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:4174/#sinuca');
    await p.waitForFunction(() => window.__sinuca);
    await p.evaluate((mode) => {
      const a = window.__sinuca;
      a.start(mode, ['Ana', 'Bia']);
      const g = a.game;
      for (const bl of g.world.balls) if (bl.id >= 1 && bl.id <= 7) { bl.pocketed = true; bl.x = bl.px = 99; }
      g.match = { ...g.match, isBreak: false, tableOpen: false, ballInHand: 'none', current: 0, calledPocket: null, shotCount: 5,
        players: [{ ...g.match.players[0], group: 'solids' }, { ...g.match.players[1], group: 'stripes' }] };
    }, mode);
    const look = () => p.evaluate(() => {
      const el = document.getElementById('call8'); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { cls: el.className, op: Number(cs.opacity).toFixed(2), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), sub: document.getElementById('sub').textContent };
    });
    await p.waitForTimeout(600);
    const a1 = await look();
    await p.screenshot({ path: `${out}/bola8-${mode}-meio.png` });
    await p.waitForTimeout(2300);
    const a2 = await look();
    await p.screenshot({ path: `${out}/bola8-${mode}-depois.png` });
    // toque real numa caçapa (canto superior esquerdo) pela tela
    const pt = await p.evaluate(() => { const a = window.__sinuca; const pk = a.game.world.table.pockets[0]; const r = a.canvas.getBoundingClientRect();
      const R = a.renderer; const s = { x: R.ox + pk.center.x * R.scale, y: R.oy + pk.center.y * R.scale }; return s ? { x: r.left + s.x, y: r.top + s.y } : null; });
    if (pt) await p.mouse.click(pt.x, pt.y); else await p.evaluate(() => window.__sinuca.game.callPocket(0));
    await p.waitForTimeout(300);
    const a3 = await look();
    const called = await p.evaluate(() => window.__sinuca.game.match.calledPocket);
    console.log(`[${mode} ${vp.width}x${vp.height}] 0,6 s: ${a1.cls} opac ${a1.op} centro (${a1.x},${a1.y}) | 2,9 s: ${a2.cls} opac ${a2.op} em (${a2.x},${a2.y}) | status: "${a2.sub}"`);
    console.log(`   tocou na caçapa (${pt ? 'toque na tela' : 'chamada direta'}): cantada=${called} | aviso: "${a3.cls}" opac ${a3.op} | status: "${a3.sub}"`);
    await p.close();
  }
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
