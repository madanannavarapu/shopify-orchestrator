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
  Tabs,
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { EvidenceItem, AuditReport } from '../types';

export default function ComplianceAudit() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);

  const loadData = async () => {
    try {
      const [r, e] = await Promise.all([
        api.evidence.auditReport(),
        api.evidence.list({ limit: 200 }),
      ]);
      setReport(r);
      setEvidence(e.items || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <Spinner accessibilityLabel="Loading audit trail" />;

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'log', content: 'Event Log' },
  ];

  return (
    <BlockStack gap="400">
      <Card>
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
      </Card>

      {selectedTab === 0 && report && (
        <BlockStack gap="400">
          <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
            <Card><Text as="h3" variant="headingMd">Total Events</Text><Text as="p" variant="headingXl">{report.summary.totalEvents}</Text></Card>
            <Card>
              <Text as="h3" variant="headingMd">Date Range</Text>
              <Text as="p" variant="bodyMd">
                {report.summary.dateRange
                  ? `${new Date(report.summary.dateRange.from).toLocaleDateString()} - ${new Date(report.summary.dateRange.to).toLocaleDateString()}`
                  : 'No data'}
              </Text>
            </Card>
            <Card>
              <Text as="h3" variant="headingMd">Event Types</Text>
              {Object.entries(report.summary.byType).map(([type, count]) => (
                <Text key={type} as="p" variant="bodySm">{type}: {count}</Text>
              ))}
            </Card>
          </div>

          <Banner title="Compliance Evidence Store">
            All events are immutable and stored for audit readiness (SOX, SOC 2). This log preserves every scan, finding, approval, and remediation action.
          </Banner>
        </BlockStack>
      )}

      {selectedTab === 1 && (
        <Card><Text as="h3" variant="headingMd">Immutable Event Log</Text>
          {evidence.length > 0 ? (
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text']}
              headings={['Date', 'Type', 'Action', 'Actor', 'Details']}
              rows={evidence.map((e) => [
                new Date(e.createdAt).toLocaleString(),
                <Badge>{e.eventType}</Badge>,
                e.action,
                e.actor || 'system',
                e.details.substring(0, 80) + (e.details.length > 80 ? '...' : ''),
              ])}
            />
          ) : (
            <Text as="p" variant="bodyMd">No events recorded yet. Events are created as you use the platform.</Text>
          )}
        </Card>
      )}
    </BlockStack>
  );
}
