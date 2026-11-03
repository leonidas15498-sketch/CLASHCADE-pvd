import { onMountRollback } from '../shared/lifecycle';
import { translateDom } from '../../i18n/domTranslate';
import { GOLF_EN, GOLF_PATTERNS } from '../../i18n/poolGolfEn';
import type { GameModule } from '../shared/types';
import { MinigolfApp } from './ui/app';
import css from './ui/style.css?inline';
import template from './ui/template.html?raw';

const minigolf: GameModule = {
  mount(container, { onExit }) {
    const style = document.createElement('style');
    onMountRollback(() => { style.remove(); container.replaceChildren(); });
    style.dataset.game = 'minigolf';
    style.textContent = css;
    document.head.appendChild(style);
    container.innerHTML = template;
    // inglês: traduz textos fixos e os que aparecem depois (pt-BR: não faz nada)
    const stopTr = translateDom(container, GOLF_EN, GOLF_PATTERNS);
    onMountRollback(stopTr);
    const app = new MinigolfApp(container.querySelector('#mg-root')!, onExit);
    (window as unknown as { __minigolf?: MinigolfApp }).__minigolf = app;
    return {
      destroy() {
        stopTr();
        app.dispose();
        delete (window as unknown as { __minigolf?: MinigolfApp }).__minigolf;
        container.innerHTML = '';
        style.remove();
      },
    };
  },
};

export default minigolf;
