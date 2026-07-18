import React, { useEffect, useState } from 'react';
import {
  Card,
  Text,
  DataTable,
  Badge,
  BlockStack,
  InlineStack,
  Spinner,
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function AgentOpsDashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.agentOps.summary(), api.agentOps.history({ limit: 50 })])
      .then(([s, h]) => { setSummary(s); setHistory(h.history || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card><Text as="h3" variant="headingMd">Total Executions</Text><Text as="p" variant="headingXl">{summary?.totalExecutions || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Completed</Text><Text as="p" variant="headingXl" tone="success">{summary?.completed || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Failed</Text><Text as="p" variant="headingXl" tone="critical">{summary?.failed || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Total Cost</Text><Text as="p" variant="headingXl">${summary?.totalCostUsd?.toFixed(4) || '0'}</Text></Card>
      </div>

      <Card><Text as="h3" variant="headingMd">Agent Performance by Type</Text>
        {summary?.byAgent ? (
          <DataTable
            columnContentTypes={['text', 'numeric', 'numeric', 'numeric']}
            headings={['Agent Type', 'Executions', 'Failed', 'Avg Latency (ms)']}
            rows={Object.entries(summary.byAgent).map(([type, data]: any) => [
              <Badge>{type}</Badge>,
              data.count.toString(),
              <Badge tone={data.failed > 0 ? 'critical' : 'success'}>{data.failed}</Badge>,
              `${data.avgLatency}ms`,
            ])}
          />
        ) : <Text as="p" variant="bodyMd">No agent executions yet.</Text>}
      </Card>

      <Card><Text as="h3" variant="headingMd">Recent Agent Executions</Text>
        {history.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
            headings={['Type', 'Status', 'Latency', 'Cost', 'Error', 'Started']}
            rows={history.map((e: any) => [
              <Badge>{e.agentType}</Badge>,
              <Badge tone={e.status === 'completed' ? 'success' : e.status === 'failed' ? 'critical' : 'info'}>{e.status}</Badge>,
              e.latencyMs ? `${e.latencyMs}ms` : '-',
              e.costUsd ? `$${e.costUsd.toFixed(4)}` : '-',
              e.error || '-',
              new Date(e.startedAt).toLocaleString(),
            ])}
          />
        ) : <Text as="p" variant="bodyMd">No execution history.</Text>}
      </Card>
    </BlockStack>
  );
}
