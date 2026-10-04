import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// A tab left open across deployments can request an old lazy chunk. Recover once.
window.addEventListener('vite:preloadError', event => {
  const last = Number(sessionStorage.getItem('tte:chunk-reload') || 0);
  if (Date.now() - last > 60_000) {
    sessionStorage.setItem('tte:chunk-reload', String(Date.now()));
    event.preventDefault();
    window.location.reload();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);