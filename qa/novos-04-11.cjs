// QA da rodada 04/11 (manhã): Cobrinha, Xadrez, opção das Damas, filtro Tabuleiro, Minigolfe e Blocos contra a IA.
// Celular deitado 762×343, jogadas pelo toque quando possível. Uso: node qa/novos-04-11.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 762, height: 343 }, locale: 'pt-BR', isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::/.test(m.text()) && errs.push(m.text()));
  const W = (ms) => p.waitForTimeout(ms);
  const URL = 'http://localhost:4174/';

  // ---------- portal: filtro Tabuleiro ----------
  await p.goto(URL);
  await p.waitForSelector('.game-filters');
  const total = await p.$$eval('.grid .card', (x) => x.length);
  await p.click('.game-filters button:has-text("Tabuleiro")');
  await W(200);
  const board = await p.$$eval('.grid .card h3', (x) => x.map((e) => e.textContent));
  await p.click('.game-filters button:has-text("Contra IA")');
  await W(200);
  const ai = await p.$$eval('.grid .card', (x) => x.length);
  console.log('portal: jogos', total, '| Tabuleiro:', board.join(', '), '| Contra IA:', ai);
  await p.click('.game-filters button:has-text("Tabuleiro")');
  await p.screenshot({ path: `${out}/portal-tabuleiro.png` });

  // ---------- Damas: opção "Pedra captura para trás?" ----------
  await p.goto(URL + '#damas');
  await p.waitForFunction(() => window.__checkers);
  await p.click('[data-var="back"] button[data-v="nao"]');
  const note = await p.textContent('[data-varnote="back"]');
  await p.screenshot({ path: `${out}/damas-opcao.png` });
  await p.click('[data-k="play-ai"]');
  await W(600);
  const sub = await p.textContent('[data-k="sub"]');
  console.log('damas: nota =', note.slice(0, 60), '| subtítulo =', sub);
  await p.reload();
  await p.waitForFunction(() => window.__checkers);
  const kept = await p.$eval('[data-var="back"] button.on', (e) => e.dataset.v);
  await p.click('[data-var="back"] button[data-v="sim"]');
  console.log('damas: opção salva após recarregar =', kept);

  // ---------- Xadrez contra IA Média, pelo toque ----------
  await p.goto(URL + '#xadrez');
  await p.waitForFunction(() => window.__chess);
  await p.screenshot({ path: `${out}/xadrez-menu.png` });
  await p.click('[data-k="diff"] button[data-d="medium"]');
  await p.click('[data-k="play-ai"]');
  await W(1700);
  const cb = await p.$eval('.gs-stage canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; });
  let mine = 0;
  let maxThink = 0;
  for (let k = 0; k < 80 && mine < 6; k++) {
    const d = await p.evaluate(() => window.__chess.debug());
    if (!d || d.winner !== null) break;
    if (d.current !== 0 || d.anim || d.thinking) { await W(200); continue; }
    // abertura e2-e4, depois o 1º lance legal que não seja do rei
    let mv = d.moves.find((m) => m[0] === 52 && m[1] === 36) || d.moves[Math.floor(d.moves.length / 2)];
    const at = (i) => ({ x: cb.x + d.ox + ((i % 8) + 0.5) * d.cell, y: cb.y + d.oy + (Math.floor(i / 8) + 0.5) * d.cell });
    await p.mouse.click(at(mv[0]).x, at(mv[0]).y);
    await W(80);
    if (mine === 0) await p.screenshot({ path: `${out}/xadrez-selecao.png` });
    await p.mouse.click(at(mv[1]).x, at(mv[1]).y);
    const promo = await p.evaluate(() => window.__chess.debug().promo);
    if (promo) await p.mouse.click(at(mv[1]).x, at(mv[1]).y);
    mine++;
    const t0 = Date.now();
    await p.waitForFunction(() => { const x = window.__chess.debug(); return x.winner !== null || (x.current === 0 && !x.anim && !x.thinking); }, null, { timeout: 15000 });
    maxThink = Math.max(maxThink, Date.now() - t0);
  }
  const cd = await p.evaluate(() => window.__chess.debug());
  console.log('xadrez: meus lances pelo toque', mine, '| meios-lances', cd.plies, '| fim', cd.winner, '| maior espera pela IA (ms)', maxThink);
  await p.screenshot({ path: `${out}/xadrez-partida.png` });
  // Difícil: tempo de um lance da IA no navegador
  await p.evaluate(() => window.__chess.shell.toMenu());
  await p.click('[data-k="diff"] button[data-d="hard"]');
  await p.click('[data-k="play-ai"]');
  await W(1500);
  const d0 = await p.evaluate(() => window.__chess.debug());
  const at0 = (i) => ({ x: cb.x + d0.ox + ((i % 8) + 0.5) * d0.cell, y: cb.y + d0.oy + (Math.floor(i / 8) + 0.5) * d0.cell });
  await p.mouse.click(at0(51).x, at0(51).y);
  await p.mouse.click(at0(35).x, at0(35).y);
  const t1 = Date.now();
  await p.waitForFunction(() => { const x = window.__chess.debug(); return x.current === 0 && !x.anim && !x.thinking; }, null, { timeout: 15000 });
  console.log('xadrez Difícil: resposta da IA ao 1.d4 em', Date.now() - t1, 'ms (inclui animação)');

  // ---------- Cobrinha ----------
  await p.goto(URL + '#cobrinha');
  await p.waitForFunction(() => window.__snake);
  await p.screenshot({ path: `${out}/cobrinha-menu.png` });
  await p.click('[data-k="play-solo"]');
  await W(2700);
  const st = await p.$eval('.gs-stage', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  // desliza para cima (vira) e depois para a direita
  await p.mouse.move(st.x, st.y); await p.mouse.down(); await p.mouse.move(st.x, st.y - 60, { steps: 6 }); await p.mouse.up();
  await W(250);
  const s1 = await p.evaluate(() => window.__snake.debug());
  await p.mouse.move(st.x, st.y); await p.mouse.down(); await p.mouse.move(st.x + 60, st.y, { steps: 6 }); await p.mouse.up();
  await W(500);
  const s2 = await p.evaluate(() => window.__snake.debug());
  console.log('cobrinha solo: dir depois do deslize p/ cima', s1.snakes[0].dir, '(0 = cima) | depois p/ direita', s2.snakes[0].dir, '(1) | passos', s2.steps);
  await p.screenshot({ path: `${out}/cobrinha-solo.png` });
  await p.evaluate(() => window.__snake.shell.toMenu());
  await p.click('[data-k="diff"] button[data-d="hard"]');
  await p.click('[data-k="play-ai"]');
  // o jogador não mexe: bate logo; a IA tem que sobreviver e ganhar as rodadas
  await p.waitForFunction(() => { const d = window.__snake.debug(); return d.rounds[0] + d.rounds[1] >= 1; }, null, { timeout: 30000 });
  await W(600);
  const s3 = await p.evaluate(() => window.__snake.debug());
  await p.screenshot({ path: `${out}/cobrinha-ia.png` });
  console.log('cobrinha × IA Difícil (eu parado): rodadas', s3.rounds.join('×'), '| IA tamanho', s3.snakes[1].len, 'viva', s3.snakes[1].alive);
  await p.evaluate(() => window.__snake.shell.toMenu());
  await p.click('[data-k="play-local"]');
  await W(2700);
  const box = await p.$eval('.gs-stage', (e) => { const r = e.getBoundingClientRect(); return r; });
  // J2 desliza na metade direita para baixo
  const rx = box.x + box.width * 0.8;
  const ry = box.y + box.height * 0.4;
  await p.mouse.move(rx, ry); await p.mouse.down(); await p.mouse.move(rx, ry + 60, { steps: 6 }); await p.mouse.up();
  await W(250);
  const s4 = await p.evaluate(() => window.__snake.debug());
  console.log('cobrinha 2P: J2 virou para', s4.snakes[1].dir, '(2 = baixo) | J1 segue', s4.snakes[0].dir);

  // ---------- Minigolfe contra IA ----------
  await p.goto(URL + '#minigolfe');
  await p.waitForFunction(() => window.__minigolf);
  await p.screenshot({ path: `${out}/golfe-menu.png` });
  await p.click('#mg-diff button[data-d="hard"]');
  await p.click('#mg-play-ai');
  await W(800);
  // eu taco (direto pela função do jogo, como no QA antigo) e a IA joga sozinha a vez dela
  const g1 = await p.evaluate(() => { const a = window.__minigolf; a.power = 0.3; return { canAim: a.canAim(), shot: a.shoot(), names: a.match.players.map((x) => x.name) }; });
  await p.waitForFunction(() => { const a = window.__minigolf; return a.match.current === 1 || a.match.ph[0].done; }, null, { timeout: 20000 });
  const g2 = await p.evaluate(() => ({ cur: window.__minigolf.match.current, canAim: window.__minigolf.canAim() }));
  await p.waitForFunction(() => window.__minigolf.match.ph[1].strokes >= 1 || window.__minigolf.match.ph[1].done, null, { timeout: 20000 });
  await W(300);
  const g3 = await p.evaluate(() => { const m = window.__minigolf.match; return { ia: m.ph[1].strokes, iaDone: m.ph[1].done, cur: m.current }; });
  await p.screenshot({ path: `${out}/golfe-ia.png` });
  console.log('golfe × IA:', JSON.stringify(g1), '| na vez da IA o humano pode mirar?', g2.canAim, '| IA tacou:', JSON.stringify(g3));

  // ---------- Blocos contra IA ----------
  await p.goto(URL + '#blocos');
  await p.waitForFunction(() => window.__blocks);
  await p.click('[data-k="diff"] button[data-d="medium"]');
  await p.click('[data-k="play-ai"]');
  await W(500);
  // joga até acabar colocando a primeira peça no primeiro lugar livre (jogador ruim de propósito)
  await p.evaluate(() => {
    const g = window.__blocks;
    for (let k = 0; k < 400 && !g.s.over; k++) {
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) for (let r = 0; r < 8 && !ok; r++) for (let c = 0; c < 8 && !ok; c++) ok = g.tryPlace(i, r, c);
      if (!ok) break;
    }
  });
  await p.waitForSelector('[data-k="result"].show', { timeout: 8000 });
  const res = await p.evaluate(() => ({ t: document.querySelector('[data-k="r-title"]').textContent, m: document.querySelector('[data-k="r-msg"]').textContent }));
  await p.screenshot({ path: `${out}/blocos-ia.png` });
  console.log('blocos × IA Médio:', res.t, '|', res.m);

  console.log('ERROS:', errs.length ? errs.join(' | ') : 'nenhum');
  await b.close();
})();
