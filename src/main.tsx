import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress noisy Firebase IndexedDB error on unmount in dev preview
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('Database is closing/hidden')) {
    e.preventDefault();
  }
});
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('Database is closing/hidden')) {
    e.preventDefault();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
