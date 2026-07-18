import React, { useEffect, useState } from 'react';
import {
  Card,
  Text,
  DataTable,
  BlockStack,
  Spinner,
  Banner,
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function CompareApps() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.compare.list().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner accessibilityLabel="Loading comparison" />;

  return (
    <BlockStack gap="400">
      <Banner title="App Comparison">
        Side-by-side comparison of all installed apps. See scores, costs, and risk levels at a glance.
      </Banner>

      <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
        <Card><Text as="h3" variant="headingMd">Total Apps</Text><Text as="p" variant="headingXl">{data?.apps?.length || 0}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Monthly Spend</Text><Text as="p" variant="headingXl">${data?.totalMonthlySpend?.toFixed(2) || '0'}</Text></Card>
        <Card><Text as="h3" variant="headingMd">Avg Cost/App</Text><Text as="p" variant="headingXl">
          ${data?.apps?.length ? (data.totalMonthlySpend / data.apps.length).toFixed(2) : '0'}
        </Text></Card>
      </div>

      {data?.apps && data.apps.length > 0 ? (
        <Card>
          <Text as="h3" variant="headingMd">Score Comparison</Text>
          <DataTable
            columnContentTypes={['text', 'text', 'numeric', 'numeric', 'numeric', 'numeric', 'numeric', 'text', 'text']}
            headings={['App', 'Category', 'Cost/mo', 'Perf', 'Cost Score', 'Func', 'Security', 'Overall', 'Status']}
            rows={data.apps.map((a: any) => [
              a.name,
              a.category || '-',
              `$${a.monthlyCost?.toFixed(2) || '0'}`,
              a.scores ? `${a.scores.performance}/5` : '-',
              a.scores ? `${a.scores.cost}/5` : '-',
              a.scores ? `${a.scores.functionality}/5` : '-',
              a.scores ? `${a.scores.security}/5` : '-',
              a.scores ? a.scores.overall.toFixed(2) : '-',
              a.isActive ? 'Active' : 'Inactive',
            ])}
          />
        </Card>
      ) : (
        <Card><Text as="p" variant="bodyMd">No apps to compare. Add some apps first.</Text></Card>
      )}

      {data?.apps && data.apps.length > 1 && (
        <Card>
          <Text as="h3" variant="headingMd">Highlights</Text>
          <BlockStack gap="200">
            {(() => {
              const sorted = [...data.apps].sort((a, b) => (a.monthlyCost || 0) - (b.monthlyCost || 0));
              return (
                <>
                  <Text as="p" variant="bodyMd">Most Expensive: <strong>{sorted[sorted.length-1]?.name}</strong> (${sorted[sorted.length-1]?.monthlyCost?.toFixed(2) || '0'}/mo)</Text>
                  <Text as="p" variant="bodyMd">Cheapest: <strong>{sorted[0]?.name}</strong> (${sorted[0]?.monthlyCost?.toFixed(2) || '0'}/mo)</Text>
                  {data.apps.filter((a: any) => a.scores?.overall).length > 0 && (
                    <>
                      {(() => {
                        const byScore = [...data.apps].filter((a: any) => a.scores?.overall).sort((a, b) => b.scores.overall - a.scores.overall);
                        return (
                          <>
                            <Text as="p" variant="bodyMd">Highest Rated: <strong>{byScore[0]?.name}</strong> ({byScore[0]?.scores?.overall.toFixed(2)})</Text>
                            <Text as="p" variant="bodyMd">Lowest Rated: <strong>{byScore[byScore.length-1]?.name}</strong> ({byScore[byScore.length-1]?.scores?.overall.toFixed(2)})</Text>
                          </>
                        );
                      })()}
                    </>
                  )}
                </>
              );
            })()}
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}
