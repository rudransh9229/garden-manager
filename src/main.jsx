import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles.css';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import { UiProvider } from './uiContext.jsx';
import { createLocalBackend } from './lib/backends/local.js';

function Shell({ backend }) {
  return (
    <StoreProvider backend={backend}>
      <UiProvider>
        <App />
      </UiProvider>
    </StoreProvider>
  );
}

async function start() {
  let root;
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    // Online mode: sign in first, then the records come from Firebase.
    const [{ startFirebase }, { default: AuthGate }] = await Promise.all([
      import('./lib/firebase.js'),
      import('./components/AuthGate.jsx'),
    ]);
    const firebase = startFirebase();
    root = <AuthGate firebase={firebase}>{(backend) => <Shell key={backend.account} backend={backend} />}</AuthGate>;
  } else {
    // Prototype mode: records stay in this browser.
    root = <Shell backend={createLocalBackend()} />;
  }
  // HashRouter keeps every address working when the built folder is opened from any static host.
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HashRouter>{root}</HashRouter>
    </React.StrictMode>,
  );
}
start();
