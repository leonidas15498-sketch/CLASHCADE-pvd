import { T } from '../../i18n/lang';
/** Etiqueta e botão de compra dos seletores de cosméticos (sinuca e golfe). Compra em dois toques, sem diálogo do navegador. */
import { buy, EVENT, getWallet, isPremiumActive, isUnlocked } from '../../services/economy';
import { itemByKey } from '../../services/catalog';

/**
 * Saldo de fichas no topo da loja do jogo (pedido do Leon, 03/11: cada jogo com a sua loja).
 * Atualiza sozinho quando a carteira muda; o listener sai junto com o jogo (signal do destroy).
 */
export function mountBalance(el: HTMLElement, signal: AbortSignal) {
  const paint = () => {
    const n = new Intl.NumberFormat().format(getWallet().balance);
    el.innerHTML = `<span class="shop-coin" aria-hidden="true"></span><b>${n}</b> ${T('fichas', 'chips')}<small>${T('Ganhe jogando, no bônus diário e nos desafios do portal.', 'Earn them by playing, with the daily bonus and the portal challenges.')}</small>`;
  };
  paint();
  window.addEventListener(EVENT, paint, { signal });
}

export function tierTag(key: string): string {
  const it = itemByKey(key);
  if (!it) return '';
  if (it.tier === 'default') return T('Padrão', 'Default');
  if (it.tier === 'coins') return isUnlocked(key) ? T('Comprado', 'Owned') : `${it.price} ${T('fichas', 'chips')}`;
  return isPremiumActive() ? T('Premium · liberado para teste', 'Premium · unlocked for testing') : 'Premium';
}

/** Se o item está bloqueado, transforma o botão em "Comprar" (fichas) ou "Só no Premium". */
export function wireLocked(btn: HTMLButtonElement, key: string, onBought: () => void) {
  if (isUnlocked(key)) return;
  const it = itemByKey(key);
  if (!it) return;
  if (it.tier !== 'coins') {
    btn.textContent = T('🔒 Só no Premium', '🔒 Premium only');
    btn.disabled = true;
    return;
  }
  const bal = getWallet().balance;
  if (bal < it.price) {
    btn.textContent = `🔒 ${it.price} ${T('fichas (você tem', 'chips (you have')} ${bal})`;
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  btn.textContent = `${T('Comprar', 'Buy')} · ${it.price} ${T('fichas', 'chips')}`;
  btn.dataset.buy = key;
  let armed = false;
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = `${T('Confirmar: gastar', 'Confirm: spend')} ${it.price} ${T('fichas', 'chips')}`;
      return;
    }
    const r = buy(key);
    if (r === 'ok' || r === 'owned') onBought();
  });
}
