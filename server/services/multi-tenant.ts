import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

export async function setTenantPolicy(
  shopDomain: string,
  data: {
    policyType: string;
    name: string;
    value: string;
  }
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  const policy = await prisma.tenantPolicy.create({
    data: {
      shopId: shop.id,
      policyType: data.policyType,
      name: data.name,
      value: data.value,
    },
  });

  await logEvidence(
    shopDomain,
    'tenant_policy_set',
    `Policy "${data.name}" (${data.policyType}) set to "${data.value}"`,
    'system'
  );

  return policy;
}

export async function getTenantPolicies(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  return prisma.tenantPolicy.findMany({
    where: { shopId: shop.id, isActive: true },
  });
}

export async function updateStoreMetadata(shopDomain: string, metadata: Record<string, any>) {
  const shop = await prisma.shop.update({
    where: { myshopifyDomain: shopDomain },
    data: { storeMetadata: JSON.stringify(metadata) },
  });

  return shop;
}

export async function getStoreMetadata(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop?.storeMetadata) return {};
  try { return JSON.parse(shop.storeMetadata); } catch { return {}; }
}

export async function getTenantIsolationReport(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  const policies = await getTenantPolicies(shopDomain);
  const apps = await prisma.app.count({ where: { shopId: shop.id } });
  const incidents = await prisma.incident.count({ where: { shopId: shop.id } });

  return {
    shop: shop.myshopifyDomain,
    tenantTier: shop.tenantTier,
    appsCount: apps,
    incidentsCount: incidents,
    activePolicies: policies.length,
    apiVersion: shop.apiVersion,
    metadata: shop.storeMetadata ? JSON.parse(shop.storeMetadata) : {},
    policies: policies.map((p) => ({
      type: p.policyType,
      name: p.name,
      value: p.value,
    })),
    isolationStatus: 'isolated',
    dataBoundary: 'shop-specific (ID: ' + shop.id + ')',
  };
}
