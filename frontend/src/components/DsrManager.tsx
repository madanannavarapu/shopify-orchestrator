import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, DataTable, Button, TextField, Select, Banner,
  Modal, FormLayout, Text, Spinner, Badge, Tabs, BlockStack, InlineGrid
} from '@shopify/polaris';
import { api } from '../api/shopify';

interface DsrItem {
  id: string; customerId: string; email: string;
  requestType: string; status: string;
  description: string | null; notes: string | null;
  deadlineAt: string; createdAt: string;
  completedAt: string | null;
  rejectionReason: string | null;
}

interface DsrStats { total: number; overdueCount: number; byStatus: Record<string, number>; byType: Record<string, number>; }
interface DsrTemplate { id: string; name: string; requestType: string; subject: string; body: string; isActive: boolean; }

const DSR_COLS = ['Customer', 'Email', 'Type', 'Status', 'Deadline', 'Actions'];
const STATUS_OPTIONS = ['pending', 'processing', 'completed', 'rejected', 'withdrawn'];
const TYPE_OPTIONS = ['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'];

const statusBadge = (s: string) => {
  const m: Record<string, [string, 'success' | 'warning' | 'critical' | 'info']> = {
    pending: ['Pending', 'warning'],
    processing: ['Processing', 'info'],
    completed: ['Completed', 'success'],
    rejected: ['Rejected', 'critical'],
    withdrawn: ['Withdrawn', 'critical'],
  };
  const [label, tone] = m[s] || [s, 'info'];
  return <Badge tone={tone}>{label}</Badge>;
};

export default function DsrManager() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dsrs, setDsrs] = useState<DsrItem[]>([]);
  const [stats, setStats] = useState<DsrStats | null>(null);
  const [templates, setTemplates] = useState<DsrTemplate[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [createForm, setCreateForm] = useState({ customerId: '', email: '', requestType: 'access', description: '' });
  const [rejectText, setRejectText] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', requestType: 'access', subject: '', body: '' });
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  const loadDsrs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.requestType = filterType;
      const [d, s, t] = await Promise.all([
        api.dsr.list(params),
        api.dsr.getStats(),
        api.dsr.getTemplates(),
      ]);
      setDsrs(d.data || d);
      setStats(s.data || s);
      setTemplates(t.data || t);
    } catch (e: any) { setToast(e.message); }
    setLoading(false);
  }, [filterStatus, filterType]);

  useEffect(() => { loadDsrs(); }, [loadDsrs]);

  const showDetailHandler = async (id: string) => {
    try {
      const res = await api.dsr.get(id);
      setDetail(res.data || res);
      setShowDetail(id);
    } catch (e: any) { setToast(e.message); }
  };

  const handleAction = async (id: string, action: string, extra?: string) => {
    try {
      const m: Record<string, () => Promise<any>> = {
        process: () => api.dsr.process(id),
        complete: () => api.dsr.complete(id),
        reject: () => api.dsr.reject(id, extra || ''),
        withdraw: () => api.dsr.withdraw(id),
        notify: () => api.dsr.notify(id),
      };
      await m[action]();
      loadDsrs();
      if (showDetail === id) showDetailHandler(id);
    } catch (e: any) { setToast(e.message); }
  };

  const handleCreate = async () => {
    await api.dsr.create(createForm);
    setShowCreate(false);
    setCreateForm({ customerId: '', email: '', requestType: 'access', description: '' });
    loadDsrs();
  };

  const handleCreateTemplate = async () => {
    await api.dsr.createTemplate(templateForm);
    setShowTemplateForm(false);
    setTemplateForm({ name: '', requestType: 'access', subject: '', body: '' });
    loadDsrs();
  };

  const dsrRows = dsrs.map(d => [
    d.customerId, d.email, d.requestType,
    statusBadge(d.status),
    new Date(d.deadlineAt).toLocaleDateString(),
    <div style={{ display: 'flex', gap: 'var(--p-space-1)' }}>
      <Button variant="plain" onClick={() => showDetailHandler(d.id)}>View</Button>
      {d.status === 'pending' && <Button variant="plain" onClick={() => handleAction(d.id, 'process')}>Process</Button>}
    </div>,
  ]);

  const tabs = [
    { id: 'dsrs', content: `Requests (${dsrs.length})` },
    { id: 'templates', content: `Templates (${templates.length})` },
    { id: 'stats', content: 'Statistics' },
  ];

  return (
    <BlockStack gap="400">
      {toast && <Banner tone="critical" onDismiss={() => setToast('')}>{toast}</Banner>}
      <Tabs tabs={tabs} selected={tab} onSelect={setTab} />

      {tab === 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--p-space-4)' }}>
            <Text as="h3" variant="headingMd">Data Subject Requests</Text>
            <Button variant="primary" onClick={() => setShowCreate(true)}>New Request</Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--p-space-2)', marginBottom: 'var(--p-space-4)' }}>
            <Select label="Status" options={[{label: 'All', value: ''}, ...STATUS_OPTIONS.map(s => ({label: s, value: s}))]} value={filterStatus} onChange={setFilterStatus} />
            <Select label="Type" options={[{label: 'All', value: ''}, ...TYPE_OPTIONS.map(s => ({label: s, value: s}))]} value={filterType} onChange={setFilterType} />
          </div>
          {loading ? <Spinner accessibilityLabel="Loading" /> : <DataTable columnContentTypes={['text','text','text','text','text','text']} headings={DSR_COLS} rows={dsrRows} />}
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--p-space-4)' }}>
            <Text as="h3" variant="headingMd">DSR Templates</Text>
            <Button variant="primary" onClick={() => setShowTemplateForm(true)}>Add Template</Button>
          </div>
          {templates.length === 0 && <Text as="p" variant="bodySm">No templates yet.</Text>}
          {templates.map(t => (
            <Card key={t.id}>
              <Text as="h4" variant="headingSm">{t.name}</Text>
              <Text as="p" variant="bodyMd">Subject: {t.subject}</Text>
              <Text as="p" variant="bodyMd">Type: {t.requestType}</Text>
              <Badge tone={t.isActive ? 'success' : 'critical'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
            </Card>
          ))}
        </Card>
      )}

      {tab === 2 && stats && (
        <InlineGrid columns="3" gap="400">
          <Card>
            <Text as="p" variant="headingXl">{stats.total}</Text>
            <Text as="p" variant="bodySm">Total</Text>
          </Card>
          <Card>
            <Text as="p" variant="headingXl">{stats.overdueCount}</Text>
            <Text as="p" variant="bodySm">Overdue</Text>
          </Card>
          <Card>
            {Object.entries(stats.byStatus || {}).map(([k, v]) => (
              <div key={k}><Text as="span" variant="bodyMd">{k}: {v}</Text></div>
            ))}
          </Card>
        </InlineGrid>
      )}

      {/* Create DSR Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Data Subject Request">
        <Modal.Section>
          <FormLayout>
            <TextField label="Customer ID" value={createForm.customerId} onChange={v => setCreateForm({ ...createForm, customerId: v })} autoComplete="off" />
            <TextField label="Email" value={createForm.email} onChange={v => setCreateForm({ ...createForm, email: v })} autoComplete="off" />
            <Select label="Request Type" options={TYPE_OPTIONS.map(s => ({label: s, value: s}))} value={createForm.requestType} onChange={v => setCreateForm({ ...createForm, requestType: v })} />
            <TextField label="Description" value={createForm.description} onChange={v => setCreateForm({ ...createForm, description: v })} multiline={3} autoComplete="off" />
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => { setShowDetail(null); setDetail(null); setRejectText(''); }} title="DSR Details">
        <Modal.Section>
          {detail ? (
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">Customer: {detail.customerId} ({detail.email})</Text>
              <Text as="p" variant="bodyMd">Type: {detail.requestType}</Text>
              <Text as="p" variant="bodyMd">Status: {statusBadge(detail.status)}</Text>
              <Text as="p" variant="bodyMd">Deadline: {new Date(detail.deadlineAt).toLocaleString()}</Text>
              {detail.completedAt && <Text as="p" variant="bodyMd">Completed: {new Date(detail.completedAt).toLocaleString()}</Text>}
              {detail.rejectionReason && <Text as="p" variant="bodyMd">Rejection: {detail.rejectionReason}</Text>}
              <Text as="p" variant="bodyMd">{detail.description}</Text>
              <div style={{ display: 'flex', gap: 'var(--p-space-2)', flexWrap: 'wrap' }}>
                {detail.status === 'pending' && <Button onClick={() => handleAction(detail.id, 'process')}>Process</Button>}
                {detail.status === 'processing' && <Button onClick={() => handleAction(detail.id, 'complete')}>Complete</Button>}
                {(detail.status === 'pending' || detail.status === 'processing') && (
                  <Button variant="primary" tone="critical" onClick={() => handleAction(detail.id, 'reject', rejectText || 'No reason given')}>Reject</Button>
                )}
                {detail.status === 'pending' && <Button onClick={() => handleAction(detail.id, 'withdraw')}>Withdraw</Button>}
              </div>
              {detail.status !== 'rejected' && (detail.status === 'pending' || detail.status === 'processing') && (
                <TextField label="Rejection reason" value={rejectText} onChange={setRejectText} autoComplete="off" />
              )}
              {detail.timeline?.length > 0 && (
                <BlockStack gap="100">
                  <Text as="h4" variant="headingSm">Timeline</Text>
                  {detail.timeline.map((t: any) => (
                    <Text key={t.id} as="p" variant="bodySm" tone="subdued">{t.action} by {t.actor} - {new Date(t.createdAt).toLocaleString()}</Text>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          ) : <Spinner accessibilityLabel="Loading" />}
        </Modal.Section>
      </Modal>

      {/* Template Form Modal */}
      <Modal open={showTemplateForm} onClose={() => setShowTemplateForm(false)} title="Add DSR Template">
        <Modal.Section>
          <FormLayout>
            <TextField label="Name" value={templateForm.name} onChange={v => setTemplateForm({ ...templateForm, name: v })} autoComplete="off" />
            <Select label="Request Type" options={TYPE_OPTIONS.map(s => ({label: s, value: s}))} value={templateForm.requestType} onChange={v => setTemplateForm({ ...templateForm, requestType: v })} />
            <TextField label="Subject" value={templateForm.subject} onChange={v => setTemplateForm({ ...templateForm, subject: v })} autoComplete="off" />
            <TextField label="Body" value={templateForm.body} onChange={v => setTemplateForm({ ...templateForm, body: v })} multiline={4} autoComplete="off" />
            <Button variant="primary" onClick={handleCreateTemplate}>Save</Button>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
