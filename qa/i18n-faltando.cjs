// QA: idioma inglês — abre o portal e cada jogo em en-US (menu, ajuda, partida) e lista textos visíveis que ainda
// parecem português. Uso: node qa/i18n-faltando.cjs
const { chromium } = require('playwright');
const PT = /[ãõçáéíóúâêô]|\b(de|da|do|para|com|que|não|vez|bola|jogar|jogador|partida|toque|arraste|voltar|sair|placar|fichas|taco|mesa|campo|buraco|tacada|rodada|peça|pilha)\b/i;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'en-US' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const grab = () =>
    p.evaluate((src) => {
      const re = new RegExp(src.slice(1, src.lastIndexOf('/')), 'i');
      const out = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode;
        const el = n.parentElement;
        if (!el || !el.offsetParent) continue;
        const t = n.nodeValue.trim();
        if (t && re.test(t)) out.add(t.slice(0, 90));
      }
      document.querySelectorAll('[title],[aria-label],[placeholder]').forEach((el) => {
        for (const a of ['title', 'aria-label', 'placeholder']) {
          const v = el.getAttribute(a);
          if (v && re.test(v) && el.offsetParent) out.add(`@${a}: ${v.slice(0, 80)}`);
        }
      });
      return [...out];
    }, PT.toString());
  await p.goto('http://localhost:4174/');
  await p.waitForTimeout(400);
  console.log('PORTAL:', (await grab()).join(' | ') || 'tudo em inglês');
  const games = [
    ['sinuca', '#btn-play-ai, [data-mode="ai"], button:has-text("Play vs AI")'],
    ['minigolfe', 'button:has-text("Play 9 holes")'],
    ['air-hockey', '[data-k="play-ai"]'],
    ['duelo-rastros', '[data-k="play-ai"]'],
    ['empilha', '[data-k="play-solo"]'],
    ['lig-4', '[data-k="play-ai"]'],
    ['pong', '[data-k="play-ai"]'],
    ['sumo-neon', '[data-k="play-local"]'],
    ['cabo-de-guerra', '[data-k="play-ai"]'],
    ['blocos', '[data-k="play-solo"]'],
    ['damas', '[data-k="play-ai"]'],
    ['ludo', '[data-k="play-ai"]'],
  ];
  for (const [route, play] of games) {
    await p.goto('http://localhost:4174/#' + route);
    await p.waitForTimeout(800);
    const menu = await grab();
    const help = await p.$('button:visible:has-text("How to play")');
    let helpTxt = [];
    if (help) {
      await help.click();
      await p.waitForTimeout(200);
      helpTxt = await grab();
      await p.keyboard.press('Escape');
      const close = await p.$('button:visible:has-text("Close")');
      if (close) await close.click();
    }
    const pb = await p.$(play);
    if (pb && (await pb.isVisible())) await pb.click();
    await p.waitForTimeout(1200);
    const game = await grab();
    const all = [...new Set([...menu, ...helpTxt, ...game])];
    console.log(`${route.padEnd(13)} ${all.length ? 'EM PT: ' + all.join(' | ') : 'tudo em inglês'}`);
  }
  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
