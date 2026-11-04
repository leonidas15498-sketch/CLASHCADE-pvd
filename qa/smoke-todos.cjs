// QA de fumaça: nos 6 jogos com Shell, cada modo (e as 3 dificuldades contra a IA) — joga alguns segundos com toques,
// pausa/continua, reinicia, volta ao menu e sai. Conta erros de página. Sinuca e golfe: ver fx-golfe-hockey/rastros-tacos.
// Uso: node qa/smoke-todos.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR', hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const games = { damas: ['ai', 'local'], ludo: ['ai', 'local'], 'air-hockey': ['ai', 'local'], 'duelo-rastros': ['ai', 'local'], empilha: ['solo', 'ai', 'local'], 'lig-4': ['ai', 'local'], pong: ['ai', 'local'], blocos: ['solo', 'ai', 'local'], xadrez: ['ai', 'local'], cobrinha: ['solo', 'ai', 'local'], 'sumo-neon': ['ai', 'local'], 'cabo-de-guerra': ['ai', 'local'] };
  for (const [route, modes] of Object.entries(games)) {
    const res = [];
    for (const mode of modes) {
      for (const d of mode === 'ai' ? ['easy', 'medium', 'hard'] : [null]) {
        await p.goto('about:blank');
        await p.goto('http://localhost:4174/#' + route);
        await p.waitForTimeout(500);
        const e0 = errs.length;
        if (d) await p.click(`[data-k="diff"] button[data-d="${d}"]`);
        await p.click(`[data-k="play-${mode}"]`);
        const box = await p.$eval('.gs-stage canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        for (let i = 0; i < 14; i++) {
          const x = box.x + box.w * (0.15 + 0.7 * ((i * 37) % 100) / 100);
          const y = box.y + box.h * (0.2 + 0.6 * ((i * 53) % 100) / 100);
          await p.mouse.move(x, y);
          await p.mouse.down();
          await p.mouse.move(x + 30, y - 20, { steps: 3 });
          await p.mouse.up();
          await p.waitForTimeout(120);
        }
        await p.keyboard.press('p');
        await p.waitForTimeout(150);
        const paused = await p.$eval('[data-k="pausebox"]', (e) => e.classList.contains('show'));
        await p.click('[data-k="resume"]').catch(() => {});
        await p.waitForTimeout(300);
        await p.keyboard.press('p');
        await p.click('[data-k="restart"]').catch(() => {});
        await p.click('[data-k="c-yes"]').catch(() => {});
        await p.waitForTimeout(400);
        res.push(`${mode}${d ? '/' + d : ''}: pausa ${paused ? 'ok' : 'NÃO abriu'}${errs.length > e0 ? ' ERRO' : ''}`);
      }
    }
    await p.evaluate(() => (location.hash = ''));
    await p.waitForTimeout(300);
    const leaked = await p.evaluate(() => document.querySelectorAll('.gs-root').length);
    console.log(`${route.padEnd(13)} ${res.join(' · ')} | saiu limpo: ${leaked === 0}`);
  }
  console.log('ERROS:', errs.length ? [...new Set(errs)].join(' | ') : 'nenhum');
  await b.close();
})();
