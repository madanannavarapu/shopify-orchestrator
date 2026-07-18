import React, { useEffect, useState } from 'react';
import {
  Layout,
  Card,
  Text,
  Grid,
  BlockStack,
  InlineGrid,
  Banner,
  Spinner,
  DataTable,
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { AppGraphSummary, ComplianceSummary, RemediationRoadmap, VersionCompliance } from '../types';

export default function Dashboard() {
  const [appData, setAppData] = useState<AppGraphSummary | null>(null);
  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
  const [roadmap, setRoadmap] = useState<RemediationRoadmap | null>(null);
  const [version, setVersion] = useState<VersionCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.apps.getGraph().catch(() => null),
      api.compliance.summary().catch(() => null),
      api.remediation.roadmap().catch(() => null),
      api.version.check().catch(() => null),
    ]).then(([a, c, r, v]) => {
      setAppData(a);
      setCompliance(c);
      setRoadmap(r);
      setVersion(v);
      setLoading(false);
    });
  }, []);

  if (loading) return <Spinner accessibilityLabel="Loading dashboard" />;

  return (
    <BlockStack gap="500">
      {error && <Banner tone="critical">{error}</Banner>}

      {version && !version.isCompliant && (
        <Banner tone="warning" title="API Version Update Available">
          {version.recommendation}
        </Banner>
      )}

      <InlineGrid columns="3" gap="400">
        <Card>
          <Text as="h3" variant="headingMd">App Inventory</Text>
          <Text as="p" variant="headingXl">{appData?.totalApps || 0}</Text>
          <Text as="p" variant="bodySm">
            {appData?.activeApps || 0} active &middot; ${appData?.totalMonthlySpend.toFixed(2) || '0.00'}/mo
          </Text>
        </Card>

        <Card>
          <Text as="h3" variant="headingMd">Compliance</Text>
          <Text as="p" variant="headingXl">{compliance?.openFindings || 0}</Text>
          <Text as="p" variant="bodySm">
            {compliance?.highSeverity || 0} high &middot; {compliance?.mediumSeverity || 0} med &middot; {compliance?.lowSeverity || 0} low
          </Text>
        </Card>

        <Card>
          <Text as="h3" variant="headingMd">Potential Savings</Text>
          <Text as="p" variant="headingXl">${roadmap?.summary.potentialSavings.toFixed(2) || '0.00'}/mo</Text>
          <Text as="p" variant="bodySm">
            ${roadmap?.summary.totalAnnualSpend.toFixed(0) || '0'}/yr total spend
          </Text>
        </Card>
      </InlineGrid>

      <Grid>
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6 }}>
          <Card><Text as="h3" variant="headingMd">Top Costly Apps</Text>
            {appData?.apps && appData.apps.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['App', 'Cost/mo']}
                rows={appData.apps
                  .filter((a) => a.monthlyCost && a.monthlyCost > 0)
                  .slice(0, 5)
                  .map((a) => [a.name, `$${a.monthlyCost?.toFixed(2)}`])}
              />
            ) : (
              <Text as="p" variant="bodyMd">Refresh your app inventory to see data.</Text>
            )}
          </Card>
        </Grid.Cell>

        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6 }}>
          <Card><Text as="h3" variant="headingMd">Apps by Category</Text>
            {appData?.appsByCategory && Object.keys(appData.appsByCategory).length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['Category', 'Count']}
                rows={Object.entries(appData.appsByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => [cat, count.toString()])}
              />
            ) : (
              <Text as="p" variant="bodyMd">Categorize apps to see breakdown.</Text>
            )}
          </Card>
        </Grid.Cell>
      </Grid>
    </BlockStack>
  );
}
