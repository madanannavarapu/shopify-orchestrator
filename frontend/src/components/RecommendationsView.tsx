import React, { useState } from 'react';
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
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { Recommendation } from '../types';

const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

const priorityBadge = (p: string) => {
  switch (p) {
    case 'critical': return <Badge tone="critical">Critical</Badge>;
    case 'high': return <Badge tone="warning">High</Badge>;
    case 'medium': return <Badge tone="info">Medium</Badge>;
    default: return <Badge>Low</Badge>;
  }
};

const decisionBadge = (d: string) => {
  switch (d) {
    case 'Keep': return <Badge tone="success">Keep</Badge>;
    case 'Consolidate': return <Badge tone="info">Consolidate</Badge>;
    case 'Replace': return <Badge tone="warning">Replace</Badge>;
    case 'Cut': return <Badge tone="critical">Cut</Badge>;
    default: return <Badge>{d}</Badge>;
  }
};

export default function RecommendationsView() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [modalActive, setModalActive] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await api.recommendations.generate();
      setRecs((data.recommendations || []).sort((a: Recommendation, b: Recommendation) =>
        (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
      ));
      setGenerated(true);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.remediation.approveAction(id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleView = (rec: Recommendation) => {
    setSelectedRec(rec);
    setModalActive(true);
  };

  const cuts = recs.filter((r) => r.decision === 'Cut');
  const totalSavings = recs.reduce((s, r) => s + (r.decision === 'Cut' || r.decision === 'Replace' ? r.savings : 0), 0);

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button onClick={handleGenerate} loading={loading} variant="primary">
          Generate Recommendations
        </Button>
      </div>

      {generated && (
        <>
          <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
            <Card>
              <Text as="h3" variant="headingMd">Keep</Text>
              <Text as="p" variant="headingXl">{recs.filter((r) => r.decision === 'Keep').length}</Text>
            </Card>
            <Card>
              <Text as="h3" variant="headingMd">Cut / Replace</Text>
              <Text as="p" variant="headingXl">{cuts.length + recs.filter((r) => r.decision === 'Replace').length}</Text>
            </Card>
            <Card>
              <Text as="h3" variant="headingMd">Potential Savings</Text>
              <Text as="p" variant="headingXl" tone="success">${totalSavings.toFixed(2)}/mo</Text>
            </Card>
          </div>

          <Card><Text as="h3" variant="headingMd">Keep/Consolidate/Replace/Cut Recommendations</Text>
            {recs.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                headings={['App', 'Decision', 'Priority', 'Savings/mo', 'Rationale', '']}
                rows={recs.map((r) => [
                  r.appName,
                  decisionBadge(r.decision),
                  priorityBadge(r.priority),
                  r.savings > 0 ? `$${r.savings.toFixed(2)}` : '-',
                  r.rationale.substring(0, 80) + '...',
                  <Button variant="plain" onClick={() => handleView(r)}>Details</Button>,
                ])}
              />
            ) : (
              <Text as="p" variant="bodyMd">No recommendations generated yet.</Text>
            )}
          </Card>
        </>
      )}

      <Modal open={modalActive} onClose={() => setModalActive(false)} title={`${selectedRec?.decision}: ${selectedRec?.appName}`}>
        {selectedRec && (
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="headingSm">Decision: {selectedRec.decision}</Text>
              <Text as="p" variant="headingSm">Priority: {selectedRec.priority}</Text>
              <Text as="p" variant="headingSm">Savings: ${selectedRec.savings.toFixed(2)}/mo</Text>
              <Text as="p" variant="bodyMd">{selectedRec.rationale}</Text>
              {selectedRec.dependsOn && selectedRec.dependsOn.length > 0 && (
                <Text as="p" variant="bodySm" tone="caution">Depends on resolving: {selectedRec.dependsOn.join(', ')}</Text>
              )}
            </BlockStack>
          </Modal.Section>
        )}
      </Modal>
    </BlockStack>
  );
}
