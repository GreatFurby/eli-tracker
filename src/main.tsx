import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/plus-jakarta-sans/wght-italic.css';
import type { Mode } from './services/protocol';

const mode: Mode = new URLSearchParams(window.location.search).get('mode') === 'controller'
  ? 'controller' : 'viewer';
const manifest = document.createElement('link');
manifest.rel = 'manifest';
manifest.href = `${import.meta.env.BASE_URL}manifest-${mode}.webmanifest`;
document.head.append(manifest);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    console.warn('De offline appcache kon niet worden geïnstalleerd.');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App mode={mode} />
  </StrictMode>,
);
