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

export default function IncidentResponse() {
  const [openIncidents, setOpenIncidents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [escalateTo, setEscalateTo] = useState('');
  const [escalateReason, setEscalateReason] = useState('');

  const loadData = async () => {
    try {
      const data = await api.incidents.list();
      setOpenIncidents(data.open || []);
      setSummary(data.summary);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDetect = async () => {
    setLoading(true);
    try { await api.incidents.detect(); await loadData(); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident || !newStatus) return;
    try {
      await api.incidents.updateStatus(selectedIncident.id, newStatus, resolution);
      setModalActive(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleEscalate = async () => {
    if (!selectedIncident || !escalateTo || !escalateReason) return;
    try {
      await api.incidents.escalate(selectedIncident.id, escalateTo, escalateReason);
      setModalActive(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const openAction = (inc: any) => {
    setSelectedIncident(inc);
    setNewStatus('');
    setResolution('');
    setEscalateTo('');
    setEscalateReason('');
    setModalActive(true);
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button onClick={handleDetect}>Scan for Abnormal Access</Button>
      </div>

      {summary && (
        <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
          <Card><Text as="h3" variant="headingMd">Open</Text><Text as="p" variant="headingXl" tone="critical">{summary.open}</Text></Card>
          <Card><Text as="h3" variant="headingMd">Critical</Text><Text as="p" variant="headingXl" tone="critical">{summary.bySeverity?.critical || 0}</Text></Card>
          <Card><Text as="h3" variant="headingMd">High</Text><Text as="p" variant="headingXl" tone="caution">{summary.bySeverity?.high || 0}</Text></Card>
          <Card><Text as="h3" variant="headingMd">Resolved</Text><Text as="p" variant="headingXl" tone="success">{summary.resolved || 0}</Text></Card>
        </div>
      )}

      <Card><Text as="h3" variant="headingMd">Open Incidents</Text>
        {openIncidents.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
            headings={['Title', 'Type', 'Severity', 'Status', 'Source', '']}
            rows={openIncidents.map((inc) => [
              inc.title,
              <Badge>{inc.incidentType}</Badge>,
              <Badge tone={inc.severity === 'critical' ? 'critical' : inc.severity === 'high' ? 'warning' : 'info'}>{inc.severity}</Badge>,
              <Badge>{inc.status}</Badge>,
              inc.source || '-',
              <Button variant="plain" onClick={() => openAction(inc)}>Manage</Button>,
            ])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No open incidents. Run a scan to check for abnormal access patterns.</Text>
        )}
      </Card>

      <Modal open={modalActive} onClose={() => setModalActive(false)} title={`Incident: ${selectedIncident?.title}`}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">{selectedIncident?.description}</Text>
            <Select label="Update Status" value={newStatus} onChange={setNewStatus}
              options={[
                { label: 'Select...', value: '' },
                { label: 'Investigating', value: 'investigating' },
                { label: 'Contained', value: 'contained' },
                { label: 'Resolved', value: 'resolved' },
              ]}
            />
            <TextField label="Resolution Notes" value={resolution} onChange={setResolution} multiline={3} autoComplete="off" />
            <Button variant="primary" onClick={handleUpdateStatus}>Update Status</Button>
            <Text as="p" variant="headingSm">Escalate</Text>
<TextField label="Escalate To" value={escalateTo} onChange={setEscalateTo} autoComplete="off" />
<TextField label="Reason" value={escalateReason} onChange={setEscalateReason} multiline={2} autoComplete="off" />
            <Button onClick={handleEscalate}>Escalate</Button>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
