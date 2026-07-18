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
  Modal,
  TextField,
  Select,
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { FeedbackSummary } from '../types';

export default function StakeholderFeedback() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [submittedBy, setSubmittedBy] = useState('');
  const [role, setRole] = useState('');
  const [response, setResponse] = useState('');
  const [feedbackAppId, setFeedbackAppId] = useState('');
  const [severity, setSeverity] = useState('info');
  const [allApps, setAllApps] = useState<{ id: string; name: string }[]>([]);

  const loadData = async () => {
    try {
      const [s, graph] = await Promise.all([
        api.feedback.summary(),
        api.apps.getGraph(),
      ]);
      setSummary(s);
      setAllApps((graph.apps || []).map((a: any) => ({ id: a.id, name: a.name })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!submittedBy || !response) return;
    try {
      await api.feedback.submit({
        appId: feedbackAppId || undefined,
        submittedBy,
        role: role || undefined,
        response,
        severity,
      });
      setModalActive(false);
      setResponse('');
      setSubmittedBy('');
      loadData();
    } catch (e) { console.error(e); }
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button variant="primary" onClick={() => setModalActive(true)}>Submit Feedback</Button>
      </div>

      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card><Text as="h3" variant="headingMd">Total Responses</Text><Text as="p" variant="headingXl">{summary?.total || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Critical ("What breaks?")</Text><Text as="p" variant="headingXl" tone="critical">{summary?.critical || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Warnings</Text><Text as="p" variant="headingXl" tone="caution">{summary?.warnings || 0}</Text></Card>
      </div>

      {summary && summary.overrides.length > 0 && (
        <Banner tone="warning" title="Stakeholder Overrides — Data may be overridden">
          {summary.overrides.length} critical feedback item(s) that may override automated recommendations.
        </Banner>
      )}

      <Card><Text as="h3" variant="headingMd">Feedback by App</Text>
        {summary?.byApp && Object.keys(summary.byApp).length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'numeric', 'numeric']}
            headings={['App', 'Total Feedback', 'Critical']}
            rows={Object.entries(summary.byApp).map(([app, data]) => [
              app,
              data.count.toString(),
              <Badge tone={data.critical > 0 ? 'critical' : 'success'}>{data.critical.toString()}</Badge>,
            ])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No feedback collected yet. Ask your team: "What breaks?"</Text>
        )}
      </Card>

      <Card><Text as="h3" variant="headingMd">Recent Feedback</Text>
        {summary && summary.recent.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text']}
            headings={['App', 'Submitted By', 'Role', 'Response', 'Severity']}
            rows={summary.recent.map((f) => [
              f.app?.name || 'General',
              f.submittedBy,
              f.role || '-',
              f.response.substring(0, 60) + (f.response.length > 60 ? '...' : ''),
              <Badge tone={f.severity === 'critical' ? 'critical' : f.severity === 'warning' ? 'warning' : 'info'}>{f.severity}</Badge>,
            ])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No feedback yet.</Text>
        )}
      </Card>

      <Modal open={modalActive} onClose={() => setModalActive(false)} title="What breaks?">
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">The key question is "What breaks?" rather than "What do people like?" — listen for conflict, not consensus.</Text>
            <TextField label="Your Name" value={submittedBy} onChange={setSubmittedBy} autoComplete="off" />
            <TextField label="Role" value={role} onChange={setRole} autoComplete="off" />
            <Select label="Related App (optional)" value={feedbackAppId} onChange={setFeedbackAppId}
              options={[{ label: 'General (no specific app)', value: '' }, ...allApps.map((a) => ({ label: a.name, value: a.id }))]}
            />
            <TextField label="What breaks? What's the issue?" value={response} onChange={setResponse} multiline={4} autoComplete="off" />
            <Select label="Severity" value={severity} onChange={setSeverity}
              options={[
                { label: 'Info', value: 'info' },
                { label: 'Warning', value: 'warning' },
                { label: 'Critical — Things break', value: 'critical' },
              ]}
            />
            <Button variant="primary" onClick={handleSubmit}>Submit Feedback</Button>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
