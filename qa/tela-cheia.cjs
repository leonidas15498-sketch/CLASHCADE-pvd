// QA: tela cheia no celular deitado em TODOS os jogos (pedido do Leon 03/11: "igual à sinuca").
// Celular simulado (toque + pointer: coarse). Confere: entra em tela cheia ao começar a partida, sai ao voltar aos jogos,
// e mede a área do jogo em 762×343 (celular deitado sem a barra do navegador). Capturas em <pasta>.
// Uso: npx vite preview --port 4174 --strictPort  →  node qa/tela-cheia.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const GAMES = [
  ['sinuca', '#btn-play-local', '#cv'], ['minigolfe', '#mg-play-solo', '#mg-cv, canvas'],
  ['air-hockey', '[data-k="play-ai"]'], ['duelo-rastros', '[data-k="play-ai"]'], ['empilha', '[data-k="play-solo"]'],
  ['lig-4', '[data-k="play-ai"]'], ['pong', '[data-k="play-ai"]'], ['blocos', '[data-k="play-solo"]'],
  ['sumo-neon', '[data-k="play-ai"]'], ['cabo-de-guerra', '[data-k="play-ai"]'],
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 762, height: 343 }, locale: 'pt-BR', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  for (const [route, btn, cvSel] of GAMES) {
    await p.goto('about:blank');
    await p.goto('http://localhost:4174/#' + route);
    await p.waitForTimeout(700);
    const el = await p.$(btn);
    if (!el || !(await el.isVisible())) { console.log(`${route.padEnd(15)} botão ${btn} não encontrado/visível`); continue; }
    await el.click();
    await p.waitForTimeout(700);
    const fs = await p.evaluate(() => !!document.fullscreenElement);
    const area = await p.evaluate((sel) => {
      const cs = [...document.querySelectorAll(sel || '.gs-stage canvas, canvas')].filter((c) => c.getBoundingClientRect().width > 50);
      const c = cs.sort((a, b2) => b2.getBoundingClientRect().width * b2.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
      if (!c) return null; const r = c.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`;
    }, cvSel);
    await p.screenshot({ path: `${out}/tela-cheia-${route}.png` });
    await p.evaluate(() => { location.hash = ''; });
    await p.waitForTimeout(500);
    const after = await p.evaluate(() => !!document.fullscreenElement);
    console.log(`${route.padEnd(15)} tela cheia ao começar: ${fs ? 'SIM' : 'não'} | maior canvas: ${area} | saiu da tela cheia ao voltar: ${after ? 'NÃO' : 'sim'}`);
  }
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
