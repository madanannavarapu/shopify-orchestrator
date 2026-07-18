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
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function VendorNegotiations() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalActive, setModalActive] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [currentCost, setCurrentCost] = useState('');
  const [targetSavings, setTargetSavings] = useState('');
  const [templateType, setTemplateType] = useState('reduction');
  const [draftResult, setDraftResult] = useState<any>(null);

  const loadData = async () => {
    try { setData(await api.negotiations.list()); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleDraft = async () => {
    if (!vendorName || !currentCost) return;
    try {
      const result = await api.negotiations.draft({
        vendorName,
        currentCost: parseFloat(currentCost),
        targetSavings: targetSavings ? parseFloat(targetSavings) : undefined,
        templateType,
      });
      setDraftResult(result);
    } catch (e) { console.error(e); }
  };

  const handleSend = async (id: string) => {
    try {
      await api.negotiations.updateStatus(id, 'sent');
      loadData();
    } catch (e) { console.error(e); }
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button variant="primary" onClick={() => { setModalActive(true); setDraftResult(null); }}>Draft Negotiation</Button>
      </div>

      {data && (
        <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
          <Card><Text as="h3" variant="headingMd">Total Drafts</Text><Text as="p" variant="headingXl">{data.total}</Text></Card>
          <Card><Text as="h3" variant="headingMd">Accepted Savings</Text><Text as="p" variant="headingXl" tone="success">${data.totalSavings?.toFixed(2) || '0'}/mo</Text></Card>
          <Card><Text as="h3" variant="headingMd">Pending</Text><Text as="p" variant="headingXl" tone="caution">{data.pending?.length || 0}</Text></Card>
        </div>
      )}

      <Card><Text as="h3" variant="headingMd">Vendor Negotiations</Text>
        {data?.negotiations && data.negotiations.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
            headings={['Vendor', 'Current', 'Proposed', 'Savings', 'Status', '']}
            rows={data.negotiations.map((n: any) => [
              n.vendorName,
              `$${n.currentCost?.toFixed(2) || '?'}`,
              `$${n.proposedCost?.toFixed(2) || '?'}`,
              n.savings ? <Text as="p" tone="success">${n.savings.toFixed(2)}</Text> : '-',
              <Badge tone={n.status === 'accepted' ? 'success' : n.status === 'sent' ? 'info' : 'warning'}>{n.status}</Badge>,
              n.status === 'draft' ? <Button variant="plain" onClick={() => handleSend(n.id)}>Mark Sent</Button> : null,
            ])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No negotiations yet. Draft messages to negotiate better rates with app vendors.</Text>
        )}
      </Card>

      <Modal open={modalActive} onClose={() => setModalActive(false)} title="Draft Vendor Negotiation">
        <Modal.Section>
          <BlockStack gap="300">
            <TextField label="Vendor Name" value={vendorName} onChange={setVendorName} autoComplete="off" />
            <TextField label="Current Monthly Cost ($)" value={currentCost} onChange={setCurrentCost} type="number" autoComplete="off" />
            <TextField label="Target Savings ($, optional)" value={targetSavings} onChange={setTargetSavings} type="number" autoComplete="off" />
            <Select label="Template Type" value={templateType} onChange={setTemplateType}
              options={[
                { label: 'Price Reduction', value: 'reduction' },
                { label: 'Annual Billing', value: 'annual' },
              ]}
            />
            <Button variant="primary" onClick={handleDraft}>Generate Draft</Button>
            {draftResult && (
              <Card>
                <Text as="p" variant="headingSm">Draft Message</Text>
                <div style={{ whiteSpace: 'pre-wrap' }}>{draftResult.draftText}</div>
                <Text as="p" variant="bodySm" tone="success">Savings: ${draftResult.savings?.toFixed(2)}/mo</Text>
              </Card>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
