const BASE = import.meta.env.DEV ? '' : '/orchestrator';

const shopFromUrl = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('shop') || ''
  : '';

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

function addShop(url: string): string {
  if (!shopFromUrl) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}shop=${encodeURIComponent(shopFromUrl)}`;
}

async function shopifySessionToken(): Promise<string | null> {
  const shopify = (window as any).shopify;
  if (!shopify?.idToken) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  try {
    return await Promise.race([Promise.resolve(shopify.idToken()), timeout]);
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const sessionToken = await shopifySessionToken();
    if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const res = await fetch(`${BASE}${addShop(url)}`, {
    credentials: 'include',
    headers: { ...headers, ...options?.headers as Record<string, string> },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function jsonBody(data: any): RequestInit {
  return { method: 'POST', body: JSON.stringify(data) };
}

export const api = {
  auth: {
    register: (email: string, password: string, name: string) =>
      fetchJson<any>('/api/auth/register', jsonBody({ email, password, name })),
    login: (email: string, password: string) =>
      fetchJson<any>('/api/auth/login', jsonBody({ email, password })),
    me: () => fetchJson<any>('/api/auth/me'),
  },
  apps: {
    getGraph: () => fetchJson<any>('/api/apps'),
    refresh: () => fetchJson<{ operationId: string; status: string }>('/api/apps/refresh', { method: 'POST' }),
    bulkStatus: (id: string) => fetchJson<any>(`/api/apps/bulk-status/${id}`),
    categorize: () => fetchJson<{ categorized: number }>('/api/apps/categorize', { method: 'POST' }),
  },
  compliance: {
    scan: () => fetchJson<any>('/api/compliance/scan'),
    summary: () => fetchJson<any>('/api/compliance/summary'),
    approveFinding: (id: string, approvedBy?: string) =>
      fetchJson<any>(`/api/compliance/findings/${id}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy }) }),
  },
  remediation: {
    roadmap: () => fetchJson<any>('/api/remediation/roadmap'),
    propose: (data: any) => fetchJson<any>('/api/remediation/propose', { method: 'POST', body: JSON.stringify(data) }),
    approveAction: (id: string, approvedBy?: string) =>
      fetchJson<any>(`/api/remediation/actions/${id}/approve`, { method: 'POST', body: JSON.stringify({ approvedBy }) }),
  },
  ai: {
    analyze: (agentType: string, context?: string) =>
      fetchJson<any>('/api/ai/analyze', { method: 'POST', body: JSON.stringify({ agentType, context }) }),
  },
  version: { check: () => fetchJson<any>('/api/version-compliance') },
  scoring: {
    scoreAll: () => fetchJson<any>('/api/scoring/score-all', { method: 'POST' }),
    scoreApp: (appId: string) => fetchJson<any>(`/api/scoring/score/${appId}`, { method: 'POST' }),
  },
  performance: {
    runPagespeed: (url?: string) => fetchJson<any>('/api/performance/pagespeed', { method: 'POST', body: JSON.stringify({ url }) }),
  },
  ownership: {
    set: (data: any) => fetchJson<any>('/api/ownership/set', { method: 'POST', body: JSON.stringify(data) }),
    needsReview: () => fetchJson<any>('/api/ownership/needs-review'),
    orphaned: () => fetchJson<any>('/api/ownership/orphaned'),
    completeReview: (appId: string) => fetchJson<any>(`/api/ownership/review/${appId}`, { method: 'POST' }),
  },
  feedback: {
    submit: (data: any) => fetchJson<any>('/api/feedback/submit', { method: 'POST', body: JSON.stringify(data) }),
    summary: () => fetchJson<any>('/api/feedback/summary'),
  },
  conflicts: {
    detect: () => fetchJson<any>('/api/conflicts/detect', { method: 'POST' }),
    list: () => fetchJson<any>('/api/conflicts'),
    resolve: (id: string) => fetchJson<any>(`/api/conflicts/${id}/resolve`, { method: 'POST' }),
  },
  evidence: {
    list: (params?: any) => {
      const q = new URLSearchParams();
      if (params?.eventType) q.set('eventType', params.eventType);
      if (params?.limit) q.set('limit', params.limit.toString());
      return fetchJson<any>(`/api/evidence?${q}`);
    },
    auditReport: () => fetchJson<any>('/api/evidence/audit-report'),
  },
  recommendations: { generate: () => fetchJson<any>('/api/recommendations/generate', { method: 'POST' }) },
  agentOps: {
    summary: () => fetchJson<any>('/api/agent-ops/summary'),
    history: (params?: any) => {
      const q = new URLSearchParams();
      if (params?.agentType) q.set('agentType', params.agentType);
      if (params?.limit) q.set('limit', params.limit.toString());
      return fetchJson<any>(`/api/agent-ops/history?${q}`);
    },
  },
  chain: { runAudit: () => fetchJson<any>('/api/chain/run-audit', { method: 'POST' }) },
  customApp: {
    create: (data: any) => fetchJson<any>('/api/apps/custom', { method: 'POST', body: JSON.stringify(data) }),
    update: (appId: string, data: any) => fetchJson<any>(`/api/apps/${appId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (appId: string) => fetchJson<any>(`/api/apps/${appId}`, { method: 'DELETE' }),
  },
  compare: {
    list: () => fetchJson<any>('/api/apps/compare'),
  },
  agents: {
    inventory: () => fetchJson<any>('/api/agents/inventory', { method: 'POST' }),
    compliance: () => fetchJson<any>('/api/agents/compliance', { method: 'POST' }),
    critic: (agentOutputs: any) => fetchJson<any>('/api/agents/critic', { method: 'POST', body: JSON.stringify({ agentOutputs }) }),
  },
  query: { ask: (query: string) => fetchJson<any>('/api/query/ask', { method: 'POST', body: JSON.stringify({ query }) }) },
  incidents: {
    list: () => fetchJson<any>('/api/incidents'),
    detect: () => fetchJson<any>('/api/incidents/detect', { method: 'POST' }),
    updateStatus: (id: string, status: string, resolution?: string) =>
      fetchJson<any>(`/api/incidents/${id}/status`, { method: 'POST', body: JSON.stringify({ status, resolution }) }),
    escalate: (id: string, escalatedTo: string, reason: string) =>
      fetchJson<any>(`/api/incidents/${id}/escalate`, { method: 'POST', body: JSON.stringify({ escalatedTo, reason }) }),
  },
  themeCleanup: {
    summary: () => fetchJson<any>('/api/theme-cleanup'),
    check: (appId: string) => fetchJson<any>(`/api/theme-cleanup/check/${appId}`, { method: 'POST' }),
  },
  negotiations: {
    draft: (data: any) => fetchJson<any>('/api/negotiations/draft', { method: 'POST', body: JSON.stringify(data) }),
    list: () => fetchJson<any>('/api/negotiations'),
    updateStatus: (id: string, status: string) =>
      fetchJson<any>(`/api/negotiations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  },
  tenant: {
    policies: () => fetchJson<any>('/api/tenant/policies'),
    setPolicy: (data: any) => fetchJson<any>('/api/tenant/policies', { method: 'POST', body: JSON.stringify(data) }),
    updateMetadata: (data: any) => fetchJson<any>('/api/tenant/metadata', { method: 'POST', body: JSON.stringify(data) }),
  },
  consent: {
    getPurposes: () => fetchJson<any>('/api/consent/purposes'),
    createPurpose: (data: any) => fetchJson<any>('/api/consent/purposes', jsonBody(data)),
    updatePurpose: (id: string, data: any) => fetchJson<any>(`/api/consent/purposes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    seedPurposes: () => fetchJson<any>('/api/consent/purposes/seed', { method: 'POST' }),
    getRecords: (params?: any) => { const q = new URLSearchParams(); if (params?.customerId) q.set('customerId', params.customerId); if (params?.email) q.set('email', params.email); return fetchJson<any>(`/api/consent/records?${q}`); },
    recordConsent: (data: any) => fetchJson<any>('/api/consent/records', jsonBody(data)),
    getConsentStats: () => fetchJson<any>('/api/consent/records/stats'),
    exportConsent: () => fetchJson<any>('/api/consent/records/export'),
    getCustomerConsentStatus: (customerId: string) => fetchJson<any>(`/api/consent/customers/${customerId}/status`),
    updateCustomerConsent: (customerId: string, data: any) => fetchJson<any>(`/api/consent/customers/${customerId}/status`, jsonBody(data)),
    getTemplates: () => fetchJson<any>('/api/consent/templates'),
    createTemplate: (data: any) => fetchJson<any>('/api/consent/templates', jsonBody(data)),
    updateTemplate: (id: string, data: any) => fetchJson<any>(`/api/consent/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTemplate: (id: string) => fetchJson<any>(`/api/consent/templates/${id}`, { method: 'DELETE' }),
    getWidget: () => fetchJson<any>('/api/consent/widget'),
  },
  dsr: {
    list: (params?: any) => { const q = new URLSearchParams(); if (params?.status) q.set('status', params.status); if (params?.requestType) q.set('requestType', params.requestType); if (params?.limit) q.set('limit', params.limit); return fetchJson<any>(`/api/dsr?${q}`); },
    create: (data: any) => fetchJson<any>('/api/dsr', jsonBody(data)),
    get: (id: string) => fetchJson<any>(`/api/dsr/${id}`),
    getStats: () => fetchJson<any>('/api/dsr/stats'),
    process: (id: string) => fetchJson<any>(`/api/dsr/${id}/process`, { method: 'POST' }),
    complete: (id: string) => fetchJson<any>(`/api/dsr/${id}/complete`, { method: 'POST' }),
    reject: (id: string, reason: string) => fetchJson<any>(`/api/dsr/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    anonymize: (id: string) => fetchJson<any>(`/api/dsr/${id}/anonymize`, { method: 'POST' }),
    notify: (id: string, via?: string) => fetchJson<any>(`/api/dsr/${id}/notify`, { method: 'POST', body: JSON.stringify({ via }) }),
    withdraw: (id: string) => fetchJson<any>(`/api/dsr/${id}/withdraw`, { method: 'POST' }),
    sendEmail: (id: string) => fetchJson<any>(`/api/dsr/${id}/send-email`, { method: 'POST' }),
    getOverdue: () => fetchJson<any>('/api/dsr/overdue'),
    getUpcoming: (days?: number) => fetchJson<any>(`/api/dsr/deadlines/upcoming?days=${days || 7}`),
    getTemplates: (requestType?: string) => fetchJson<any>(`/api/dsr/templates${requestType ? `?requestType=${requestType}` : ''}`),
    createTemplate: (data: any) => fetchJson<any>('/api/dsr/templates', jsonBody(data)),
    updateTemplate: (id: string, data: any) => fetchJson<any>(`/api/dsr/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTemplate: (id: string) => fetchJson<any>(`/api/dsr/templates/${id}`, { method: 'DELETE' }),
    seedTemplates: () => fetchJson<any>('/api/dsr/templates/defaults', { method: 'POST' }),
  },
  dashboard: {
    summary: () => fetchJson<any>('/api/dashboard/summary'),
    score: () => fetchJson<any>('/api/dashboard/score'),
    checklist: () => fetchJson<any>('/api/dashboard/checklist'),
    updateChecklistItem: (id: string, data: any) => fetchJson<any>(`/api/dashboard/checklist/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    scoreHistory: (days?: number) => fetchJson<any>(`/api/dashboard/score-history?days=${days || 30}`),
    snapshot: () => fetchJson<any>('/api/dashboard/snapshot', { method: 'POST' }),
    platformStatus: () => fetchJson<any>('/api/dashboard/platform-status'),
  },
};
