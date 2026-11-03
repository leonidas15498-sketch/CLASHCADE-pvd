// QA: o painel de volume da música abre POR CIMA da mesa/campo em todos os jogos (bug relatado na sinuca, 01/11).
// Uso: node qa/musica-painel.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  for (const [route, start] of [['sinuca', null], ['minigolfe', null], ['air-hockey', '[data-k="play-ai"]'], ['blocos', '[data-k="play-solo"]'], ['empilha', '[data-k="play-solo"]']]) {
    await p.goto('http://localhost:4174/#' + route);
    await p.waitForTimeout(700);
    if (start) await p.click(start);
    else {
      // sinuca/golfe: primeiro botão de jogar visível
      const btn = await p.$('button:visible:has-text("Jogar"), button:visible:has-text("Contra a IA"), button:visible:has-text("1 Jogador")');
      if (btn) await btn.click();
    }
    await p.waitForTimeout(500);
    const btns = await p.$$('.mc-btn');
    let ok = 'sem botão visível';
    for (const m of btns) {
      if (!(await m.isVisible())) continue;
      await m.click();
      await p.waitForTimeout(150);
      ok = await p.evaluate(() => {
        const v = [...document.querySelectorAll('.mc-vol')].find((x) => x.getClientRects().length);
        if (!v) return 'painel não abriu';
        const r = v.getBoundingClientRect();
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el === v ? 'OK, volume por cima' : 'ATRÁS de: ' + (el?.id || el?.className || el?.tagName);
      });
      break;
    }
    console.log(route.padEnd(11), ok);
  }
  await b.close();
})();
