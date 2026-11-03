// QA: Modo Torneio — botão no menu, nomes, abre o 1º jogo sorteado direto no 2P, resultado conta, "Próximo jogo"
// leva ao 2º, placar no portal, encerrar. Resultados forçados via estado do jogo (não joga de verdade 4 partidas).
// Uso: node qa/torneio.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:4174/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.click('[data-testid="tour-open"]');
  await p.fill('[data-testid="tour-red"]', 'Ana');
  await p.fill('[data-testid="tour-blue"]', 'Beto');
  await p.screenshot({ path: `${out}/torneio-form.png` });
  await p.click('[data-testid="tour-start"]');
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('clashcade.tournament.v1')));
  const t = st.data ?? st;
  const first = t.order[0];
  const route = await p.evaluate(() => location.hash.slice(1));
  const menuOpen = await p.$eval('[data-k="menu"]', (e) => e.classList.contains('show'));
  const pills = await p.$eval('[data-k="score"]', (e) => e.textContent);
  console.log(`ordem sorteada: ${t.order.join(', ')} | abriu ${route} (esperado ${first}) | menu do jogo pulado: ${!menuOpen} | placar do jogo: ${pills}`);
  // encerra o jogo atual a favor do Vermelho pelo próprio jogo (relata igual a uma partida real)
  const finish = async (winner) => {
    await p.evaluate((w) => {
      const g = window.__pong || window.__hockey || window.__airhockey || window.__trails || window.__stack || window.__c4 || window.__connect4 || window.__sumo || window.__tug;
      const sh = g && (g.shell || g['shell']);
      sh.report(g.cfg, w);
      sh.showResult('fim', 'teste', () => {});
    }, winner);
    await p.waitForTimeout(150);
  };
  await finish(0);
  const msg = await p.$eval('[data-k="r-msg"]', (e) => e.textContent);
  const btn = await p.$eval('[data-k="r-again"]', (e) => e.textContent);
  console.log(`resultado: "${msg.replace(/\n/g, ' / ')}" | botão: "${btn}" | "Outro jogo" escondido: ${await p.$eval('[data-k="r-next"]', (e) => e.style.display === 'none')}`);
  await p.screenshot({ path: `${out}/torneio-resultado.png` });
  await p.click('[data-k="r-again"]');
  await p.waitForTimeout(1200);
  console.log(`próximo jogo: ${await p.evaluate(() => location.hash.slice(1))} (esperado ${t.order[1]})`);
  await finish(1);
  await finish(1); // repetido: não pode contar duas vezes
  await p.click('[data-k="r-menu"]');
  await p.waitForTimeout(800);
  const red = await p.$eval('[data-testid="tour-red-wins"]', (e) => e.textContent);
  const blue = await p.$eval('[data-testid="tour-blue-wins"]', (e) => e.textContent);
  const next = await p.$eval('[data-testid="tour-next"]', (e) => e.textContent);
  console.log(`portal: Ana ${red} × ${blue} Beto (esperado 1 × 1) | botão "${next}"`);
  await (await p.$('[data-testid="tour-panel"]')).screenshot({ path: `${out}/torneio-portal.png` });
  await p.click('[data-testid="tour-end"]');
  await p.click('[data-testid="tour-end-yes"]');
  console.log('encerrado: botão Torneio de volta:', !!(await p.$('[data-testid="tour-open"]')));
  console.log('ERROS:', errs.length ? [...new Set(errs)].join(' | ') : 'nenhum');
  await b.close();
})();
