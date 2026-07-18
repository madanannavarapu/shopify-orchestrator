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
  Tabs,
} from '@shopify/polaris';
import { api } from '../api/shopify';
import type { RemediationRoadmap as Roadmap, AIAnalysisResult } from '../types';

export default function RemediationRoadmap() {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    api.remediation.roadmap().then((data) => {
      setRoadmap(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleAIAnalyze = async (agentType: string) => {
    setAiAnalyzing(true);
    try {
      const result = await api.ai.analyze(agentType);
      setAiResult(result);
    } catch (e) {
      console.error(e);
    }
    setAiAnalyzing(false);
  };

  const handleApproveAction = async (id: string) => {
    try {
      await api.remediation.approveAction(id);
      const data = await api.remediation.roadmap();
      setRoadmap(data);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <Spinner accessibilityLabel="Loading roadmap" />;

  const tabs = [
    { id: 'overview', content: 'Overview' },
    { id: 'cost', content: 'Cost Analysis' },
    { id: 'redundancy', content: 'Redundancy' },
    { id: 'ai', content: 'AI Insights' },
  ];

  return (
    <BlockStack gap="400">
      <Card>
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />
      </Card>

      {selectedTab === 0 && (
        <BlockStack gap="400">
          <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
            <Card>
              <Text as="h3" variant="headingMd">Monthly Spend</Text>
              <Text as="p" variant="headingXl">${roadmap?.summary.totalMonthlySpend.toFixed(2) || '0'}</Text>
            </Card>
            <Card>
              <Text as="h3" variant="headingMd">Annual Spend</Text>
              <Text as="p" variant="headingXl">${roadmap?.summary.totalAnnualSpend.toFixed(0) || '0'}</Text>
            </Card>
            <Card>
              <Text as="h3" variant="headingMd">Potential Savings</Text>
              <Text as="p" variant="headingXl" tone="success">${roadmap?.summary.potentialSavings.toFixed(2) || '0'}/mo</Text>
            </Card>
          </div>

          <Card><Text as="h3" variant="headingMd">Proposed Remediation Actions</Text>
            {roadmap?.proposedActions && roadmap.proposedActions.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Action', 'Type', 'Savings', 'Status', '']}
                rows={roadmap.proposedActions.map((a) => [
                  a.title,
                  <Badge>{a.actionType}</Badge>,
                  a.savings ? `$${a.savings.toFixed(2)}` : '-',
                  <Badge tone={a.status === 'approved' ? 'success' : 'info'}>{a.status}</Badge>,
                  a.status === 'proposed' ? (
                    <Button variant="plain" onClick={() => handleApproveAction(a.id)}>Approve</Button>
                  ) : null,
                ])}
              />
            ) : (
              <Text as="p" variant="bodyMd">Run AI analysis to generate proposed actions.</Text>
            )}
          </Card>
        </BlockStack>
      )}

      {selectedTab === 1 && (
        <Card><Text as="h3" variant="headingMd">Cost Analysis</Text>
          <BlockStack gap="300">
            <div style={{display:"flex",gap:"var(--p-space-200)",flexWrap:"wrap"}}>
              <Card><Text as="p" variant="headingMd">Monthly</Text><Text as="p" variant="headingXl">${roadmap?.costAnalysis.totalMonthlySpend.toFixed(2)}</Text></Card>
              <Card><Text as="p" variant="headingMd">Annual</Text><Text as="p" variant="headingXl">${roadmap?.costAnalysis.totalAnnualSpend.toFixed(0)}</Text></Card>
              <Card><Text as="p" variant="headingMd">Potential Savings</Text><Text as="p" variant="headingXl" tone="success">${roadmap?.costAnalysis.potentialSavings.toFixed(2)}</Text></Card>
            </div>
            <DataTable
              columnContentTypes={['text', 'numeric']}
              headings={['App', 'Monthly Cost']}
              rows={roadmap?.costAnalysis.topCostlyApps.map((a) => [a.name, `$${a.cost.toFixed(2)}`]) || []}
            />
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <Button onClick={() => handleAIAnalyze('cost')} loading={aiAnalyzing}>
                AI Cost Analysis
              </Button>
            </div>
          </BlockStack>
        </Card>
      )}

      {selectedTab === 2 && (
        <Card><Text as="h3" variant="headingMd">Redundancy Analysis</Text>
          {roadmap?.redundancyAnalysis && roadmap.redundancyAnalysis.length > 0 ? (
            <BlockStack gap="300">
              {roadmap.redundancyAnalysis.map((ra) => (
                <Card key={ra.category}>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">{ra.category} ({ra.apps.length} apps)</Text>
                    <Banner tone={ra.redundancyScore > 0.5 ? 'warning' : 'info'}>
                      {ra.recommendation} &middot; Est. savings: ${ra.estimatedSavings.toFixed(2)}/mo
                    </Banner>
                    <DataTable
                      columnContentTypes={['text', 'numeric']}
                      headings={['App', 'Cost/mo']}
                      rows={ra.apps.map((a) => [
                        a.name,
                        a.monthlyCost ? `$${a.monthlyCost.toFixed(2)}` : 'Free',
                      ])}
                    />
                  </BlockStack>
                </Card>
              ))}
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <Button onClick={() => handleAIAnalyze('redundancy')} loading={aiAnalyzing}>
                  AI Redundancy Analysis
                </Button>
              </div>
            </BlockStack>
          ) : (
            <Text as="p" variant="bodyMd">No significant redundancy detected.</Text>
          )}
        </Card>
      )}

      {selectedTab === 3 && (
        <Card><Text as="h3" variant="headingMd">AI-Powered Insights</Text>
          <BlockStack gap="300">
            <div style={{display:"flex",gap:"var(--p-space-200)"}}>
              <Button onClick={() => handleAIAnalyze('cost')} loading={aiAnalyzing}>
                Analyze Costs
              </Button>
              <Button onClick={() => handleAIAnalyze('redundancy')} loading={aiAnalyzing}>
                Analyze Redundancy
              </Button>
              <Button onClick={() => handleAIAnalyze('compliance')} loading={aiAnalyzing}>
                Analyze Compliance
              </Button>
            </div>

            {aiResult ? (
              <Card>
                <Text as="h3" variant="headingMd">AI Analysis Results</Text>
                <Text as="p" variant="bodyMd">{aiResult.summary}</Text>
                <BlockStack gap="100">
                  {aiResult.recommendations.map((rec, i) => (
                    <Text key={i} as="p" variant="bodyMd">&bull; {rec}</Text>
                  ))}
                </BlockStack>
                <Text as="p" variant="bodySm">
                  Confidence: {(aiResult.confidence * 100).toFixed(0)}%
                </Text>
              </Card>
            ) : (
              <Card>
                <Text as="p" variant="bodyMd">
                  Click an analysis button above to get AI-powered insights about your app ecosystem.
                  Configure OPENAI_API_KEY for GPT-4 powered analysis, or use the built-in rule engine.
                </Text>
              </Card>
            )}
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}
