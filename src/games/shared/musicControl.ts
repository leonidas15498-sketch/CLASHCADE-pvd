import { T } from '../../i18n/lang';
import type { Music } from './music';

/**
 * Botão de música na tela do jogo: um toque abre o painel com liga/desliga e volume.
 * Independente dos efeitos sonoros. Cada jogo passa a própria música e onde salvar a escolha.
 */
export interface MusicPrefs {
  enabled: boolean;
  volume: number;
}

const CSS = `
.mc-wrap{position:relative;display:inline-flex}
.mc-btn.off svg .mc-slash{display:block}
.mc-btn svg .mc-slash{display:none}
.mc-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:220px;padding:12px 14px;border-radius:14px;
  background:#1b1513;border:1px solid rgba(255,255,255,.16);box-shadow:0 12px 30px rgba(0,0,0,.6);color:#f4ece0;
  display:flex;flex-direction:column;gap:10px;font:14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.mc-pop[hidden]{display:none}
.mc-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mc-title{font-weight:800}
.mc-switch{min-width:68px;min-height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.2);font-weight:800;cursor:pointer}
.mc-switch[aria-checked=true]{background:#2fa864;color:#fff}
.mc-switch[aria-checked=false]{background:#3a302b;color:#d8cbb8}
.mc-vol{width:100%;accent-color:#f2c14e}
.mc-vol:disabled{opacity:.4}
.mc-pct{font-variant-numeric:tabular-nums;color:#d8cbb8;font-size:12px}
`;

const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18.5A2.5 2.5 0 1 1 6.5 16c.36 0 .7.08 1 .21V5l11-2v12.5A2.5 2.5 0 1 1 16 13c.36 0 .7.08 1 .21V7.2l-8 1.45z"/><path class="mc-slash" d="M3.3 2.3 21.7 20.7l-1.4 1.4L1.9 3.7z"/></svg>`;

export function mountMusicControl(
  host: HTMLElement,
  music: Music,
  initial: MusicPrefs,
  onChange: (p: MusicPrefs) => void,
  btnClass = 'icon-btn',
): { destroy(): void } {
  const style = document.createElement('style');
  style.textContent = CSS;
  host.appendChild(style);
  const wrap = document.createElement('div');
  wrap.className = 'mc-wrap';
  wrap.innerHTML = `
    <button class="${btnClass} mc-btn" type="button" aria-haspopup="true" aria-expanded="false" title="${T('Música', 'Music')}">${ICON}</button>
    <div class="mc-pop" hidden role="dialog" aria-label="${T('Música', 'Music')}">
      <div class="mc-row"><span class="mc-title">${T('Música', 'Music')}</span>
        <button class="mc-switch" type="button" role="switch"></button></div>
      <label class="mc-row"><span>Volume</span><span class="mc-pct"></span></label>
      <input class="mc-vol" type="range" min="0" max="100" step="5" aria-label="${T('Volume da música', 'Music volume')}" />
    </div>`;
  host.appendChild(wrap);
  const btn = wrap.querySelector<HTMLButtonElement>('.mc-btn')!;
  const pop = wrap.querySelector<HTMLDivElement>('.mc-pop')!;
  const sw = wrap.querySelector<HTMLButtonElement>('.mc-switch')!;
  const vol = wrap.querySelector<HTMLInputElement>('.mc-vol')!;
  const pct = wrap.querySelector<HTMLSpanElement>('.mc-pct')!;
  const st: MusicPrefs = { ...initial };

  const paint = () => {
    sw.setAttribute('aria-checked', String(st.enabled));
    sw.textContent = st.enabled ? T('Ligada', 'On') : T('Desligada', 'Off');
    btn.classList.toggle('off', !st.enabled);
    btn.setAttribute('aria-label', st.enabled ? T('Música ligada — ajustar', 'Music on — adjust') : T('Música desligada — ajustar', 'Music off — adjust'));
    vol.value = String(Math.round(st.volume * 100));
    vol.disabled = !st.enabled;
    pct.textContent = `${Math.round(st.volume * 100)}%`;
  };
  const commit = () => {
    music.volume = st.volume;
    music.setEnabled(st.enabled);
    paint();
    onChange({ ...st });
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', String(!pop.hidden));
  });
  sw.addEventListener('click', () => {
    st.enabled = !st.enabled;
    commit();
  });
  vol.addEventListener('input', () => {
    st.volume = Number(vol.value) / 100;
    commit();
  });
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
  const close = (e: Event) => {
    if (!wrap.contains(e.target as Node)) {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  };
  document.addEventListener('pointerdown', close, true);
  music.volume = st.volume;
  music.enabled = st.enabled;
  paint();
  return {
    destroy() {
      document.removeEventListener('pointerdown', close, true);
      wrap.remove();
      style.remove();
    },
  };
}
