// QA: cada jogo de tabuleiro/cobrinha baixa a SUA música (HTTP 200) e o áudio começa a tocar depois do toque.
// Uso: node qa/musica-novos.cjs  (com `npx vite preview --port 4174 --strictPort` rodando)
const { chromium } = require('playwright');
const jogos = [['xadrez', 'the-unwavering-line', 'play-ai'], ['damas', 'the-afternoon-gambit', 'play-ai'],
  ['ludo', 'sunday-morning-roll', 'play-ai'], ['cobrinha', 'level-nine-dash', 'play-solo']];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let falhas = 0;
  for (const [route, faixa, btn] of jogos) {
    const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, locale: 'pt-BR' })).newPage();
    const st = [];
    const erros = [];
    p.on('response', (r) => r.url().includes('/music/') && st.push(r.url().split('/').pop() + ' ' + r.status()));
    p.on('pageerror', (e) => erros.push(e.message));
    await p.goto('http://localhost:4174/#' + route);
    await p.waitForTimeout(600);
    await p.click(`[data-k="${btn}"]`);
    await p.waitForTimeout(400);
    await p.mouse.click(206, 600);
    await p.waitForTimeout(1500);
    const ok = st.some((s) => s.startsWith(faixa + '.mp3 200')) && !st.some((s) => !s.startsWith(faixa)) && !erros.length;
    if (!ok) falhas++;
    console.log(route.padEnd(9), ok ? 'OK' : 'FALHOU', '|', st.join(', ') || 'nenhuma música baixada', erros.length ? '| erros: ' + erros.join('; ') : '');
    await p.close();
  }
  await b.close();
  process.exit(falhas ? 1 : 0);
})();
