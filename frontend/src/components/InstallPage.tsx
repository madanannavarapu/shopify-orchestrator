import React, { useState } from 'react';
import { Card, Text, TextField, Button, BlockStack, Banner } from '@shopify/polaris';

const OAUTH_BASE = '/auth';

function normalizeShop(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  // Already a full domain
  if (trimmed.endsWith('.myshopify.com')) return trimmed;
  // Store name only — strip any accidental protocol/path
  const cleaned = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  if (!cleaned) return null;
  return `${cleaned}.myshopify.com`;
}

export default function InstallPage() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleInstall = () => {
    const shop = normalizeShop(input);
    if (!shop) {
      setError('Please enter a store name');
      return;
    }
    window.location.href = `${OAUTH_BASE}?shop=${encodeURIComponent(shop)}`;
  };

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px' }}>
      <Card>
        <BlockStack gap="400">
          <Text as="h1" variant="headingLg">Install Shopify App</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Enter your store name to begin installation.
          </Text>

          {error && (
            <Banner tone="critical" onDismiss={() => setError('')}>
              {error}
            </Banner>
          )}

          <TextField
            label="Store name"
            value={input}
            onChange={(v) => { setInput(v); setError(''); }}
            placeholder="mystore"
            helpText="Enter just the store name (e.g. mystore) or full domain (mystore.myshopify.com)"
            autoComplete="off"
            autoFocus
          />

          <Button variant="primary" fullWidth onClick={handleInstall}>
            Install App
          </Button>
        </BlockStack>
      </Card>
    </div>
  );
}
