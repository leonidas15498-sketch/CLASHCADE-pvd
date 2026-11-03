/**
 * Tela cheia no celular (pedido do Leon, 03/11: mesa pequena com o celular deitado).
 * Chamar só dentro de um toque/clique (o navegador exige). No computador, no app instalado
 * (que já abre sem barra) e no iPhone (sem suporte) não faz nada.
 */
export function enterGameFullscreen(): void {
  try {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
    if (!matchMedia('(pointer: coarse)').matches) return;
    if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return;
    void document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } catch {
    /* sem tela cheia neste navegador */
  }
}

/** Sai da tela cheia que o jogo abriu (ao voltar ao catálogo). */
export function exitGameFullscreen(): void {
  try {
    if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  } catch {
    /* nada */
  }
}
