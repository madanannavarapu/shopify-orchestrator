import React, { useEffect, useState } from 'react';
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
import type { DataConflict } from '../types';

export default function DataConflicts() {
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConflicts = async () => {
    try {
      const data = await api.conflicts.list();
      setConflicts(data.conflicts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadConflicts(); }, []);

  const handleDetect = async () => {
    setLoading(true);
    try {
      await api.conflicts.detect();
      await loadConflicts();
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleResolve = async (id: string) => {
    try {
      await api.conflicts.resolve(id);
      loadConflicts();
    } catch (e) { console.error(e); }
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  const openConflicts = conflicts.filter((c) => c.status === 'open');

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button variant="primary" onClick={handleDetect}>Detect Conflicts</Button>
      </div>

      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card><Text as="h3" variant="headingMd">Total Conflicts</Text><Text as="p" variant="headingXl">{conflicts.length}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Open</Text><Text as="p" variant="headingXl" tone="critical">{openConflicts.length}</Text></Card>
        <Card>
          <Text as="h3" variant="headingMd">By Type</Text>
          {['reporting', 'inventory', 'pricing', 'notifications', 'customer_data'].map((t) => {
            const count = conflicts.filter((c) => c.conflictType === t).length;
            if (count === 0) return null;
            return <Text key={t} as="p" variant="bodySm">{t}: {count}</Text>;
          })}
        </Card>
      </div>

      <Card><Text as="h3" variant="headingMd">Data Reconciliation Conflicts</Text>
        {conflicts.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text']}
            headings={['App A', 'App B', 'Type', 'Severity', 'Status', 'Description', '']}
            rows={conflicts.map((c) => [
              c.appOne?.name || c.appIdOne,
              c.appTwo?.name || c.appIdTwo,
              <Badge>{c.conflictType}</Badge>,
              <Badge tone={c.severity === 'high' ? 'critical' : c.severity === 'medium' ? 'warning' : 'info'}>{c.severity}</Badge>,
              <Badge tone={c.status === 'open' ? 'critical' : 'success'}>{c.status}</Badge>,
              c.description.substring(0, 60) + '...',
              c.status === 'open' ? <Button variant="plain" onClick={() => handleResolve(c.id)}>Resolve</Button> : null,
            ])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No conflicts detected. Click "Detect Conflicts" to scan for apps with overlapping write permissions.</Text>
        )}
      </Card>
    </BlockStack>
  );
}
