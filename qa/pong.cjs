// QA: Pong — raquete segue o dedo/mouse, IA joga, pontos contam, 2P cada um na sua metade, erros.
// Uso: node qa/pong.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  const dbg = () => p.evaluate(() => window.__pong.debug());
  await p.goto('http://localhost:4174/');
  await W(300);
  console.log('CATÁLOGO cartão Pong:', !!(await p.$('text=Pong')));
  await p.goto('http://localhost:4174/#pong');
  await p.waitForFunction(() => window.__pong);
  await p.click('[data-k="diff"] button[data-d="easy"]');
  await p.click('[data-k="play-ai"]');
  await W(300);
  const r = await p.$eval('canvas', (e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
  await p.mouse.move(r.x + r.w * 0.2, r.y + r.h * 0.2);
  await W(500);
  console.log('IA: raquete J1 seguiu o mouse para cima, y =', (await dbg()).paddles[0].toFixed(2), '(alvo ~0,2)');
  await p.screenshot({ path: `${out}/pong-ia.png` });
  await p.waitForFunction(() => { const d = window.__pong.debug(); return d.score[0] + d.score[1] >= 2; }, null, { timeout: 30000 });
  console.log('IA: placar depois de alguns pontos', (await dbg()).score.join('×'));
  // 2P
  await p.click('[data-k="home"]');
  await p.click('[data-k="c-yes"]');
  await p.click('[data-k="play-local"]');
  await W(200);
  await p.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.85);
  await p.mouse.down();
  await p.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.8, { steps: 2 });
  await W(500);
  await p.mouse.up();
  await p.keyboard.down('w');
  await W(300);
  await p.keyboard.up('w');
  const d = await dbg();
  console.log('2P: J2 (metade direita, embaixo) y =', d.paddles[1].toFixed(2), '| J1 (tecla W) y =', d.paddles[0].toFixed(2), '(menor que 0,5 = subiu)');
  await p.screenshot({ path: `${out}/pong-2p.png` });
  await p.evaluate(() => (location.hash = ''));
  await W(400);
  console.log('Saiu: instância removida', await p.evaluate(() => !window.__pong));
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
