import { decodeRoute } from './route';
import { useCallback, useEffect, useState } from 'react';
import { gameByRoute } from '../games/registry';
import { GamePage } from '../pages/GamePage/GamePage';
import { Home } from '../pages/Home/Home';

/** Rota simples pelo hash (#sinuca, #minigolfe). Trocar de jogo não recarrega a página. */
function readRoute(): string {
  return decodeRoute(location.hash);
}

export function App() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const open = useCallback((r: string) => {
    location.hash = r;
  }, []);
  const back = useCallback(() => {
    if (location.hash) location.hash = '';
    setRoute('');
  }, []);

  const game = gameByRoute(route);
  if (game && game.status === 'available' && game.load) return <GamePage key={game.id} game={game} onBack={back} />;
  return <Home onOpen={open} />;
}
