// QA: Lig-4 — clique numa coluna derruba a peça, IA responde, 2P até alguém vencer, linha vencedora, erros.
// Uso: node qa/lig4.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  const dbg = () => p.evaluate(() => window.__connect4.debug());
  await p.goto('http://localhost:4174/');
  await W(300);
  console.log('CATÁLOGO cartão Quatro em Linha:', !!(await p.$('text=Quatro em Linha')));
  await p.goto('http://localhost:4174/#lig-4');
  await p.waitForFunction(() => window.__connect4);
  await p.click('[data-k="diff"] button[data-d="hard"]');
  await p.click('[data-k="play-ai"]');
  await W(300);
  const r = await p.$eval('canvas', (e) => { const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; });
  const colX = (c) => r.x + r.w * ((0.2 + c + 0.5) / 7.4);
  const d0 = await dbg();
  console.log('IA: quem começa', d0.current === 0 ? 'você' : 'IA');
  await p.mouse.click(colX(3), r.y + r.h * 0.5);
  const t0 = Date.now();
  await p.waitForFunction(() => window.__connect4.debug().moves.length >= 2, null, { timeout: 8000 });
  await W(500);
  const d1 = await dbg();
  console.log('IA: jogadas', JSON.stringify(d1.moves), '| resposta da IA em', Date.now() - t0, 'ms (inclui queda e pausa)');
  await p.screenshot({ path: `${out}/lig4-ia.png` });
  // 2P: J1 faz 4 na vertical na coluna 0
  await p.click('[data-k="home"]');
  await p.click('[data-k="c-yes"]');
  await p.click('[data-k="play-local"]');
  await W(300);
  const first = (await dbg()).current;
  const seq = first === 0 ? [0, 6, 0, 6, 0, 6, 0] : [6, 0, 5, 0, 5, 0, 4, 0];
  for (const c of seq) {
    await p.mouse.click(colX(c), r.y + r.h * 0.5);
    await p.waitForFunction(() => !window.__connect4.debug().falling, null, { timeout: 3000 });
    await W(60);
  }
  await W(400);
  const d2 = await dbg();
  console.log('2P: vencedor', d2.winner, '(0 = J1) | placar', d2.wins.join('×'));
  await p.screenshot({ path: `${out}/lig4-vitoria.png` });
  await W(1500);
  console.log('2P: tela de resultado', await p.$eval('[data-k="r-title"]', (e) => e.textContent));
  await p.click('[data-k="r-again"]');
  await W(200);
  console.log('Revanche: quem começa agora', (await dbg()).current, '(antes', first + ')');
  // placar de sessão e fichas: a vitória 2P deve contar UMA vez (revanche em andamento não conta)
  await p.evaluate(() => (location.hash = ''));
  await W(500);
  const vs = [await p.textContent('[data-testid="vs-red"]'), await p.textContent('[data-testid="vs-blue"]')];
  console.log('MENU placar da sessão (vermelho × azul):', vs.join(' × '), '(esperado: 1 para quem venceu o 2P) | fichas', (await p.textContent('[data-testid="wallet"]')).trim());
  await p.goto('http://localhost:4174/#lig-4');
  await p.waitForFunction(() => window.__connect4);
  await W(400);
  console.log('Saiu: instância removida', await p.evaluate(() => !window.__connect4));
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
