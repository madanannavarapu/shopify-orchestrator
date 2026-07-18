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
  Banner,
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function ThemeCleanup() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await api.themeCleanup.summary();
      setSummary(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCheck = async (appId: string) => {
    try {
      await api.themeCleanup.check(appId);
      loadData();
    } catch (e) { console.error(e); }
  };

  if (loading) return <Spinner accessibilityLabel="Loading" />;

  return (
    <BlockStack gap="400">
      <Banner title="Theme Cleanup Verification">
        Apps can inject assets (scripts, snippets, CSS) into your theme. When you uninstall, some apps leave these behind, slowing your store. Verify cleanup here.
      </Banner>

      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card><Text as="h3" variant="headingMd">Apps with Assets</Text><Text as="p" variant="headingXl">{summary?.appsWithAssets || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Total Assets</Text><Text as="p" variant="headingXl">{summary?.totalAssets || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Pending Cleanup</Text><Text as="p" variant="headingXl" tone="caution">{summary?.pendingCleanup || 0}</Text></Card>
      </div>

      <Card><Text as="h3" variant="headingMd">Theme Asset Verifications</Text>
        {summary?.verifications && summary.verifications.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text']}
            headings={['App', 'Asset Path', 'Type', 'Cleaned']}
            rows={summary.verifications.map((v: any) => [
              v.app?.name || 'Unknown',
              v.assetPath,
              <Badge>{v.assetType}</Badge>,
              v.cleanRemoved
                ? <Badge tone="success">Cleaned</Badge>
                : <Badge tone="critical">Present</Badge>,
            ])}
          />
        ) : (
          <Text as="p" variant="bodyMd">No theme assets tracked. Assets are detected when apps are categorized.</Text>
        )}
      </Card>
    </BlockStack>
  );
}
