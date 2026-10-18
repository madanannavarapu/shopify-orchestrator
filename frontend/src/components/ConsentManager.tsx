import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, DataTable, Button, TextField, Select, Banner,
  Modal, FormLayout, Text, Spinner, Badge, Tabs, BlockStack, InlineGrid
} from '@shopify/polaris';
import { api } from '../api/shopify';

interface Purpose {
  id: string; name: string; label: string; description: string | null;
  isRequired: boolean; sortOrder: number; isActive: boolean;
}

interface ConsentRecord {
  id: string; customerId: string; email: string;
  purpose: { name: string; label: string };
  granted: boolean; source: string; consentedAt: string;
}

interface ConsentStats { total: number; granted: number; declined: number; byPurpose: { name: string; granted: number; declined: number }[]; }

const PURPOSE_COLS = ['Name', 'Label', 'Required', 'Active', 'Actions'];
const RECORD_COLS = ['Customer', 'Email', 'Purpose', 'Granted', 'Source', 'Date'];

export default function ConsentManager() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', label: '', description: '', isRequired: false });
  const [searchEmail, setSearchEmail] = useState('');
  const [toast, setToast] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r, s] = await Promise.all([
        api.consent.getPurposes(),
        api.consent.getRecords(),
        api.consent.getConsentStats(),
      ]);
      setPurposes(p.data || p);
      setRecords(r.data || r);
      setStats(s.data || s);
    } catch (e: any) { setToast(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreatePurpose = async () => {
    await api.consent.createPurpose(form);
    setShowModal(false);
    setForm({ name: '', label: '', description: '', isRequired: false });
    loadData();
  };

  const handleSeed = async () => {
    await api.consent.seedPurposes();
    loadData();
  };

  const purposeRows = purposes.map(p => [
    p.name, p.label,
    p.isRequired ? <Badge tone="info">Required</Badge> : <Badge>Optional</Badge>,
    p.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
    <Button variant="plain" onClick={() => api.consent.updatePurpose(p.id, { isActive: !p.isActive }).then(loadData)}>Toggle</Button>,
  ]);

  const recordRows = records
    .filter(r => !searchEmail || r.email.includes(searchEmail))
    .map(r => [
      r.customerId, r.email, r.purpose.label,
      r.granted ? <Badge tone="success">Granted</Badge> : <Badge>Declined</Badge>,
      r.source, new Date(r.consentedAt).toLocaleDateString(),
    ]);

  const tabs = [
    { id: 'purposes', content: `Purposes (${purposes.length})` },
    { id: 'records', content: `Records (${records.length})` },
    { id: 'stats', content: 'Statistics' },
  ];

  return (
    <BlockStack gap="400">
      {toast && <Banner tone="critical" onDismiss={() => setToast('')}>{toast}</Banner>}
      <Tabs tabs={tabs} selected={tab} onSelect={setTab} />

      {tab === 0 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--p-space-4)' }}>
            <Text as="h3" variant="headingMd">Consent Purposes</Text>
            <div style={{ display: 'flex', gap: 'var(--p-space-2)' }}>
              <Button onClick={handleSeed}>Seed Defaults</Button>
              <Button variant="primary" onClick={() => setShowModal(true)}>Add Purpose</Button>
            </div>
          </div>
          {loading ? <Spinner accessibilityLabel="Loading" /> : <DataTable columnContentTypes={['text','text','text','text','text']} headings={PURPOSE_COLS} rows={purposeRows} />}
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <div style={{ marginBottom: 'var(--p-space-4)' }}>
            <TextField label="Search by email" value={searchEmail} onChange={setSearchEmail} autoComplete="off" />
          </div>
          {loading ? <Spinner accessibilityLabel="Loading" /> : <DataTable columnContentTypes={['text','text','text','text','text','text']} headings={RECORD_COLS} rows={recordRows} />}
        </Card>
      )}

      {tab === 2 && stats && (
        <InlineGrid columns="3" gap="400">
          <Card>
            <Text as="p" variant="headingXl">{stats.total}</Text>
            <Text as="p" variant="bodySm">Total</Text>
          </Card>
          <Card>
            <Text as="p" variant="headingXl">{stats.granted}</Text>
            <Text as="p" variant="bodySm">Granted</Text>
          </Card>
          <Card>
            <Text as="p" variant="headingXl">{stats.declined}</Text>
            <Text as="p" variant="bodySm">Declined</Text>
          </Card>
        </InlineGrid>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Consent Purpose">
        <Modal.Section>
          <FormLayout>
            <TextField label="Name (slug)" value={form.name} onChange={v => setForm({ ...form, name: v })} autoComplete="off" />
            <TextField label="Label" value={form.label} onChange={v => setForm({ ...form, label: v })} autoComplete="off" />
            <TextField label="Description" value={form.description} onChange={v => setForm({ ...form, description: v })} multiline={3} autoComplete="off" />
            <Button variant="primary" onClick={handleCreatePurpose}>Save</Button>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
