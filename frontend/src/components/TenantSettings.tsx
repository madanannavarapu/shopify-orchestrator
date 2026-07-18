import React, { useEffect, useState } from 'react';
import {
  Card,
  Text,
  DataTable,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Spinner,
  Modal,
  TextField,
  Select,
  Banner,
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function TenantSettings() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [policyModal, setPolicyModal] = useState(false);
  const [policyType, setPolicyType] = useState('data_retention');
  const [policyName, setPolicyName] = useState('');
  const [policyValue, setPolicyValue] = useState('');

  const loadData = async () => {
    try { setData(await api.tenant.policies()); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleAddPolicy = async () => {
    if (!policyName || !policyValue) return;
    try {
      await api.tenant.setPolicy({ policyType, name: policyName, value: policyValue });
      setPolicyModal(false);
      setPolicyName('');
      setPolicyValue('');
      loadData();
    } catch (e) { console.error(e); }
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <Banner title="Multi-Tenant Architecture">
        Tenant-specific isolation with shop-level data boundary. Each store's data is strictly isolated with tenant-specific policies and configurations.
      </Banner>

      {data?.report && (
        <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
          <Card><Text as="h3" variant="headingMd">Tenant Tier</Text><Text as="p" variant="headingXl">{data.report.tenantTier}</Text></Card>
          <Card><Text as="h3" variant="headingMd">Tenant ID</Text><Text as="p" variant="bodyMd">{data.report.shop}</Text></Card>
          <Card><Text as="h3" variant="headingMd">API Version</Text><Text as="p" variant="headingXl">{data.report.apiVersion}</Text></Card>
        </div>
      )}

      <Card><Text as="h3" variant="headingMd">Data Isolation</Text>
        {data?.report && (
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">Isolation Status: <Badge tone="success">{data.report.isolationStatus}</Badge></Text>
            <Text as="p" variant="bodyMd">Data Boundary: {data.report.dataBoundary}</Text>
            <Text as="p" variant="bodyMd">Apps: {data.report.appsCount} &middot; Incidents: {data.report.incidentsCount} &middot; Active Policies: {data.report.activePolicies}</Text>
          </BlockStack>
        )}
      </Card>

      <Card><Text as="h3" variant="headingMd">Tenant Policies</Text>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"var(--p-space-200)"}}>
          <Button variant="primary" onClick={() => setPolicyModal(true)}>Add Policy</Button>
        </div>
        {data?.policies && data.policies.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text']}
            headings={['Type', 'Name', 'Value']}
            rows={data.policies.map((p: any) => [<Badge>{p.type}</Badge>, p.name, p.value])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No tenant-specific policies configured.</Text>
        )}
      </Card>

      <Modal open={policyModal} onClose={() => setPolicyModal(false)} title="Add Tenant Policy">
        <Modal.Section>
          <BlockStack gap="300">
            <Select label="Policy Type" value={policyType} onChange={setPolicyType}
              options={[
                { label: 'Data Retention', value: 'data_retention' },
                { label: 'Access Control', value: 'access_control' },
                { label: 'Review Cadence', value: 'review_cadence' },
                { label: 'Notification', value: 'notification' },
              ]}
            />
            <TextField label="Policy Name" value={policyName} onChange={setPolicyName} autoComplete="off" />
            <TextField label="Policy Value" value={policyValue} onChange={setPolicyValue} multiline={3} autoComplete="off" />
            <Button variant="primary" onClick={handleAddPolicy}>Add Policy</Button>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
