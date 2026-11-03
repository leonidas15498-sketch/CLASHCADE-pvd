import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/portal.css';
import './styles/v13.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Modo offline (PWA): só no site publicado (https, fora de iframe); falha silenciosa onde não é permitido.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* sem modo offline neste ambiente */
    });
  });
}
