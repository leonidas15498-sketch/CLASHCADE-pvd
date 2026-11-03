// QA: Empilha — solo (arrastar e soltar, cair da mesa = fim), contra a IA Difícil (tempo da jogada e travadas de tela), erros.
// Uso: node qa/empilha.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  const dbg = () => p.evaluate(() => window.__stack.debug());
  await p.goto('http://localhost:4174/');
  await W(300);
  console.log('CATÁLOGO cartão Torre de Bichinhos:', !!(await p.$('text=Torre de Bichinhos')));
  await p.goto('http://localhost:4174/#empilha');
  await p.waitForFunction(() => window.__stack);
  await p.click('[data-k="play-solo"]');
  await W(300);
  const box = await p.$eval('canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  // arrasta um pouco para a direita e solta
  await p.mouse.move(box.x + box.w * 0.5, box.y + box.h * 0.5);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * 0.55, box.y + box.h * 0.5, { steps: 5 });
  const mid = await dbg();
  await p.mouse.up();
  await W(100);
  console.log('SOLO arrastar: aimX', mid.aimX.toFixed(2), '| depois de tirar o dedo a fase continua', (await dbg()).phase, '(esperado aim)');
  // toque rápido: gira 45° e não move nem solta (pedido de 01/11)
  const before = await dbg();
  await p.mouse.click(box.x + box.w * 0.4, box.y + box.h * 0.4);
  await W(80);
  const tap = await dbg();
  console.log('SOLO toque: giro', (((tap.aimA - before.aimA) * 180) / Math.PI).toFixed(0) + '° (esperado 45) | aimX igual', tap.aimX.toFixed(2) === before.aimX.toFixed(2), '| fase', tap.phase, '(esperado aim) | botão ⟳ visível', await p.evaluate(() => [...document.querySelectorAll('button[aria-label="Girar peça"]')].some((b) => b.offsetParent)));
  console.log('SOLO ponto de contato (só depuração; NÃO é desenhado na tela): y', tap.landing === null ? 'nenhuma' : tap.landing.toFixed(2), '(topo da mesa = 0)');
  await p.screenshot({ path: `${out}/empilha-previa.png` });
  await p.click('[data-k="drop"]');
  await W(100);
  console.log('SOLO botão SOLTAR: fase', (await dbg()).phase, '(esperado settle) | botão desativado durante a queda', await p.$eval('[data-k="drop"]', (e) => e.disabled));
  await p.waitForFunction(() => window.__stack.debug().phase === 'aim', null, { timeout: 10000 });
  console.log('SOLO 1ª peça assentou: peças', (await dbg()).placed);
  await p.screenshot({ path: `${out}/empilha-solo.png` });
  // gira e joga para fora da mesa pelo teclado
  await p.keyboard.press('ArrowUp');
  for (let i = 0; i < 30; i++) await p.keyboard.press('ArrowRight');
  await p.keyboard.press(' ');
  await p.waitForFunction(() => window.__stack.debug().phase === 'over', null, { timeout: 10000 });
  await W(1700);
  console.log('SOLO fora da mesa: fase', (await dbg()).phase, '| resultado:', await p.$eval('[data-k="r-title"]', (e) => e.textContent));
  await p.screenshot({ path: `${out}/empilha-caiu.png` });
  // contra a IA difícil
  await p.click('[data-k="r-new"]');
  await p.click('[data-k="diff"] button[data-d="hard"]');
  await p.click('[data-k="play-ai"]');
  await W(200);
  await p.keyboard.press(' ');
  await p.waitForFunction(() => window.__stack.debug().current === 1 && window.__stack.debug().phase === 'aim', null, { timeout: 10000 });
  await p.evaluate(() => {
    window.__gaps = [];
    let l = performance.now();
    const f = (t) => { window.__gaps.push(t - l); l = t; if (window.__gaps.length < 600) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const t0 = Date.now();
  await p.waitForFunction(() => window.__stack.debug().phase === 'settle', null, { timeout: 20000 });
  const took = Date.now() - t0;
  await W(300);
  await p.screenshot({ path: `${out}/empilha-ia.png` });
  const gaps = await p.evaluate(() => window.__gaps);
  console.log('IA Difícil: decidiu e soltou em', took, 'ms | maior intervalo entre quadros', Math.max(...gaps).toFixed(0), 'ms');
  await p.waitForFunction(() => window.__stack.debug().phase !== 'settle', null, { timeout: 15000 });
  const d = await dbg();
  console.log('IA: depois da jogada fase', d.phase, '| vez de', d.current, '| peças', d.placed);
  await p.evaluate(() => (location.hash = ''));
  await W(400);
  console.log('Saiu: instância removida', await p.evaluate(() => !window.__stack));
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
