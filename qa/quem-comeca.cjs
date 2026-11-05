// QA (pedido do Leon 05/11): quem começa é sorteado. Abre cada jogo 2P várias vezes no mesmo aparelho e lê o aviso
// "X começa"/"X abre". Passa se os dois jogadores aparecem como iniciais. Uso: node qa/quem-comeca.cjs [vezes]
const { chromium } = require('playwright');
const N = Number(process.argv[2] || 12);
const jogos = [
  ['lig-4', '[data-k="play-local"]'], ['damas', '[data-k="play-local"]'], ['ludo', '[data-k="play-local"]'],
  ['xadrez', '[data-k="play-local"]'], ['empilha', '[data-k="play-local"]'], ['sinuca', '#btn-play-local'], ['minigolfe', '#mg-play-duo'],
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' });
  let falhas = 0;
  const erros = [];
  for (const [route, btn] of jogos) {
    const cont = { 'Jogador 1': 0, 'Jogador 2': 0, '?': 0 };
    for (let i = 0; i < N; i++) {
      const p = await ctx.newPage();
      p.on('pageerror', (e) => erros.push(`${route}: ${e.message}`));
      await p.goto('http://localhost:4174/#' + route);
      await p.waitForTimeout(500);
      await p.click(btn);
      await p.waitForTimeout(450);
      const txt = await p.evaluate(() => { const on = document.querySelector('.mg-pl.on'); if (!on) return document.body.innerText; const c = on.cloneNode(true); c.querySelector('em')?.remove(); return `Vez de ${c.textContent.trim()}`; });
      const m = txt.match(/(Jogador [12])[:]? (começa|abre|— Vez|\.)/) || txt.match(/Vez de (Jogador [12])/);
      cont[m ? m[1] : '?']++;
      await p.close();
    }
    const ok = cont['Jogador 1'] > 0 && cont['Jogador 2'] > 0;
    if (!ok) falhas++;
    console.log(route.padEnd(10), ok ? 'OK' : 'FALHOU', `| J1 começou ${cont['Jogador 1']}× · J2 ${cont['Jogador 2']}× · não lido ${cont['?']}`);
  }
  console.log('ERROS:', erros.length ? erros.join(' | ') : 'nenhum');
  await b.close();
  process.exit(falhas || erros.length ? 1 : 0);
})();
