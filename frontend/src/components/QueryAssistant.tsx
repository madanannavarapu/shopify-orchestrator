import React, { useState } from 'react';
import {
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  TextField,
} from '@shopify/polaris';
import { api } from '../api/shopify';

export default function QueryAssistant() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.query.ask(query);
      setResult(res);
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <BlockStack gap="400">
      <Banner title="Query Assistant">
        Ask questions about your app stack. Simple questions (cost, count, categories) get instant answers. Complex questions (audit, recommendations, optimization) will guide you to run a full chain audit.
      </Banner>

      <Card>
        <BlockStack gap="300">
          <TextField
            label="Ask a question about your app stack"
            value={query}
            onChange={setQuery}
            placeholder='e.g. "What is my total monthly spend?" or "Which apps should I remove?"'
            autoComplete="off"
          />
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <Button onClick={handleAsk} loading={loading} variant="primary">Ask</Button>
          </div>
        </BlockStack>
      </Card>

      {result && (
        <Card><Text as="h3" variant="headingMd">Answer</Text>
          <BlockStack gap="200">
            {result.queryType && (
              <Text as="p" variant="bodySm">
                Type: {result.queryType} {result.cached && <Text as="span" tone="subdued">(cached)</Text>}
              </Text>
            )}
            {result.answer && <Text as="p" variant="headingMd">{result.answer}</Text>}
            {result.totalMonthlySpend !== undefined && (
              <Text as="p" variant="headingXl">${result.totalMonthlySpend.toFixed(2)}/mo</Text>
            )}
            {result.totalApps !== undefined && (
              <Text as="p" variant="headingXl">{result.totalApps} total apps</Text>
            )}
            {result.activeApps !== undefined && (
              <Text as="p" variant="headingXl">{result.activeApps} active apps</Text>
            )}
            {result.message && <Text as="p" variant="bodyMd">{result.message}</Text>}
            {result.error && <Banner tone="critical">{result.error}</Banner>}
          </BlockStack>
        </Card>
      )}

      <Card><Text as="h3" variant="headingMd">Example Queries</Text>
        <BlockStack gap="200">
          <Text as="p" variant="bodyMd">&bull; "What is my total monthly app spend?"</Text>
          <Text as="p" variant="bodyMd">&bull; "How many apps are installed?"</Text>
          <Text as="p" variant="bodyMd">&bull; "Which apps have high-risk permissions?"</Text>
          <Text as="p" variant="bodyMd">&bull; "Show me orphaned apps without owners"</Text>
          <Text as="p" variant="bodyMd">&bull; "Which apps should I cut to save money?" (triggers full audit)</Text>
          <Text as="p" variant="bodyMd">&bull; "Are there redundant apps in my stack?" (triggers full audit)</Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
