import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
  requestAnimationFrame(() => {
    if (rootEl.childElementCount > 0) {
      (window as Window & { __SELLSMART_MOUNTED__?: boolean }).__SELLSMART_MOUNTED__ = true;
    }
  });
}
