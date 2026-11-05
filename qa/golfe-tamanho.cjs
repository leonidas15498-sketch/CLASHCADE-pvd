// QA: tamanho do campo do minigolfe no celular deitado (pedido do Leon 05/11: "igual à sinuca").
// Mede a área do canvas e calcula a escala (px por unidade) de cada buraco. Uso: node qa/golfe-tamanho.cjs
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const levels = JSON.parse(execSync('npx vite-node scripts/golfe-bounds.ts', { encoding: 'utf8' }).trim().split('\n').pop());
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[732, 276], [762, 343]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, locale: 'pt-BR', hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
    await p.goto('http://localhost:4174/#minigolfe');
    await p.waitForTimeout(700);
    await p.click('#mg-play-solo');
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const wrap = q('#mg-canvas-wrap');
      const over = [...document.querySelectorAll('.mg-hud > *, .mg-left > *, .mg-right > *')].some((e) => { const a = e.getBoundingClientRect(); return a.right > innerWidth + 1 || a.bottom > innerHeight + 1 || (a.width === 0 && getComputedStyle(e).display !== 'none' && e.childElementCount + e.textContent.trim().length > 0); });
      return { wrap, power: q('#mg-power'), fine: q('.mg-fine'), hud: q('.mg-hud'), over };
    });
    if (w === 762) await p.screenshot({ path: '/tmp/claude-0/-home-claude/9f7de273-8a72-58aa-8c66-242ada8d613e/scratchpad/golfe-762.png' });
    const sc = levels.map((l) => Math.min(r.wrap.w / l.b.w, r.wrap.h / l.b.h));
    const media = sc.reduce((a, c) => a + c, 0) / sc.length;
    console.log(`${w}×${h}: área ${r.wrap.w}×${r.wrap.h} · HUD ${r.hud.h}px · força ${r.power.w}×${r.power.h} · mira ${r.fine.w}px · fora da tela: ${r.over}`);
    console.log(`  escala por buraco: ${sc.map((s) => s.toFixed(2)).join(' ')} · média ${media.toFixed(2)}`);
    await p.close();
  }
  await b.close();
})();
