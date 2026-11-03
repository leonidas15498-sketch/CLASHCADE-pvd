// QA: botão "Surpreenda-me" (abre um jogo), "Outro jogo" no resultado (troca de jogo) e modo offline (service worker).
// Uso: node qa/offline-e-sorteio.cjs   (localhost é contexto seguro; o registro aqui é manual, no site é automático em https)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, locale: 'pt-BR' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4174/');
  await p.waitForTimeout(500);
  await p.click('[data-testid="random-game"]');
  await p.waitForTimeout(800);
  console.log('SURPREENDA-ME abriu:', await p.evaluate(() => location.hash));
  // Outro jogo: abre o Lig-4, mostra o resultado e troca
  await p.goto('http://localhost:4174/#lig-4');
  await p.waitForTimeout(800);
  await p.click('[data-k="play-local"]');
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-k="result"]').classList.add('show'));
  const btn = await p.$('[data-k="r-next"]');
  await p.evaluate(() => document.querySelector('[data-k="r-next"]').click());
  await p.waitForTimeout(1000);
  console.log('OUTRO JOGO: botão existe', !!btn, '| foi para', await p.evaluate(() => location.hash), '(diferente de #lig-4)');
  // offline
  await p.goto('http://localhost:4174/');
  await p.evaluate(async () => { await navigator.serviceWorker.register('./sw.js'); await navigator.serviceWorker.ready; });
  await p.reload();
  await p.waitForTimeout(800);
  await p.goto('http://localhost:4174/#pong');
  await p.waitForTimeout(1500);
  await ctx.setOffline(true);
  await p.goto('http://localhost:4174/#pong');
  await p.waitForTimeout(1500);
  const ok = await p.evaluate(() => !!window.__pong || !!document.querySelector('[data-k="play-ai"]'));
  await p.click('[data-k="play-ai"]').catch(() => {});
  await p.waitForTimeout(800);
  console.log('OFFLINE: Pong abriu sem internet', ok, '| partida rodando', await p.evaluate(() => !!(window.__pong && window.__pong.debug())));
  console.log('ERROS:', errs.length ? errs : 'nenhum');
  await b.close();
})();
