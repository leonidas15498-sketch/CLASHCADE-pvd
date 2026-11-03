// QA: Sinuca online ponta a ponta com DOIS navegadores e o SQL real (as duas migrações) rodando em PGlite no Node.
// Não testa o Supabase hospedado (Auth/Realtime/rede): o "Realtime" aqui é um repasse local do estado da sala.
// Uso: npx vite preview --port 4174 --strictPort  (em outro terminal)  →  node qa/sinuca-online.cjs <pasta-de-saida>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const out = process.argv[2] || '.';
const URL = 'http://localhost:4174/#sinuca';
const UIDS = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

const fake = (uid) => `
window.__uid = '${uid}';
window.__clashcadeTestRooms = (game) => {
  let disposed = false, hb = 0;
  const cmd = async (action, args = {}) => {
    const r = await window.__rpc(window.__uid, { p_action: action, p_game: game, ...args });
    if (r.error) throw new Error(r.error);
    return r.room;
  };
  return {
    game,
    identity: async () => ({ id: window.__uid }),
    create: (name) => cmd('create', { p_name: name }),
    join: (code, name) => cmd('join', { p_code: code.trim().toUpperCase(), p_name: name }),
    resume: (id) => cmd('resume', { p_room_id: id }),
    async watch(room, events) {
      window.__push = (r) => { if (!disposed && r.id === room.id) events.state(r); };
      events.connection('connected');
      events.state(await cmd('ready', { p_room_id: room.id }));
      hb = setInterval(() => cmd('heartbeat', { p_room_id: room.id }).then(events.state).catch(() => {}), 10000);
    },
    move: (room, column) => cmd('move', { p_room_id: room.id, p_column: column, p_version: room.version, p_round: room.round }),
    submit: (room, payload) => cmd('move', { p_room_id: room.id, p_version: room.version, p_round: room.round, p_payload: payload }),
    rematch: (room) => cmd('rematch', { p_room_id: room.id, p_round: room.round }),
    leave: async (room) => { await cmd('leave', { p_room_id: room.id }); },
    dispose() { disposed = true; clearInterval(hb); },
  };
};`;

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; insert into auth.users values ('${UIDS[0]}'),('${UIDS[1]}');`);
  const mig = path.join(__dirname, '..', 'supabase', 'migrations');
  for (const f of fs.readdirSync(mig).sort()) await db.exec(fs.readFileSync(path.join(mig, f), 'utf8'));

  const b = await chromium.launch();
  const pages = [];
  const errs = [];
  let queue = Promise.resolve();
  const KEYS = ['p_action', 'p_command_id', 'p_room_id', 'p_code', 'p_name', 'p_column', 'p_version', 'p_round', 'p_game', 'p_payload'];
  const rpc = (uid, args) => (queue = queue.then(async () => {
    try {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
      await db.exec('set role authenticated');
      const vals = KEYS.map((k) => (k === 'p_command_id' ? crypto.randomUUID() : k === 'p_payload' && args[k] != null ? JSON.stringify(args[k]) : args[k] ?? null));
      const r = await db.query('select public.clashcade_command($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as room', vals);
      const room = r.rows[0].room;
      await db.exec('reset role');
      if (!['heartbeat', 'ready'].includes(args.p_action) || room.status === 'playing') for (const p of pages) p.evaluate((x) => window.__push && window.__push(x), room).catch(() => {});
      return { room };
    } catch (e) { await db.exec('reset role'); return { error: String(e.message || e) }; }
  }));

  for (const [i, uid] of UIDS.entries()) {
    const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, locale: 'pt-BR' });
    await ctx.exposeFunction('__rpc', rpc);
    await ctx.addInitScript(fake(uid));
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`P${i + 1} ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && errs.push(`P${i + 1} ${m.text()}`));
    await p.goto(URL);
    await p.waitForFunction(() => window.__sinuca);
    pages.push(p);
  }
  const [A, B] = pages;
  const W = (ms) => A.waitForTimeout(ms);
  const st = (p) => p.evaluate(() => {
    const a = window.__sinuca; const g = a.game; const r = a.net?.room;
    return { status: r?.status, version: r?.version, moves: r?.moves, turn: r?.turn, round: r?.round, scores: r?.scores, me: a.net?.player,
      netMoves: a.netMoves, phase: g?.phase, current: g?.match.current, winner: g?.match.winner, drift: a.netLastDrift,
      balls: g ? JSON.stringify(g.world.balls.map((x) => [x.id, x.x, x.y, x.pocketed])) : '', groups: g?.match.players.map((p) => p.group),
      canAim: a.humanCanAim(), over: document.getElementById('over').classList.contains('show'),
      bar: document.querySelector('#msgbar > .online-bar span')?.textContent };
  });

  // 1) Cartão online visível; criar e entrar
  console.log('Cartão "Online privado" visível:', await A.isVisible('#btn-play-online'));
  await A.click('#btn-play-online');
  await A.fill('[data-net="name"]', 'Ana');
  await A.screenshot({ path: `${out}/sinuca-online-lobby.png` });
  await A.click('[data-net="create"]');
  await A.waitForFunction(() => window.__sinuca.net?.room);
  const code = await A.evaluate(() => window.__sinuca.net.room.code);
  console.log('Sala criada, código:', code, '| barra:', (await st(A)).bar);
  // botão Copiar (bug do Leon 03/11: pausava e não copiava). Sem permissão de área de transferência aqui → testa o plano B.
  await A.click('#msgbar [data-net="copy"]');
  await W(300);
  console.log('Copiar código:', await A.textContent('#msgbar [data-net="summary"]'), '| pausou:', await A.evaluate(() => window.__sinuca.paused));
  await B.click('#btn-play-online');
  await B.fill('[data-net="name"]', 'Bia');
  await B.fill('[data-net="code"]', code);
  await B.click('[data-net="join"]');
  await A.waitForFunction(() => window.__sinuca.net?.room?.status === 'playing');
  await B.waitForFunction(() => window.__sinuca.net?.room?.status === 'playing');
  await W(300);
  let a = await st(A), bb = await st(B);
  console.log('Começou:', a.status, '| A é J', a.me + 1, 'pode tacar:', a.canAim, '| B é J', bb.me + 1, 'pode tacar:', bb.canAim);
  await A.screenshot({ path: `${out}/sinuca-online-A.png` });

  // 2) Tacadas alternadas: quem está na vez taca; o outro repete; mesas têm de ficar idênticas
  const shooter = async () => ((await st(A)).canAim ? A : (await st(B)).canAim ? B : null);
  let drifts = [], equal = 0, shots = 0, delays = [];
  const angles = [0.0, 2.3, -0.9, 1.4];
  for (const ang of angles) {
    let p = null;
    for (let k = 0; k < 40 && !p; k++) { p = await shooter(); if (!p) await W(150); }
    if (!p) { console.log('ninguém pode tacar (fim?)'); break; }
    const before = (await st(A)).moves;
    const watcher = p === A ? B : A;
    // mede quanto o outro aparelho demora para COMEÇAR a animar (antes: só depois de as bolas pararem aqui)
    await watcher.evaluate(() => { window.__tReplay = new Promise((r) => { const f = () => (window.__sinuca.netReplay ? r(Date.now()) : requestAnimationFrame(f)); f(); }); });
    await p.evaluate(() => { window.__tRoll = new Promise((r) => { let t0 = 0; const f = () => { const ph = window.__sinuca.game.phase; if (!t0 && ph === 'rolling') t0 = Date.now(); if (t0 && ph !== 'rolling') r([t0, Date.now()]); else requestAnimationFrame(f); }; f(); }); });
    await p.evaluate((ang) => {
      const app = window.__sinuca; const g = app.game;
      if (g.needsCall()) g.callPocket(0);
      app.beginStrike(ang, g.match.isBreak ? 1 : 0.55);
    }, ang);
    await A.waitForFunction((m) => { const a = window.__sinuca; return a.netMoves > m && a.game.phase !== 'rolling' && !a.netReplay; }, before, { timeout: 60000 });
    await B.waitForFunction((m) => { const a = window.__sinuca; return a.netMoves > m && a.game.phase !== 'rolling' && !a.netReplay; }, before, { timeout: 60000 });
    const [t0, t1] = await p.evaluate(() => window.__tRoll);
    const tr = await watcher.evaluate(() => window.__tReplay);
    delays.push(`${tr - t0} ms (bolas rolaram ${t1 - t0} ms)`);
    await W(200);
    a = await st(A); bb = await st(B); shots++;
    const other = p === A ? bb : a;
    drifts.push(other.drift);
    if (a.balls === bb.balls && a.current === bb.current && JSON.stringify(a.groups) === JSON.stringify(bb.groups)) equal++;
    if (a.winner !== null && a.winner !== undefined) break;
  }
  console.log(`Tacadas: ${shots} | mesas idênticas nos 2 aparelhos depois de cada tacada: ${equal}/${shots}`);
  console.log('Atraso até o outro aparelho começar a animar (sem a internet; o real soma ~0,2–0,6 s):', delays.join(' | '));
  console.log('Maior diferença da repetição (m) por tacada:', drifts.map((d) => (d === Infinity ? 'bola caiu diferente' : d.toExponential(1))).join(' '));
  await B.screenshot({ path: `${out}/sinuca-online-B.png` });

  a = await st(A);
  if (a.winner !== null && a.winner !== undefined) console.log('AVISO: partida terminou de verdade nas tacadas de teste (vencedor J' + (a.winner + 1) + '); passos 3–4 ficam sem sentido.');
  // 3) Vez de quem não pode tacar: não consegue (servidor também recusaria)
  a = await st(A); bb = await st(B);
  console.log('Só um pode tacar agora:', a.canAim !== bb.canAim, `(A ${a.canAim}, B ${bb.canAim})`);

  // 4) Tempo esgotado reivindicado pelo outro (simula 60 s: banco e relógio local recuados)
  const waiting = a.canAim ? B : A;
  const movesBefore = a.moves;
  await db.exec("update public.clashcade_rooms set turn_started=now()-interval '70 seconds'");
  await waiting.evaluate(() => { window.__sinuca.netTurnSeen = -1e9; });
  await A.waitForFunction((m) => window.__sinuca.netMoves > m, movesBefore, { timeout: 10000 }).catch(() => {});
  await W(400);
  a = await st(A); bb = await st(B);
  console.log('Tempo esgotado do outro: jogadas', movesBefore, '→', a.moves, '| vez passou para quem reivindicou:', (waiting === A ? a : bb).canAim, '| mesas iguais:', a.balls === bb.balls);

  // 5) Fim de partida → revanche (força um vencedor só para testar a tela; a regra de vitória já tem teste próprio)
  a = await st(A);
  const p = a.canAim ? A : B;
  if (a.status === 'playing') await p.evaluate(() => { const app = window.__sinuca; const g = app.game; g.match = { ...g.match, winner: g.match.current, winReason: 'QA: vitória forçada' }; app.netSend('shot'); });
  await A.waitForFunction(() => document.getElementById('over').classList.contains('show'), null, { timeout: 8000 });
  console.log('Tela de fim nos 2 aparelhos: sim | título A:', await A.textContent('#over-title'), '| B:', await B.textContent('#over-title'));
  await B.waitForFunction(() => document.getElementById('over').classList.contains('show'), null, { timeout: 8000 });
  a = await st(A);
  console.log('Fim: placar', JSON.stringify(a.scores), '| botões A:', await A.textContent('#btn-rematch'), '/', await A.textContent('#btn-over-menu'));
  await A.screenshot({ path: `${out}/sinuca-online-fim.png` });
  await A.click('#btn-rematch');
  await B.waitForFunction(() => document.getElementById('btn-rematch').textContent.includes('Aceitar'), null, { timeout: 5000 }).catch(() => {});
  console.log('B vê:', await B.textContent('#btn-rematch'));
  await B.click('#btn-rematch');
  await A.waitForFunction(() => window.__sinuca.net.room.round === 2 && !document.getElementById('over').classList.contains('show'), null, { timeout: 8000 });
  await W(300);
  a = await st(A); bb = await st(B);
  console.log('Revanche: rodada', a.round, '| abre agora J', a.turn + 1, '| A pode tacar', a.canAim, '| B pode tacar', bb.canAim, '| mesa nova:', a.moves === 0 && a.balls === bb.balls);

  // 6) Sair da sala: o outro vê "Sala encerrada"
  await A.click('#msgbar > .online-bar [data-net="leave"]');
  await B.waitForFunction(() => window.__sinuca.net?.room?.status === 'closed', null, { timeout: 5000 });
  await W(1200);
  console.log('A voltou ao menu:', await A.isVisible('#menu'), '| B vê:', await B.textContent('#over-title'), '/', await B.textContent('#btn-rematch'));
  await B.click('#btn-rematch');
  await W(400);
  console.log('B saiu e voltou ao menu:', await B.isVisible('#menu'), '| cartão online de novo:', await B.isVisible('#btn-play-online'));

  // 7) Modo local continua normal depois do online
  await B.click('#btn-play-local');
  await W(300);
  console.log('2P local depois do online: pode tacar', (await st(B)).canAim, '| barra online escondida:', !(await B.isVisible('#msgbar > .online-bar')));

  console.log('ERROS:', errs.length ? errs : 'nenhum');
  await b.close();
  await db.close();
})();
