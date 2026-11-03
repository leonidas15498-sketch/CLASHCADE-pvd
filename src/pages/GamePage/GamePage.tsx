import { mountSafely } from '../../games/shared/lifecycle';
import { Component, ReactNode, useEffect, useRef, useState } from 'react';
import type { GameEntry } from '../../games/registry';

/** Isola falhas: um erro dentro de um jogo não derruba o portal. */
class Boundary extends Component<{ onBack: () => void; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error) return <GameError msg={this.state.error} onBack={this.props.onBack} />;
    return this.props.children;
  }
}

function GameError({ msg, onBack }: { msg: string; onBack: () => void }) {
  return (
    <div className="game-msg" role="alert">
      <h2>Não foi possível abrir o jogo</h2>
      <p>{msg}</p>
      <button className="play" onClick={onBack}>
        Voltar aos jogos
      </button>
    </div>
  );
}

function Mount({ game, onBack }: { game: GameEntry; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading');

  useEffect(() => {
    let cancelled = false;
    let instance: { destroy(): void } | null = null;
    game
      .load!()
      .then((mod) => {
        if (cancelled || !ref.current) return;
        try {
          const host = ref.current;
          instance = mountSafely(() => mod.default.mount(host, { onExit: onBack }));
          setState('ready');
        } catch (e) {
          ref.current?.replaceChildren();
          setState({ error: e instanceof Error ? e.message : String(e) });
        }
      })
      .catch(() => !cancelled && setState({ error: 'O jogo não carregou. Confira a conexão e tente de novo.' }));
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [game, onBack]);

  return (
    <>
      {state === 'loading' && (
        <div className="game-msg" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Carregando {game.name}…</p>
        </div>
      )}
      {typeof state === 'object' && <GameError msg={state.error} onBack={onBack} />}
      <div ref={ref} className="game-host" />
    </>
  );
}

export function GamePage({ game, onBack }: { game: GameEntry; onBack: () => void }) {
  return (
    <Boundary onBack={onBack}>
      <Mount game={game} onBack={onBack} />
    </Boundary>
  );
}
