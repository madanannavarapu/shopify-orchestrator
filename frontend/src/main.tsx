import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';
import App from './App';

function pingShopifySession() {
  const shopify = (window as any).shopify;
  if (!shopify?.idToken) return;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  Promise.race([Promise.resolve(shopify.idToken()), timeout])
    .then((token) => {
      if (!token) return;
      const base = import.meta.env.DEV ? '' : '/orchestrator';
      return fetch(`${base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    })
    .catch(() => {});
}

function RenderApp() {
  useEffect(() => {
    pingShopifySession();
  }, []);

  return (
    <AppProvider i18n={{}}>
      <App />
    </AppProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <RenderApp />
  </React.StrictMode>
);
