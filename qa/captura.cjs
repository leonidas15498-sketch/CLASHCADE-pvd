// Captura de um elemento: node qa/captura.cjs <arquivo.png> [#rota] [seletor] [largura] [altura]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +(process.argv[5] || 1280), height: +(process.argv[6] || 800) } });
  await p.goto('http://localhost:4174/' + (process.argv[3] || ''));
  await p.waitForTimeout(600);
  const el = await p.$(process.argv[4] || '.grid');
  await el.screenshot({ path: process.argv[2] });
  await b.close();
})();
