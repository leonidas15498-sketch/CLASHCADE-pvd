/** Contrato entre o portal e cada jogo. Cada jogo é carregado sob demanda e vive isolado no seu contêiner. */
export interface GameInstance {
  /** Libera tudo: laço de animação, áudio, timers, listeners globais e o DOM do jogo. */
  destroy(): void;
}

export interface MountOptions {
  /** Pedido do jogo para voltar ao catálogo (o próprio jogo pede confirmação antes, se houver partida). */
  onExit: () => void;
}

export interface GameModule {
  mount(container: HTMLElement, opts: MountOptions): GameInstance;
}
