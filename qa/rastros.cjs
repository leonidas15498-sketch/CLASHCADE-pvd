// QA: Duelo de Rastros — abre pelo catálogo, joga contra a IA, testa o deslize (vira), 2P com as duas metades, erros.
// Uso: node qa/rastros.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: false, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  const music = [];
  p.on('response', (r) => r.url().includes('/music/') && music.push(r.url().split('/').pop() + ' ' + r.status()));
  await p.goto('http://localhost:4174/');
  await W(400);
  const card = await p.$('text=Duelo de Rastros');
  console.log('CATÁLOGO cartão:', !!card);
  await p.goto('http://localhost:4174/#duelo-rastros');
  await p.waitForFunction(() => window.__trails);
  await p.click('[data-k="diff"] button[data-d="easy"]');
  await p.click('[data-k="play-ai"]');
  await W(2700); // contagem
  const d0 = await p.evaluate(() => window.__trails.debug());
  // deslize para cima em qualquer lugar da tela
  const box = await p.$eval('[data-k="stage"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.6);
  await p.mouse.down();
  await p.mouse.move(box.x + box.w * 0.3, box.y + box.h * 0.35, { steps: 4 });
  await p.mouse.up();
  await W(250);
  const d1 = await p.evaluate(() => window.__trails.debug());
  console.log('IA: andou', d1.steps, 'passos | J1 direção antes', d0.bikes[0].dir, 'depois do deslize', d1.bikes[0].dir, '(0 = cima)');
  await p.screenshot({ path: `${out}/rastros-ia.png` });
  // espera a rodada acabar
  await p.waitForFunction(() => window.__trails.debug().result !== null, null, { timeout: 30000 });
  const d2 = await p.evaluate(() => window.__trails.debug());
  console.log('IA: rodada terminou, resultado', d2.result, '| placar', d2.rounds.join('×'));
  await W(400);
  await p.screenshot({ path: `${out}/rastros-batida.png` });
  // 2P: metade direita controla o J2
  await p.goto('http://localhost:4174/#');
  await p.goto('http://localhost:4174/#duelo-rastros');
  await p.waitForFunction(() => window.__trails);
  await p.click('[data-k="play-local"]');
  await W(2600);
  const r = await p.$eval('canvas', (e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
  await p.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.5);
  await p.mouse.down();
  await p.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.8, { steps: 4 });
  await p.mouse.up();
  await W(200);
  await p.keyboard.press('w');
  await W(200);
  const d3 = await p.evaluate(() => window.__trails.debug());
  console.log('2P: J2 (deslize na direita, para baixo) dir', d3.bikes[1].dir, '(2 = baixo) | J1 (tecla W) dir', d3.bikes[0].dir, '(0 = cima)');
  await p.screenshot({ path: `${out}/rastros-2p.png` });
  // sair: destroy não deixa laço/estilo
  await p.evaluate(() => (location.hash = ''));
  await W(400);
  console.log('Saiu do jogo: instância removida', await p.evaluate(() => !window.__trails), '| estilos do shell', await p.evaluate(() => [...document.querySelectorAll('style')].filter((s) => s.textContent.includes('.gs-root')).length));
  console.log('MÚSICA baixada:', music.join(', ') || 'nenhuma');
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
