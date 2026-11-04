// QA: Damas e Ludo jogados pelo toque (celular deitado 762×343), contra a IA Difícil, por alguns lances.
// Uso: node qa/damas-ludo.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 762, height: 343 }, locale: 'pt-BR', isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  // ---------------- Damas ----------------
  await p.goto('http://localhost:4174/#damas');
  await p.waitForFunction(() => window.__checkers);
  await p.screenshot({ path: `${out}/damas-menu.png` });
  await p.click('[data-k="diff"] button[data-d="hard"]');
  await p.click('[data-k="play-ai"]');
  await W(1900);
  const box = await p.$eval('.gs-stage canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; });
  let played = 0;
  for (let k = 0; k < 40 && played < 6; k++) {
    const d = await p.evaluate(() => window.__checkers.debug());
    if (!d || d.winner !== null) break;
    if (d.current !== 0 || d.anim || d.thinking) { await W(250); continue; }
    const m = d.legal[0];
    const at = (i) => ({ x: box.x + d.ox + ((i % 8) + 0.5) * d.cell, y: box.y + d.oy + (Math.floor(i / 8) + 0.5) * d.cell });
    const a = at(m[0]);
    const z = at(m[m.length - 1]);
    await p.mouse.click(a.x, a.y);
    await W(80);
    if (played === 0) await p.screenshot({ path: `${out}/damas-selecao.png` });
    await p.mouse.click(z.x, z.y);
    played++;
    await W(900);
  }
  const dc = await p.evaluate(() => window.__checkers.debug());
  console.log('damas: meus lances pelo toque', played, '| peças', JSON.stringify(dc.pieces), '| vez', dc.current, '| fim', dc.winner);
  await p.screenshot({ path: `${out}/damas-partida.png` });
  // ---------------- Ludo ----------------
  await p.goto('http://localhost:4174/#ludo');
  await p.waitForFunction(() => window.__ludo);
  await p.click('[data-k="play-ai"]');
  await W(1900);
  const lb = await p.$eval('.gs-stage canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; });
  let rolls = 0;
  let moves = 0;
  let aiMoves = 0;
  for (let k = 0; k < 120 && rolls < 14; k++) {
    const d = await p.evaluate(() => window.__ludo.debug());
    if (!d || d.winner !== null) break;
    if (d.busy || d.current !== 0) { if (d.current === 1) aiMoves++; await W(250); continue; }
    if (d.dice === null) {
      // garante uma saída da base na 1ª rolagem para o teste andar (as outras são aleatórias de verdade)
      if (rolls === 0) await p.evaluate(() => { const g = window.__ludo; g.forceRoll(6); });
      else await p.mouse.click(lb.x + d.dieX, lb.y + d.dieY);
      rolls++;
      await W(800);
      continue;
    }
    if (d.movable.length) {
      const t = d.movable[0];
      // forma simples: toca no centro da casa do peão usando debug + regra de célula exposta em window
      const rc = await p.evaluate((tt) => window.__ludo.tokenCell(0, tt), t);
      await p.mouse.click(lb.x + d.ox + (rc[1] + 0.5) * d.u, lb.y + d.oy + (rc[0] + 0.5) * d.u);
      moves++;
      await W(900);
    } else await W(300);
  }
  const ld = await p.evaluate(() => window.__ludo.debug());
  console.log('ludo: rolagens pelo toque', rolls, '| peões movidos', moves, '| vezes da IA vistas', aiMoves, '| posições', JSON.stringify(ld.pos));
  await p.screenshot({ path: `${out}/ludo-partida.png` });
  console.log('erros:', errs.length ? errs.slice(0, 5) : 'nenhum');
  await b.close();
})();
