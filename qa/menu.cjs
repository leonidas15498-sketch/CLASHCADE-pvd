// QA: menu Clashcade — capturas desktop/celular, abas, idioma, bônus diário, loja dentro do golfe e da sinuca (compra em 2 toques), placar de sessão.
// Uso: node qa/menu.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 1366, height: 860, n: 'desktop' }, { width: 390, height: 844, n: 'celular' }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'pt-BR' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto('http://localhost:4174/');
    await p.waitForTimeout(400);
    console.log(`== ${vp.n}: título`, await p.title(), '| cartões de jogo', await p.$$eval('.card', (x) => x.length));
    await p.screenshot({ path: `${out}/menu-${vp.n}.png`, fullPage: false });
    if (vp.n === 'desktop') {
      const w0 = await p.textContent('[data-testid="wallet"]');
      await p.click('[data-testid="daily"]');
      await p.waitForTimeout(100);
      const w1 = await p.textContent('[data-testid="wallet"]');
      console.log('bônus diário: carteira', w0.trim(), '→', w1.trim(), '| botão agora:', (await p.textContent('[data-testid="daily"]')).trim());
      await p.reload();
      await p.waitForTimeout(300);
      console.log('após recarregar: carteira', (await p.textContent('[data-testid="wallet"]')).trim(), '| bônus desativado', await p.$eval('[data-testid="daily"]', (e) => e.disabled));
      // Loja dentro do jogo (03/11): o portal não tem mais aba Loja; cada jogo abre a sua pelo menu.
      console.log('aba Loja no portal (deve ser 0):', await p.locator('[data-tab="shop"]').count());
      await p.evaluate(() => {
        const k = 'jogaco.wallet.v1';
        const e = JSON.parse(localStorage.getItem(k));
        e.data.balance = 250;
        localStorage.setItem(k, JSON.stringify(e));
      });
      await p.goto('http://localhost:4174/#minigolfe');
      await p.waitForSelector('#mg-menu-putters');
      console.log('botão no menu do golfe:', (await p.textContent('#mg-menu-putters')).trim());
      await p.click('#mg-menu-putters');
      await p.waitForTimeout(200);
      console.log('título:', (await p.textContent('#mg-putters h2')).trim(), '| saldo:', (await p.textContent('#mg-shop-bal b')).trim());
      const btn = p.locator('[data-buy="golf.putter.madeira"]');
      await btn.click();
      console.log('1º toque:', (await btn.textContent()).trim());
      await btn.click();
      await p.waitForTimeout(150);
      console.log('2º toque → saldo na loja:', (await p.textContent('#mg-shop-bal b')).trim(), '| botão comprar sumiu:', (await p.locator('[data-buy="golf.putter.madeira"]').count()) === 0);
      await p.screenshot({ path: `${out}/loja-golfe.png` });
      await p.goto('http://localhost:4174/#sinuca');
      await p.waitForSelector('#btn-menu-cues');
      console.log('botão no menu da sinuca:', (await p.textContent('#btn-menu-cues')).trim());
      await p.click('#btn-menu-cues');
      await p.waitForTimeout(200);
      console.log('título:', (await p.textContent('#cues h2')).trim(), '| saldo:', (await p.textContent('#shop-bal b')).trim());
      await p.screenshot({ path: `${out}/loja-sinuca.png` });
      await p.goto('http://localhost:4174/');
      await p.waitForTimeout(300);
      console.log('carteira no portal após compra:', (await p.textContent('[data-testid="wallet"]')).trim());
      await p.click('[data-tab="settings"]');
      await p.click('text=English');
      await p.waitForTimeout(150);
      console.log('idioma EN: aba', (await p.textContent('[data-tab="games"]')).trim(), '| html lang', await p.evaluate(() => document.documentElement.lang));
      await p.click('[data-tab="games"]');
      console.log('idioma EN: 1º jogo', (await p.textContent('.card h3')).trim(), '| idiomas no seletor:', await p.evaluate(() => 0));
      await p.click('[data-tab="settings"]');
      console.log('opções de idioma:', (await p.$$eval('.seg button', (x) => x.map((b) => b.textContent))).join(', '));
      await p.click('text=Português');
      await p.click('[data-tab="games"]');
      await p.evaluate(() => localStorage.setItem('jogaco.session.v1', JSON.stringify({ v: 1, data: { red: 3, blue: 1, ids: [], startedAt: 'x' } })));
      await p.reload();
      await p.waitForTimeout(200);
      console.log('placar:', await p.textContent('[data-testid="vs-red"]'), '×', await p.textContent('[data-testid="vs-blue"]'));
      await p.click('[data-testid="vs-reset"]');
      await p.click('[data-testid="vs-reset-yes"]');
      console.log('nova sessão:', await p.textContent('[data-testid="vs-red"]'), '×', await p.textContent('[data-testid="vs-blue"]'), '| fichas mantidas', (await p.textContent('[data-testid="wallet"]')).trim());
      const small = await p.$$eval('button', (bs) => bs.filter((x) => x.offsetParent && x.getBoundingClientRect().height < 44).map((x) => x.textContent.trim().slice(0, 20)));
      console.log('botões < 44 px de altura:', small.length ? small.join(' | ') : 'nenhum');
    } else {
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      console.log('rolagem horizontal no celular:', sw > 390 ? `SIM (${sw}px)` : 'não');
    }
    console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
    await ctx.close();
  }
  await b.close();
})();
