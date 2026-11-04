// QA: prancha com os 12 bichos da Torre desenhados pelo próprio jogo + uma partida solo com 6 peças.
// Uso: node qa/torre-bichos.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await p.goto('http://localhost:4174/#empilha');
  await p.waitForFunction(() => window.__stack);
  const url = await p.evaluate(() => window.__stack.sheet());
  fs.writeFileSync(`${out}/torre-bichos.png`, Buffer.from(url.split(',')[1], 'base64'));
  await p.click('[data-k="play-ai"]');
  await p.waitForTimeout(400);
  const box = await p.$eval('canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 60; k++) {
      const d = await p.evaluate(() => window.__stack.debug());
      if (d.phase === 'aim' && d.current === 0) break;
      if (d.phase === 'over') break;
      await p.waitForTimeout(150);
    }
    // segurar e soltar no centro (o jogo solta ao arrastar para baixo? usa o mesmo gesto do qa/empilha: soltar = botão)
    const drop = await p.$('[data-k="drop"], button:has-text("Soltar")');
    if (drop) await drop.click();
    await p.waitForTimeout(1500);
  }
  const d = await p.evaluate(() => window.__stack.debug());
  console.log('partida vs IA: fase', d.phase, '| peças na mesa', d.pieces, '| colocadas', d.placed);
  await p.screenshot({ path: `${out}/torre-partida.png` });
  console.log('erros:', errs.length ? errs : 'nenhum');
  await b.close();
})();
