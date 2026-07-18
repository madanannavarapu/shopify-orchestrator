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
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function ChainAuditRunner() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const data = await api.chain.runAudit();
      setResult(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Button onClick={handleRunAudit} loading={loading} variant="primary">
          Run Full Audit Chain
        </Button>
      </div>

      {loading && <Spinner accessibilityLabel="Running audit chain..." />}

      {result && (
        <>
          <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
            <Card><Text as="h3" variant="headingMd">Steps Executed</Text><Text as="p" variant="headingXl">{(result.steps || []).length}</Text></Card>
            <Card><Text as="h3" variant="headingMd">Errors</Text><Text as="p" variant="headingXl" tone={result.errors?.length > 0 ? 'critical' : 'success'}>{(result.errors || []).length}</Text></Card>
          </div>

          <Card><Text as="h3" variant="headingMd">Chain Steps Executed</Text>
            <DataTable
              columnContentTypes={['text', 'text']}
              headings={['Step', 'Status']}
              rows={(result.steps || []).map((step: string) => [
                <Badge>{step}</Badge>,
                result.errors?.some((e: string) => e.startsWith(step))
                  ? <Badge tone="critical">Failed</Badge>
                  : <Badge tone="success">Completed</Badge>,
              ])}
            />
          </Card>

          {result.data && Object.entries(result.data).map(([agentType, data]: any) => (
            <Card key={agentType}>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">{agentType} Output</Text>
                {data?.totalApps !== undefined && <Text as="p" variant="bodyMd">Total Apps: {data.totalApps}</Text>}
                {data?.activeApps !== undefined && <Text as="p" variant="bodyMd">Active: {data.activeApps}</Text>}
                {data?.recommendations && (
                  <BlockStack gap="100">
                    <Text as="p" variant="headingSm">Recommendations:</Text>
                    {data.recommendations.map((r: string, i: number) => (
                      <Text key={i} as="p" variant="bodyMd">&bull; {r}</Text>
                    ))}
                  </BlockStack>
                )}
                {data?.assessments && (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text']}
                    headings={['Agent', 'Status', 'Issues']}
                    rows={data.assessments.map((a: any) => [
                      a.agentType,
                      <Badge tone={a.status === 'pass' ? 'success' : a.status === 'warning' ? 'warning' : 'critical'}>{a.status}</Badge>,
                      (a.issues || []).join(', ') || 'None',
                    ])}
                  />
                )}
                {data?.gdprFindings && (
                  <Banner tone="warning">
                    {data.gdprFindings.length} GDPR findings, {data.securityFindings.length} security findings
                  </Banner>
                )}
              </BlockStack>
            </Card>
          ))}
        </>
      )}
    </BlockStack>
  );
}
