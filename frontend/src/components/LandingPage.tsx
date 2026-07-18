import React from 'react';
import { Card, Text, Button, BlockStack } from '@shopify/polaris';

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <BlockStack gap="600" align="center">
        <div style={{ textAlign: 'center' }}>
          <Text as="h1" variant="heading3xl">App Stack Orchestrator</Text>
          <Text as="p" variant="headingLg" tone="subdued">
            AI-Powered SaaS Audit & Governance Platform
          </Text>
        </div>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">What It Does</Text>
            <Text as="p" variant="bodyMd">
              Manage, score, and optimize your entire application stack in one place.
              Track costs, detect compliance risks, identify redundant tools, and get AI-driven
              recommendations — whether you're running Shopify apps or any SaaS tools.
            </Text>
          </BlockStack>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--p-space-400)', width: '100%' }}>
          <Card>
            <Text as="h3" variant="headingMd">Inventory & Scoring</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Auto-discover all apps, score them on performance, cost, security, and functionality.
            </Text>
          </Card>
          <Card>
            <Text as="h3" variant="headingMd">Compliance & Risk</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Scan permission scopes, detect violations, flag high-risk access, and track remediation.
            </Text>
          </Card>
          <Card>
            <Text as="h3" variant="headingMd">AI Recommendations</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Get intelligent suggestions to reduce costs, remove duplicates, and improve security posture.
            </Text>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--p-space-400)', width: '100%' }}>
          <Card>
            <Text as="h3" variant="headingMd">Incident Response</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Detect data breaches, policy violations, abnormal access patterns, and manage escalations.
            </Text>
          </Card>
          <Card>
            <Text as="h3" variant="headingMd">Vendor Negotiations</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Draft AI-powered negotiation letters, track vendor discussions, and optimize contract costs.
            </Text>
          </Card>
          <Card>
            <Text as="h3" variant="headingMd">Multi-Tenant</Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Enterprise-grade tenant policies, data retention rules, and access control across organizations.
            </Text>
          </Card>
        </div>

        <div style={{ display: 'flex', gap: 'var(--p-space-400)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="primary" size="large" onClick={onGetStarted}>Get Started Free</Button>
        </div>

        <Text as="p" variant="bodySm" tone="subdued">
          No credit card required &middot; Start managing your app stack in minutes
        </Text>
      </BlockStack>
    </div>
  );
}
