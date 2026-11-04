// QA: capturas do fluxo de menus (portal → menu do jogo → loja → pausa), celular deitado e desktop.
// Uso: node qa/fluxo-menus.cjs <pasta-de-saida> [prefixo]
// Imprime quantos toques/rolagens cada tela pede (altura do conteúdo × altura da tela) e erros de console.
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
const pre = process.argv[3] || 'fluxo';
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 762, height: 343, n: 'cel', mobile: true }, { width: 1280, height: 800, n: 'desk' }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'pt-BR', isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && !/music|mp3|Failed to load resource/i.test(m.text()) && errs.push(m.text()));
    const shot = async (name) => {
      const h = await p.evaluate(() => {
        let max = document.documentElement.scrollHeight;
        document.querySelectorAll('.gs-box,.shop-panel,.overlay .box,[class*="overlay"] [class*="box"]').forEach((e) => {
          if (e.offsetParent) max = Math.max(max, e.scrollHeight);
        });
        return max;
      });
      console.log(`${vp.n} ${name}: altura do conteúdo ${h}px / tela ${vp.height}px (${(h / vp.height).toFixed(1)} telas)`);
      await p.screenshot({ path: `${out}/${pre}-${vp.n}-${name}.png` });
    };
    await p.goto('http://localhost:4174/');
    await p.waitForTimeout(500);
    await shot('1-portal');
    for (const g of ['air-hockey', 'pong', 'sinuca']) {
      await p.goto(`http://localhost:4174/#${g}`);
      await p.waitForTimeout(900);
      await shot(`2-menu-${g}`);
      const shop = p.locator('[data-k="shop"]:visible, #btn-menu-cues:visible, [data-k="menu-shop"]:visible').first();
      if (await shop.count()) {
        await shop.click();
        await p.waitForTimeout(300);
        await shot(`3-loja-${g}`);
      } else console.log(`${vp.n} ${g}: sem botão de loja no menu`);
    }
    console.log(`${vp.n} erros:`, errs.length ? errs.slice(0, 5) : 'nenhum');
    await ctx.close();
  }
  await b.close();
})();
