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
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { ScanResult, ComplianceSummary } from '../types';

export default function ComplianceScanner() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const loadSummary = () => {
    api.compliance.summary().then(setSummary).catch(() => {});
  };

  useEffect(() => {
    api.compliance.summary().then((s) => {
      setSummary(s);
      setLoading(false);
    });
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.compliance.scan();
      setScanResult(result);
      loadSummary();
    } catch (e) {
      console.error(e);
    }
    setScanning(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.compliance.approveFinding(id);
      loadSummary();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <Spinner accessibilityLabel="Loading compliance" />;

  const findings = scanResult?.findings || summary?.findings || [];
  const highCount = scanResult?.highSeverity ?? summary?.highSeverity ?? 0;
  const medCount = scanResult?.mediumSeverity ?? summary?.mediumSeverity ?? 0;
  const lowCount = scanResult?.lowSeverity ?? summary?.lowSeverity ?? 0;

  return (
    <BlockStack gap="400">
      <div style={{display:"flex",justifyContent:"flex-end",gap:"var(--p-space-200)"}}>
        <Button onClick={handleScan} loading={scanning} variant="primary">
          Run Compliance Scan
        </Button>
      </div>

      {scanResult && (
        <Banner title={`Scan complete: ${scanResult.totalFindings} findings`} tone={highCount > 0 ? 'critical' : 'success'}>
          {highCount} high severity, {medCount} medium, {lowCount} low across {scanResult.scannedApps} apps
        </Banner>
      )}

      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card>
          <Text as="h3" variant="headingMd">High Severity</Text>
          <Text as="p" variant="headingXl" tone="critical">{highCount}</Text>
        </Card>
        <Card>
          <Text as="h3" variant="headingMd">Medium Severity</Text>
          <Text as="p" variant="headingXl" tone="caution">{medCount}</Text>
        </Card>
        <Card>
          <Text as="h3" variant="headingMd">Low Severity</Text>
          <Text as="p" variant="headingXl">{lowCount}</Text>
        </Card>
      </div>

      <Card><Text as="h3" variant="headingMd">Findings</Text>
        {findings.length === 0 ? (
          <Text as="p" variant="bodyMd">No compliance findings. Run a scan to check your apps.</Text>
        ) : (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text']}
            headings={['Rule', 'App', 'Message', 'Severity', 'Action']}
            rows={findings.map((f: any) => [
              f.ruleName || f.rule,
              f.appName || f.app,
              f.message,
              <Badge tone={f.severity === 'high' ? 'critical' : f.severity === 'medium' ? 'warning' : 'success'}>
                {f.severity}
              </Badge>,
              <Button variant="plain" onClick={() => handleApprove(f.id)}>Approve</Button>,
            ])}
          />
        )}
      </Card>
    </BlockStack>
  );
}
