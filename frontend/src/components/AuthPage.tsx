import React, { useState } from 'react';
import { Card, Text, Button, BlockStack, TextField, Banner, Spinner } from '@shopify/polaris';
import { api, getToken } from '../api/shopify';

interface AuthPageProps {
  onAuth: () => void;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await api.auth.register(email, password, name);
        localStorage.setItem('auth_token', res.token);
      } else {
        const res = await api.auth.login(email, password);
        localStorage.setItem('auth_token', res.token);
      }
      onAuth();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: '0 20px' }}>
      <BlockStack gap="400">
        <div style={{ textAlign: 'center' }}>
          <Text as="h1" variant="heading3xl">{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {mode === 'login' ? 'Welcome back to App Stack Orchestrator' : 'Start managing your app stack'}
          </Text>
        </div>

        {error && <Banner tone="critical"><Text as="p">{error}</Text></Banner>}

        <Card>
          <BlockStack gap="300">
            {mode === 'signup' && (
              <TextField label="Name" value={name} onChange={setName} autoComplete="name" />
            )}
            <TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <TextField label="Password" value={password} onChange={setPassword} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            <Button variant="primary" onClick={handleSubmit} loading={loading} fullWidth>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </BlockStack>
        </Card>

        <div style={{ textAlign: 'center' }}>
          <Button variant="plain" onClick={switchMode}>
            {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </Button>
        </div>
      </BlockStack>
    </div>
  );
}
