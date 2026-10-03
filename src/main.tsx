import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

const embedded = window.self !== window.top;

// Aperçu iPhone : pilotage par la page qui l'affiche (thème, données d'exemple).
if (embedded) void import('./dev/harness').then((m) => m.startHarness());

// Fonctionnement hors ligne (uniquement dans la version publiée, hors aperçu).
if (import.meta.env.PROD && !embedded && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

// Demande à Safari de ne jamais effacer la base locale de l'app.
void navigator.storage?.persist?.();
