import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, DataTable, Button, Banner, Text, Spinner, Badge, ProgressBar, Tabs, BlockStack, InlineGrid
} from '@shopify/polaris';
import { api } from '../api/shopify';

interface Summary {
  overallScore: number | null;
  totalApps: number; activeApps: number;
  findings: { open: number; high: number; medium: number; low: number };
  consentCount: number; dsrCount: number;
  lastUpdated: string;
}

interface ScoreData {
  overallScore: number;
  breakdown: Record<string, number>;
  recommendations: string[];
}

interface ChecklistCategory {
  category: string; title: string;
  items: { id: string; title: string; description: string | null; completed: boolean; score: number | null; weight: number; isRequired: boolean }[];
  done: number; total: number;
}

interface Checklist { categories: ChecklistCategory[]; overallProgress: number; }

interface ScoreHistory { history: { date: string; score: number }[]; stats: { avg_score: number; trend: string; data_points: number }; }

interface PlatformStatus { shopify: { connected: boolean; apiVersion: string; isCompliant: boolean }; database: { connected: boolean }; lastSync: string; }

export default function ComplianceDashboard() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [history, setHistory] = useState<ScoreHistory | null>(null);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sc, c, h, p] = await Promise.all([
        api.dashboard.summary(),
        api.dashboard.score(),
        api.dashboard.checklist(),
        api.dashboard.scoreHistory(),
        api.dashboard.platformStatus(),
      ]);
      setSummary(s.data || s);
      setScore(sc.data || sc);
      setChecklist(c.data || c);
      setHistory(h.data || h);
      setPlatformStatus(p.data || p);
    } catch (e: any) { setToast(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggleChecklist = async (id: string, current: boolean) => {
    await api.dashboard.updateChecklistItem(id, { completed: !current });
    loadData();
  };

  const handleSnapshot = async () => {
    await api.dashboard.snapshot();
    loadData();
  };

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'score', content: 'Score' },
    { id: 'checklist', content: 'Checklist' },
    { id: 'platform', content: 'Platform' },
  ];

  if (loading && !summary) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      {toast && <Banner tone="critical" onDismiss={() => setToast('')}>{toast}</Banner>}
      <Tabs tabs={tabs} selected={tab} onSelect={setTab} />

      {tab === 0 && summary && (
        <BlockStack gap="400">
          <InlineGrid columns="5" gap="400">
            <Card>
              <Text as="p" variant="headingXl">{summary.overallScore ?? '—'}</Text>
              <Text as="p" variant="bodySm">Overall Score</Text>
              <Button variant="plain" onClick={loadData}>Refresh</Button>
            </Card>
            <Card>
              <Text as="p" variant="headingXl">{summary.totalApps}</Text>
              <Text as="p" variant="bodySm">Total Apps ({summary.activeApps} active)</Text>
            </Card>
            <Card>
              <Text as="p" variant="headingXl">{summary.findings.open}</Text>
              <Text as="p" variant="bodySm">Open Findings (H:{summary.findings.high} M:{summary.findings.medium} L:{summary.findings.low})</Text>
            </Card>
            <Card>
              <Text as="p" variant="headingXl">{summary.consentCount}</Text>
              <Text as="p" variant="bodySm">Consent Records</Text>
            </Card>
            <Card>
              <Text as="p" variant="headingXl">{summary.dsrCount}</Text>
              <Text as="p" variant="bodySm">DSR Requests</Text>
            </Card>
          </InlineGrid>
          <Text as="p" variant="bodySm" tone="subdued">Last updated: {summary.lastUpdated ? new Date(summary.lastUpdated).toLocaleString() : 'never'}</Text>
        </BlockStack>
      )}

      {tab === 1 && (
        <BlockStack gap="400">
          {score && (
            <Card>
              <Text as="h3" variant="headingMd">Score: {score.overallScore}/100</Text>
              <ProgressBar progress={score.overallScore} />
              <div style={{ marginTop: 'var(--p-space-4)' }}>
                {Object.entries(score.breakdown).map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 'var(--p-space-2)' }}>
                    <Text as="p" variant="bodyMd">{k}: {v}/100</Text>
                    <ProgressBar progress={v} />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {score?.recommendations && score.recommendations.length > 0 && (
            <Card>
              <Text as="h3" variant="headingMd">Recommendations</Text>
              {score.recommendations.map((r, i) => <Text key={i} as="p" variant="bodyMd">• {r}</Text>)}
            </Card>
          )}
          <div style={{ display: 'flex', gap: 'var(--p-space-2)' }}>
            <Button onClick={handleSnapshot}>Take Snapshot</Button>
          </div>
          {history && (
            <Card>
              <Text as="h3" variant="headingMd">Score History</Text>
              <Text as="p" variant="bodySm">Trend: {history.stats.trend} (avg: {history.stats.avg_score.toFixed(1)}, {history.stats.data_points} points)</Text>
              <div style={{ marginTop: 'var(--p-space-2)' }}>
                {history.history.slice(-14).map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 'var(--p-space-2)', alignItems: 'center', marginBottom: 'var(--p-space-1)' }}>
                    <div style={{ minWidth: 80 }}><Text as="p" variant="bodySm" tone="subdued">{new Date(h.date).toLocaleDateString()}</Text></div>
                    <ProgressBar progress={h.score} />
                    <Text as="p" variant="bodySm">{h.score}</Text>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </BlockStack>
      )}

      {tab === 2 && checklist && (
        <BlockStack gap="400">
          <Card>
            <Text as="h3" variant="headingMd">Overall Progress</Text>
            <ProgressBar progress={checklist.overallProgress} />
          </Card>
          {checklist.categories.map(cat => (
            <Card key={cat.category}>
              <Text as="h4" variant="headingSm">{cat.title} ({cat.done}/{cat.total})</Text>
              {cat.items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--p-space-2)', marginBottom: 'var(--p-space-2)' }}>
                  <input type="checkbox" checked={item.completed} onChange={() => handleToggleChecklist(item.id, item.completed)} />
                  <div>
                    <Text as="p" variant="bodyMd">{item.title}</Text>
                    {item.description && <Text as="p" variant="bodySm" tone="subdued">{item.description}</Text>}
                  </div>
                  {item.isRequired && <Badge tone="info">Required</Badge>}
                </div>
              ))}
            </Card>
          ))}
        </BlockStack>
      )}

      {tab === 3 && platformStatus && (
        <InlineGrid columns="3" gap="400">
          <Card>
            <Text as="h3" variant="headingMd">Shopify</Text>
            <Text as="p" variant="bodyMd">Status: {platformStatus.shopify.connected ? <Badge tone="success">Connected</Badge> : <Badge tone="critical">Disconnected</Badge>}</Text>
            <Text as="p" variant="bodyMd">API: {platformStatus.shopify.apiVersion}</Text>
            <Text as="p" variant="bodyMd">Compliant: {platformStatus.shopify.isCompliant ? <Badge tone="success">Yes</Badge> : <Badge tone="critical">No</Badge>}</Text>
          </Card>
          <Card>
            <Text as="h3" variant="headingMd">Database</Text>
            <Text as="p" variant="bodyMd">Status: {platformStatus.database.connected ? <Badge tone="success">Connected</Badge> : <Badge tone="critical">Disconnected</Badge>}</Text>
          </Card>
          <Card>
            <Text as="p" variant="bodySm">Last Sync: {platformStatus.lastSync ? new Date(platformStatus.lastSync).toLocaleString() : 'never'}</Text>
            <Button onClick={loadData}>Refresh Status</Button>
          </Card>
        </InlineGrid>
      )}
    </BlockStack>
  );
}
