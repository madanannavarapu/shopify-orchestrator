import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Page, Layout, Card, Tabs, Button, Text } from '@shopify/polaris';
import { api, getToken } from './api/shopify';
import Dashboard from './components/Dashboard';
import ComplianceScanner from './components/ComplianceScanner';
import ConsentManager from './components/ConsentManager';
import DsrManager from './components/DsrManager';
import TenantSettings from './components/TenantSettings';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import InstallPage from './components/InstallPage';

type PageState = 'loading' | 'landing' | 'auth' | 'app';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dashboard" element={<EmbeddedApp />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="*" element={<StandaloneApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function EmbeddedApp() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      api.auth.me().then((res) => setUser(res.user)).catch(() => {});
    }
  }, []);

  return (
    <Page
      title="Compliance Engine"
      subtitle="Shopify App Compliance Dashboard"
      primaryAction={user && (
        <Text as="span" variant="bodySm" tone="subdued">{user.name || user.email}</Text>
      )}
    >
      <Layout>
        <Layout.Section>
          <Dashboard />
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StandaloneApp() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');
    if (shop === 'demo') {
      setPageState('app');
      return;
    }
    if (shop && params.get('connected')) {
      setPageState('app');
      return;
    }
    const token = getToken();
    if (token) {
      api.auth.me().then((res) => {
        setUser(res.user);
        setPageState('app');
      }).catch(() => {
        localStorage.removeItem('auth_token');
        setPageState('landing');
      });
      return;
    }
    if (shop) {
      // ponytail: auto-OAuth once per tab session; connected=1 from the callback marks success, otherwise stop on AuthPage
      if (sessionStorage.getItem('oauth_attempted')) {
        setPageState('auth');
      } else {
        sessionStorage.setItem('oauth_attempted', '1');
        const host = params.get('host');
        window.location.href = `/auth?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`;
      }
      return;
    }
    setPageState('landing');
  }, []);

  const handleAuth = () => {
    const token = getToken();
    if (token) {
      api.auth.me().then((res) => {
        setUser(res.user);
        setPageState('app');
      }).catch(() => setPageState('auth'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setPageState('landing');
  };

  const tabs = [
    { id: 'dashboard', content: 'Dashboard' },
    { id: 'scanner', content: 'Scanner' },
    { id: 'consent', content: 'Consent' },
    { id: 'dsr', content: 'DSR' },
    { id: 'settings', content: 'Settings' },
  ];

  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  const renderPage = () => {
    switch (selectedTab) {
      case 0: return <Dashboard />;
      case 1: return <ComplianceScanner />;
      case 2: return <ConsentManager />;
      case 3: return <DsrManager />;
      case 4: return <TenantSettings />;
      default: return <Dashboard />;
    }
  };

  if (pageState === 'landing') {
    return <LandingPage onGetStarted={() => setPageState('auth')} />;
  }

  if (pageState === 'auth') {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <Page
      title="App Orchestrator"
      subtitle="Enterprise Shopify App Stack Audit & Governance Platform"
      primaryAction={user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--p-space-200)' }}>
          <Text as="span" variant="bodySm" tone="subdued">{user.name || user.email}</Text>
          <Button size="slim" onClick={handleLogout}>Logout</Button>
        </div>
      )}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} fitted />
          </Card>
        </Layout.Section>
        <Layout.Section>{renderPage()}</Layout.Section>
      </Layout>
    </Page>
  );
}
