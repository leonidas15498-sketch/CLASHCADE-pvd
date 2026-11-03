import { onMountRollback } from '../shared/lifecycle';
import { translateDom } from '../../i18n/domTranslate';
import { POOL_EN, POOL_PATTERNS } from '../../i18n/poolGolfEn';
import type { GameModule } from '../shared/types';
import css from './style.css?inline';
import template from './template.html?raw';
import { App } from './ui/app';

/** Monta a Sinuca dentro do contêiner do portal e devolve como desmontar. */
const pool: GameModule = {
  mount(container, { onExit }) {
    const style = document.createElement('style');
    onMountRollback(() => { style.remove(); container.replaceChildren(); });
    style.dataset.game = 'pool';
    style.textContent = css;
    document.head.appendChild(style);
    container.innerHTML = template;
    // inglês: traduz textos fixos e os que aparecem depois (pt-BR: não faz nada)
    const stopTr = translateDom(container, POOL_EN, POOL_PATTERNS);
    onMountRollback(stopTr);
    const app = new App({ onExit });
    (window as unknown as { __sinuca?: App }).__sinuca = app;
    return {
      destroy() {
        stopTr();
        app.dispose();
        delete (window as unknown as { __sinuca?: App }).__sinuca;
        container.innerHTML = '';
        style.remove();
      },
    };
  },
};

export default pool;
