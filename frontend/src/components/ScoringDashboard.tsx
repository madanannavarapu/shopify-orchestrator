import React, { useState } from 'react';
import {
  Card,
  Text,
  DataTable,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Banner,
  Spinner,
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { ScoredApp } from '../types';

const scoreColor = (n: number) => {
  if (n >= 4) return 'success';
  if (n >= 3) return 'info';
  if (n >= 2) return 'warning';
  return 'critical';
};

const recBadge = (r: string) => {
  switch (r) {
    case 'Keep': return <Badge tone="success">Keep</Badge>;
    case 'Consolidate': return <Badge tone="info">Consolidate</Badge>;
    case 'Replace': return <Badge tone="warning">Replace</Badge>;
    case 'Cut': return <Badge tone="critical">Cut</Badge>;
    default: return <Badge>{r}</Badge>;
  }
};

export default function ScoringDashboard() {
  const [results, setResults] = useState<ScoredApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [scored, setScored] = useState(false);

  const handleScoreAll = async () => {
    setLoading(true);
    try {
      const data = await api.scoring.scoreAll();
      setResults(data.results || []);
      setScored(true);
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  };

  const avg = (field: keyof ScoredApp['scores']) =>
    results.length > 0 ? results.reduce((s, r) => s + r.scores[field], 0) / results.length : 0;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button onClick={handleScoreAll} loading={loading} variant="primary">
          Score All Apps (Four Pillars)
        </Button>
      </div>

      {scored && results.length > 0 && (
        <>
          <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
            <Card><Text as="h3" variant="headingMd">Performance</Text><Text as="p" variant="headingXl">{avg('performance').toFixed(1)}</Text></Card>
            <Card><Text as="h3" variant="headingMd">Cost Value</Text><Text as="p" variant="headingXl">{avg('cost').toFixed(1)}</Text></Card>
            <Card><Text as="h3" variant="headingMd">Functionality</Text><Text as="p" variant="headingXl">{avg('functionality').toFixed(1)}</Text></Card>
            <Card><Text as="h3" variant="headingMd">Security/Risk</Text><Text as="p" variant="headingXl">{avg('securityRisk').toFixed(1)}</Text></Card>
          </div>

          <Card><Text as="h3" variant="headingMd">Four-Pillar App Scores (1-5)</Text>
            <DataTable
              columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric', 'text']}
              headings={['App', 'Perf', 'Cost', 'Func', 'Security', 'Overall', 'Decision']}
              rows={results.map((r) => [
                r.appName,
                <Badge tone={scoreColor(r.scores.performance)}>{r.scores.performance.toString()}</Badge>,
                <Badge tone={scoreColor(r.scores.cost)}>{r.scores.cost.toString()}</Badge>,
                <Badge tone={scoreColor(r.scores.functionality)}>{r.scores.functionality.toString()}</Badge>,
                <Badge tone={scoreColor(r.scores.securityRisk)}>{r.scores.securityRisk.toString()}</Badge>,
                r.overallScore.toFixed(2),
                recBadge(r.recommendation),
              ])}
            />
          </Card>
        </>
      )}

      {scored && results.length === 0 && (
        <Banner>No active apps found to score. Refresh your app inventory first.</Banner>
      )}
    </BlockStack>
  );
}
