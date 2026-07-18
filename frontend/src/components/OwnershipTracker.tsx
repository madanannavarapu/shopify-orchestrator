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
import type { App } from '../types';

export default function OwnershipTracker() {
  const [allApps, setAllApps] = useState<App[]>([]);
  const [orphaned, setOrphaned] = useState<App[]>([]);
  const [needingReview, setNeedingReview] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [cadence, setCadence] = useState('quarterly');

  const loadData = async () => {
    try {
      const [graph, orphanedData, reviewData] = await Promise.all([
        api.apps.getGraph(),
        api.ownership.orphaned(),
        api.ownership.needsReview(),
      ]);
      setAllApps(graph.apps || []);
      setOrphaned(orphanedData.apps || []);
      setNeedingReview(reviewData.apps || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSetOwnership = async () => {
    if (!selectedApp || !ownerName || !purpose) return;
    try {
      await api.ownership.set({
        appId: selectedApp.id,
        ownerName,
        ownerEmail: ownerEmail || undefined,
        purpose,
        reviewCadence: cadence,
      });
      setModalActive(false);
      setOwnerName('');
      setOwnerEmail('');
      setPurpose('');
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReview = async (appId: string) => {
    try {
      await api.ownership.completeReview(appId);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const openAssign = (app: App) => {
    setSelectedApp(app);
    setOwnerName(app.ownerName || '');
    setOwnerEmail(app.ownerEmail || '');
    setPurpose(app.ownerPurpose || '');
    setCadence(app.reviewCadence || 'quarterly');
    setModalActive(true);
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card>
          <Text as="h3" variant="headingMd">Total Apps</Text>
          <Text as="p" variant="headingXl">{allApps.length}</Text>
        </Card>
        <Card>
          <Text as="h3" variant="headingMd">Orphaned (No Owner)</Text>
          <Text as="p" variant="headingXl" tone="critical">{orphaned.length}</Text>
        </Card>
        <Card>
          <Text as="h3" variant="headingMd">Needs Review</Text>
          <Text as="p" variant="headingXl" tone="caution">{needingReview.length}</Text>
        </Card>
      </div>

      {orphaned.length > 0 && (
        <Card><Text as="h3" variant="headingMd">Orphaned Apps — Assign an Owner</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text']}
            headings={['App', 'Category', 'Cost/mo', '']}
            rows={orphaned.map((a) => [
              a.name,
              a.category || '-',
              a.monthlyCost ? `$${a.monthlyCost.toFixed(2)}` : 'Free',
              <Button variant="primary" size="slim" onClick={() => openAssign(a)}>Assign Owner</Button>,
            ])}
          />
        </Card>
      )}

      {needingReview.length > 0 && (
        <Card><Text as="h3" variant="headingMd">Apps Needing Review</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text']}
            headings={['App', 'Owner', 'Purpose', 'Last Reviewed', '']}
            rows={needingReview.map((a) => [
              a.name,
              a.ownerName || '-',
              a.ownerPurpose || '-',
              a.lastReviewedAt ? new Date(a.lastReviewedAt).toLocaleDateString() : 'Never',
              <Button variant="primary" size="slim" onClick={() => handleReview(a.id)}>Mark Reviewed</Button>,
            ])}
          />
        </Card>
      )}

      <Card><Text as="h3" variant="headingMd">All Apps & Ownership</Text>
        <DataTable
          columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
          headings={['App', 'Owner', 'Purpose', 'Review Cadence', 'Next Review', '']}
          rows={allApps.map((a) => [
            a.name,
            a.ownerName || <Badge tone="critical">Unassigned</Badge>,
            a.ownerPurpose || '-',
            a.reviewCadence || '-',
            a.nextReviewAt ? new Date(a.nextReviewAt).toLocaleDateString() : '-',
            a.ownerName
              ? <Button variant="plain" onClick={() => openAssign(a)}>Edit</Button>
              : <Button variant="plain" onClick={() => openAssign(a)}>Assign</Button>,
          ])}
        />
      </Card>

      <Modal open={modalActive} onClose={() => setModalActive(false)} title={`Assign Owner: ${selectedApp?.name}`}>
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Owner Name" value={ownerName} onChange={setOwnerName} autoComplete="off" />
            <TextField label="Owner Email" value={ownerEmail} onChange={setOwnerEmail} type="email" autoComplete="email" />
            <TextField label="Purpose — why is this app installed?" value={purpose} onChange={setPurpose} multiline={3} autoComplete="off" />
            <Select label="Review Cadence" value={cadence} onChange={setCadence}
              options={[
                { label: 'Monthly', value: 'monthly' },
                { label: 'Quarterly', value: 'quarterly' },
                { label: 'Bi-Annual', value: 'bi-annual' },
                { label: 'Annual', value: 'annual' },
              ]}
            />
            <Button variant="primary" onClick={handleSetOwnership}>Save</Button>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
