import React from 'react';
import { Card, DataTable, Badge, Text, Spinner } from '@shopify/polaris';

type Status = 'healthy' | 'warning' | 'stale' | 'error';

interface Platform {
  id: string;
  platform: string;
  connected: boolean;
  status: Status;
  message: string;
  last_event_at: string | null;
}

const STATUS_BADGE: Record<Status, { tone: 'success' | 'warning' | 'critical' }> = {
  healthy: { tone: 'success' },
  warning: { tone: 'warning' },
  stale:   { tone: 'critical' },
  error:   { tone: 'critical' },
};

export default function PlatformStatusCard({ platforms, loading }: { platforms: Platform[]; loading?: boolean }) {
  if (loading) {
    return (
      <Card>
        <Text as="h3" variant="headingMd">Platform Status</Text>
        <Spinner size="small" />
      </Card>
    );
  }

  const rows = platforms.map((p) => [
    p.platform,
    <Badge tone={STATUS_BADGE[p.status]?.tone || 'critical'}>{p.status}</Badge>,
    p.message,
    p.connected ? 'Yes' : 'No',
  ]);

  return (
    <Card>
      <DataTable
        headings={['Platform', 'Status', 'Message', 'Connected']}
        rows={rows}
        sortable={[false, false, false, false]}
        hoverable
      />
    </Card>
  );
}
