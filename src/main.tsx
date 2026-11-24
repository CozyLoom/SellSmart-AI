import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as Window & { __SELLSMART_MOUNTED__?: boolean }).__SELLSMART_MOUNTED__ = true;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
