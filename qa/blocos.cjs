// QA: Blocos Cromáticos — catálogo, arrastar e soltar com o mouse, limpar linha (pontos), jogada inválida,
// fim de jogo, recorde, 2P (um depois do outro), música carregada, retrato e paisagem, sair limpa, erros.
// Uso: node qa/blocos.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 915, height: 412, name: 'paisagem' }, { width: 390, height: 800, name: 'retrato' }]) {
    const p = await (await b.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'pt-BR' })).newPage();
    const errs = [];
    const audio = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    p.on('response', (r) => r.url().includes('seven-blue-tiles') && audio.push(r.status()));
    const W = (ms) => p.waitForTimeout(ms);
    const dbg = () => p.evaluate(() => window.__blocks.debug());
    const drag = async (i, row, col) => {
      const g = await p.evaluate(([i, row, col]) => { const q = window.__blocks.geometry(); return { s: q.slot[i], d: q.dropFor(i, row, col) }; }, [i, row, col]);
      await p.mouse.move(g.s.x, g.s.y);
      await p.mouse.down();
      await p.mouse.move((g.s.x + g.d.x) / 2, (g.s.y + g.d.y) / 2, { steps: 4 });
      await p.mouse.move(g.d.x, g.d.y, { steps: 4 });
      await p.mouse.up();
      await W(80);
    };
    console.log(`== ${vp.name} ${vp.width}x${vp.height}`);
    await p.goto('http://localhost:4174/');
    await W(300);
    console.log('catálogo tem o cartão:', !!(await p.$('text=Blocos Cromáticos')));
    await p.goto('http://localhost:4174/#blocos');
    await p.waitForFunction(() => window.__blocks);
    await p.click('[data-k="play-solo"]');
    await W(300);
    const d0 = await dbg();
    console.log('início: bandeja', d0.tray.join(','), '| pontos', d0.score);
    // linha 7 com 5 cheios + i3 horizontal no fim = limpa
    await p.evaluate(() => window.__blocks.qaSetup(['........', '........', '........', '........', '........', '........', '........', '#####...'], ['i30', 'o2', 'p1']));
    await drag(0, 7, 5);
    const d1 = await dbg();
    console.log('limpar linha: pontos', d1.score, '(esperado 13) | linhas', d1.lines, '| casas cheias', d1.filled, '| combo', d1.streak);
    await W(200);
    await p.screenshot({ path: `${out}/blocos-${vp.name}-limpou.png` });
    // jogada inválida: o2 em cima de peça
    await p.evaluate(() => window.__blocks.qaSetup(['##......'], ['o2', 'p1', 'p1']));
    await drag(0, 0, 0);
    const d2 = await dbg();
    console.log('inválida: peça continua na bandeja', d2.tray[0] === 'o2', '| pontos', d2.score);
    // soltar fora da grade volta à bandeja
    // jogo encerra: xadrez + p1, restam i2/o2
    const board = Array.from({ length: 8 }, (_, r) => (r % 2 ? '.#.#.#.#' : '#.#.#.#.'));
    await p.evaluate((bd) => window.__blocks.qaSetup(bd, ['p1', 'i20', 'o2']), board);
    await drag(0, 0, 1);
    const d3 = await dbg();
    console.log('fim: over', d3.over);
    await W(1700);
    console.log('resultado:', await p.$eval('[data-k="r-title"]', (e) => e.textContent), '|', await p.$eval('[data-k="r-msg"]', (e) => e.textContent));
    console.log('recorde salvo:', (await dbg()).best);
    if (vp.name === 'retrato') await p.screenshot({ path: `${out}/blocos-retrato-fim.png` });
    // 2P
    await p.click('[data-k="r-new"]');
    await p.click('[data-k="play-local"]');
    await W(200);
    await p.evaluate((bd) => window.__blocks.qaSetup(bd, ['p1', 'i20', 'o2']), board);
    await drag(0, 0, 1);
    await W(1700);
    console.log('2P após J1:', await p.$eval('[data-k="r-title"]', (e) => e.textContent), '| botão:', await p.$eval('[data-k="r-again"]', (e) => e.textContent));
    await p.click('[data-k="r-again"]');
    await W(200);
    console.log('2P vez:', (await dbg()).turn, '(1 = J2)');
    await drag(0, 0, 0); // primeira jogada qualquer na grade vazia
    await p.evaluate((bd) => window.__blocks.qaSetup(bd, ['p1', 'i20', 'o2']), board);
    await drag(0, 0, 1);
    await W(1700);
    console.log('2P final:', await p.$eval('[data-k="r-title"]', (e) => e.textContent), '|', await p.$eval('[data-k="r-msg"]', (e) => e.textContent));
    // painel de música por cima do jogo
    await p.click('[data-k="r-new"]');
    await p.click('[data-k="play-solo"]');
    await W(200);
    await p.click('.mc-btn');
    await W(150);
    const top = await p.evaluate(() => { const v = document.querySelector('.mc-vol'); const r = v.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return el === v; });
    console.log('controle de volume clicável (não fica atrás do jogo):', top, '| música baixada:', audio.join(',') || 'não');
    await p.evaluate(() => (location.hash = ''));
    await W(400);
    console.log('saiu: instância removida', await p.evaluate(() => !window.__blocks));
    console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
    await p.close();
  }
  await b.close();
})();
