// Taxa de quadros dos 10 jogos em partida (celular deitado e em pé). Uso: node qa/fps.cjs
// Mede intervalos de requestAnimationFrame por 4 s: média, p95, pior quadro e quadros > 50 ms (travadas visíveis).
// CPU desacelerada 4× (simula celular fraco) via DevTools. Navegador automatizado sem placa de vídeo e limitado a 60 Hz:
// os números comparam jogos entre si, não são o FPS do celular real.
const { chromium } = require('playwright');
const list = [['sinuca', 'button:visible:has-text("Jogar contra a IA")'], ['minigolfe', 'button:visible:has-text("Jogar 9 buracos")'], ['air-hockey', '[data-k="play-ai"]'], ['duelo-rastros', '[data-k="play-ai"]'], ['empilha', '[data-k="play-ai"]'], ['lig-4', '[data-k="play-ai"]'], ['pong', '[data-k="play-ai"]'], ['blocos', '[data-k="play-solo"]'], ['sumo-neon', '[data-k="play-ai"]'], ['cabo-de-guerra', '[data-k="play-ai"]']];
const only = process.env.FPS_SO ? process.env.FPS_SO.split(',') : null; // ex.: FPS_SO=empilha,sumo-neon
(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[915, 412, 'deitado'], [412, 860, 'em pé']]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.5, locale: 'pt-BR', hasTouch: true })).newPage();
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    console.log(`— ${tag} ${w}×${h} @2,5x, CPU 4× mais lenta`);
    for (const [r, sel] of list.filter(([r]) => !only || only.includes(r))) {
      await p.goto('about:blank');
      await p.goto('http://localhost:4174/#' + r);
      await p.waitForTimeout(900);
      const el = await p.$(sel);
      try {
        if (el) await el.click({ timeout: 3000 });
      } catch {
        console.log(`${r.padEnd(14)} pede para girar o celular (só joga deitado)`);
        continue;
      }
      await p.waitForTimeout(800);
      const m = await p.evaluate(() => new Promise((res) => {
        const ts = [];
        const f = (t) => { ts.push(t); if (t - ts[0] < 4000) requestAnimationFrame(f); else res(ts); };
        requestAnimationFrame(f);
      }));
      const d = m.slice(1).map((t, i) => t - m[i]).sort((a, c) => a - c);
      const avg = d.reduce((s, x) => s + x, 0) / d.length;
      console.log(`${r.padEnd(14)} ${(1000 / avg).toFixed(0).padStart(3)} fps | p95 ${d[Math.floor(d.length * 0.95)].toFixed(1)} ms | pior ${d[d.length - 1].toFixed(0)} ms | >50 ms: ${d.filter((x) => x > 50).length}`);
    }
    console.log('ERROS:', errs.length ? errs : 'nenhum');
  }
  await b.close();
})();
