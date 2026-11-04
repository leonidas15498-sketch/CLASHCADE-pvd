// QA: loja dentro dos jogos do Shell (Air Hockey, Pong, Quatro em Linha) — compra em 2 toques, equipar, saldo,
// tema aparece na partida (cor do pixel do canvas), loja pela pausa, e persistência após recarregar.
// Uso: node qa/loja-shell.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const URL = 'http://localhost:4174/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 762, height: 343 }, locale: 'pt-BR', isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/music|mp3|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.click('[data-testid="daily"]'); // cria a carteira pelo próprio app
  await p.evaluate(() => {
    const k = 'jogaco.wallet.v1';
    const e = JSON.parse(localStorage.getItem(k) || 'null');
    e.data.balance = 300;
    localStorage.setItem(k, JSON.stringify(e));
  });
  const pixel = () => p.evaluate(() => {
    const cv = document.querySelector('.gs-stage canvas');
    const r = cv.getBoundingClientRect();
    const c = cv.getContext('2d');
    // ponto a 1/4 da largura e 1/4 da altura do canvas (superfície da mesa/quadra, longe do disco/bola)
    const d = c.getImageData(Math.round(cv.width * 0.3), Math.round(cv.height * 0.22), 1, 1).data;
    return `rgb(${d[0]},${d[1]},${d[2]}) [${Math.round(r.width)}×${Math.round(r.height)}]`;
  });
  // ---- Air Hockey: comprar Pista de Gelo (fichas) ----
  await p.goto(URL + '#air-hockey');
  await p.waitForSelector('[data-k="menu-shop"]');
  await p.click('[data-k="play-ai"]');
  await p.waitForTimeout(400);
  const before = await pixel();
  await p.click('[data-k="pause"]');
  await p.click('[data-k="pause-shop"]');
  await p.waitForTimeout(200);
  console.log('hockey: loja pela pausa aberta:', await p.isVisible('[data-k="shopbox"]'), '| saldo:', (await p.textContent('[data-k="shop-bal"] b')).trim());
  const buyBtn = p.locator('.gs-item[data-item="hockey.table.gelo"] button');
  console.log('hockey: botão antes:', (await buyBtn.textContent()).trim());
  await buyBtn.click();
  console.log('hockey: 1º toque:', (await buyBtn.textContent()).trim());
  await buyBtn.click();
  await p.waitForTimeout(150);
  console.log('hockey: depois da compra — saldo:', (await p.textContent('[data-k="shop-bal"] b')).trim(),
    '| em uso:', await p.getAttribute('.gs-item.on', 'data-item'));
  await p.screenshot({ path: `${out}/loja-hockey.png` });
  await p.click('[data-k="shop-tabs"] button[data-i="1"]');
  await p.locator('.gs-item[data-item="hockey.puck.neon"] button').click(); // premium liberado para teste
  console.log('hockey: disco premium (teste) em uso:', await p.getAttribute('.gs-item.on', 'data-item'));
  await p.click('[data-k="shop-close"]');
  await p.click('[data-k="resume"]');
  await p.waitForTimeout(300);
  const after = await pixel();
  console.log('hockey: pixel da mesa antes', before, '→ depois', after, before !== after ? 'OK (mudou)' : 'FALHA (igual)');
  await p.screenshot({ path: `${out}/partida-hockey-gelo.png` });
  // ---- Pong: quadra premium (teste) ----
  await p.goto(URL + '#pong');
  await p.waitForSelector('[data-k="menu-shop"]');
  await p.click('[data-k="menu-shop"]');
  await p.locator('.gs-item[data-item="pong.court.synthwave"] button').click();
  await p.locator('.gs-item[data-item="pong.court.synthwave"] button').click();
  await p.waitForTimeout(150);
  console.log('pong: synthwave em uso:', await p.getAttribute('.gs-item.on', 'data-item'), '| saldo:', (await p.textContent('[data-k="shop-bal"] b')).trim());
  await p.screenshot({ path: `${out}/loja-pong.png` });
  await p.click('[data-k="shop-close"]');
  await p.click('[data-k="play-ai"]');
  await p.waitForTimeout(400);
  console.log('pong: pixel da quadra', await pixel());
  await p.screenshot({ path: `${out}/partida-pong.png` });
  // ---- Quatro em Linha: tabuleiro Ouro (premium de teste) ----
  await p.goto(URL + '#lig-4');
  await p.waitForSelector('[data-k="menu-shop"]');
  await p.click('[data-k="menu-shop"]');
  await p.locator('.gs-item[data-item="c4.board.ouro"] button').click();
  console.log('lig-4: em uso:', await p.getAttribute('.gs-item.on', 'data-item'));
  await p.screenshot({ path: `${out}/loja-lig4.png` });
  // ---- persiste após recarregar; portal mostra o mesmo saldo ----
  await p.goto(URL);
  await p.waitForTimeout(300);
  console.log('portal: carteira', (await p.textContent('[data-testid="wallet"]')).trim());
  await p.goto(URL + '#air-hockey');
  await p.waitForSelector('[data-k="menu-shop"]');
  await p.click('[data-k="menu-shop"]');
  console.log('após recarregar, hockey em uso:', await p.getAttribute('.gs-item.on', 'data-item'));
  // jogos sem itens no catálogo não mostram botão de loja
  for (const g of ['blocos', 'sumo-neon', 'cabo-de-guerra', 'empilha', 'duelo-rastros']) {
    await p.goto(URL + '#' + g);
    await p.waitForSelector('[data-k="menu-help"]');
    console.log(`${g}: botão Loja =`, await p.locator('[data-k="menu-shop"]').count());
  }
  console.log('erros:', errs.length ? errs.slice(0, 5) : 'nenhum');
  await b.close();
})();
