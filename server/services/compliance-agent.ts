import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

interface ComplianceAgentResult {
  gdprFindings: { appId: string; appName: string; issue: string; severity: string }[];
  securityFindings: { appId: string; appName: string; issue: string; severity: string }[];
  themeFindings: { appId: string; appName: string; assetPath: string; issue: string }[];
  apiComplianceFindings: { issue: string; severity: string }[];
  recommendations: string[];
}

const HIGH_RISK_DATA_SCOPES = ['read_customers', 'write_customers', 'read_orders', 'write_orders'];

export async function runComplianceAgent(shopDomain: string): Promise<ComplianceAgentResult> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { gdprFindings: [], securityFindings: [], themeFindings: [], apiComplianceFindings: [], recommendations: [] };

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true },
    include: { permissions: true },
  });

  const gdprFindings: ComplianceAgentResult['gdprFindings'] = [];
  const securityFindings: ComplianceAgentResult['securityFindings'] = [];
  const themeFindings: ComplianceAgentResult['themeFindings'] = [];
  const apiComplianceFindings: ComplianceAgentResult['apiComplianceFindings'] = [];
  const recommendations: string[] = [];

  // GDPR: Check for apps with customer data access
  for (const app of apps) {
    const hasCustomerScope = app.permissions.some((p) =>
      HIGH_RISK_DATA_SCOPES.includes(p.scope)
    );

    if (hasCustomerScope) {
      gdprFindings.push({
        appId: app.id,
        appName: app.name,
        issue: `Has access to customer data (${app.permissions.filter((p) => HIGH_RISK_DATA_SCOPES.includes(p.scope)).map((p) => p.scope).join(', ')}) — verify GDPR webhook configuration and data processing agreement`,
        severity: 'high',
      });
    }
  }

  // Check for GDPR webhook presence
  if (shop) {
    apiComplianceFindings.push({
      issue: 'Verify GDPR webhooks (customers/redact, shop/redact, customers/data_request) are registered at the Shopify Partner level',
      severity: 'high',
    });
  }

  // Security: Check for apps with excessive permissions
  for (const app of apps) {
    const writeScopes = app.permissions.filter((p) => p.scope.startsWith('write_'));
    if (writeScopes.length >= 5) {
      securityFindings.push({
        appId: app.id,
        appName: app.name,
        issue: `Requests ${writeScopes.length} write-level scopes — excessive for most use cases`,
        severity: 'high',
      });
    }

    // Check for apps with both read_customers AND write_orders
    const hasReadCustomers = app.permissions.some((p) => p.scope === 'read_customers');
    const hasWriteOrders = app.permissions.some((p) => p.scope === 'write_orders');
    if (hasReadCustomers && hasWriteOrders) {
      securityFindings.push({
        appId: app.id,
        appName: app.name,
        issue: 'Has both customer read access AND order write access — sensitive combination that could expose PII',
        severity: 'critical',
      });
    }
  }

  // API Version compliance
  if (shop) {
    const versionNum = (v: string) => parseInt(v.replace(/[^\d]/g, ''));
    const currentVer = versionNum(shop.apiVersion);
    const latestVer = versionNum('2024-10');
    if (currentVer < latestVer) {
      apiComplianceFindings.push({
        issue: `Shop API version ${shop.apiVersion} is behind latest (2024-10) — ${latestVer - currentVer} versions behind`,
        severity: 'high',
      });
    }
  }

  // Theme cleanup verification
  for (const app of apps) {
    if (app.themeAssets) {
      try {
        const assets = JSON.parse(app.themeAssets);
        if (Array.isArray(assets)) {
          for (const asset of assets) {
            themeFindings.push({
              appId: app.id,
              appName: app.name,
              assetPath: asset.path || asset,
              issue: 'Theme asset injected — verify cleanup on uninstall',
            });
          }
        }
      } catch { /* not JSON, skip */ }
    }
  }

  if (gdprFindings.length > 0) recommendations.push('Review GDPR compliance for apps with customer data access');
  if (securityFindings.length > 0) recommendations.push('Audit apps with excessive write permissions');
  if (themeFindings.length > 0) recommendations.push('Verify theme cleanup for apps that inject assets');
  if (apiComplianceFindings.length > 0) recommendations.push('Update API version to latest supported version');

  await logEvidence(shopDomain, 'compliance_agent', `Compliance check: ${gdprFindings.length} GDPR, ${securityFindings.length} security, ${themeFindings.length} theme, ${apiComplianceFindings.length} API issues`, 'compliance-agent');

  return { gdprFindings, securityFindings, themeFindings, apiComplianceFindings, recommendations };
}
