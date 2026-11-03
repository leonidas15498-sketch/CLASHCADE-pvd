// Capturas dos 8 jogos em partida (auditoria visual). Uso: node qa/capturas-todos.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const list = [['sinuca', 'button:visible:has-text("Jogar contra a IA")'], ['minigolfe', 'button:visible:has-text("Jogar 9 buracos")'], ['air-hockey', '[data-k="play-ai"]'], ['duelo-rastros', '[data-k="play-ai"]'], ['empilha', '[data-k="play-ai"]'], ['lig-4', '[data-k="play-ai"]'], ['pong', '[data-k="play-ai"]'], ['blocos', '[data-k="play-solo"]']];
  for (const [r, sel] of list) {
    await p.goto('about:blank'); await p.goto('http://localhost:4174/#' + r); await p.waitForTimeout(900);
    const el = await p.$(sel); if (el) await el.click();
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `/tmp/claude-0/qa2/vis-${r}.png` });
  }
  await b.close();
})();
