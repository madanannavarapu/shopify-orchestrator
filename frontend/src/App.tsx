import React, { useState, useCallback, useEffect } from 'react';
import { Page, Layout, Card, Tabs, Button, Text } from '@shopify/polaris';
import { api, getToken } from './api/shopify';
import Dashboard from './components/Dashboard';
import AppInventory from './components/AppInventory';
import CompareApps from './components/CompareApps';
import ComplianceScanner from './components/ComplianceScanner';
import RemediationRoadmap from './components/RemediationRoadmap';
import ScoringDashboard from './components/ScoringDashboard';
import OwnershipTracker from './components/OwnershipTracker';
import StakeholderFeedback from './components/StakeholderFeedback';
import DataConflicts from './components/DataConflicts';
import ComplianceAudit from './components/ComplianceAudit';
import RecommendationsView from './components/RecommendationsView';
import AgentOpsDashboard from './components/AgentOpsDashboard';
import ChainAuditRunner from './components/ChainAuditRunner';
import IncidentResponse from './components/IncidentResponse';
import ThemeCleanup from './components/ThemeCleanup';
import VendorNegotiations from './components/VendorNegotiations';
import TenantSettings from './components/TenantSettings';
import QueryAssistant from './components/QueryAssistant';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';

type PageState = 'loading' | 'landing' | 'auth' | 'app';

export default function App() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const shop = new URLSearchParams(window.location.search).get('shop');
    if (shop === 'demo') {
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
    } else {
      setPageState('landing');
    }
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
    { id: 'inventory', content: 'App Inventory' },
    { id: 'compare', content: 'Compare' },
    { id: 'scoring', content: 'Scoring' },
    { id: 'recommendations', content: 'Recommendations' },
    { id: 'compliance', content: 'Compliance' },
    { id: 'incidents', content: 'Incidents' },
    { id: 'chain', content: 'Chain Audit' },
    { id: 'agents', content: 'Agent Ops' },
    { id: 'ownership', content: 'Ownership' },
    { id: 'feedback', content: 'Feedback' },
    { id: 'conflicts', content: 'Conflicts' },
    { id: 'theme', content: 'Theme Cleanup' },
    { id: 'negotiations', content: 'Negotiations' },
    { id: 'roadmap', content: 'Roadmap' },
    { id: 'audit', content: 'Audit Trail' },
    { id: 'query', content: 'Query' },
    { id: 'tenant', content: 'Tenant' },
  ];

  const handleTabChange = useCallback((i: number) => setSelectedTab(i), []);

  const renderPage = () => {
    switch (selectedTab) {
      case 0: return <Dashboard />;
      case 1: return <AppInventory />;
      case 2: return <CompareApps />;
      case 3: return <ScoringDashboard />;
      case 4: return <RecommendationsView />;
      case 5: return <ComplianceScanner />;
      case 6: return <IncidentResponse />;
      case 7: return <ChainAuditRunner />;
      case 8: return <AgentOpsDashboard />;
      case 9: return <OwnershipTracker />;
      case 10: return <StakeholderFeedback />;
      case 11: return <DataConflicts />;
      case 12: return <ThemeCleanup />;
      case 13: return <VendorNegotiations />;
      case 14: return <RemediationRoadmap />;
      case 15: return <ComplianceAudit />;
      case 16: return <QueryAssistant />;
      case 17: return <TenantSettings />;
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
