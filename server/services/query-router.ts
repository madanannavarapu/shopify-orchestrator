import crypto from 'crypto';
import { prisma } from '../database';

// Simple queries that can be answered with fast DB lookups
const SIMPLE_QUERY_PATTERNS = [
  /total.*monthly.*spend/i,
  /how many.*apps/i,
  /what.*cost/i,
  /monthly.*cost/i,
  /total.*apps/i,
  /active.*apps/i,
  /high.*risk.*scope/i,
  /category/i,
  /owner/i,
  /orphan/i,
];

// Complex queries that need full agentic workflow
const COMPLEX_QUERY_PATTERNS = [
  /should.*(keep|cut|remove|replace)/i,
  /recommend/i,
  /audit/i,
  /redundant/i,
  /conflict/i,
  /overlap/i,
  /duplicate/i,
  /consolidate/i,
  /optimize/i,
  /score/i,
  /compare/i,
  /improve/i,
];

export function classifyQuery(query: string): 'simple' | 'complex' {
  const isComplex = COMPLEX_QUERY_PATTERNS.some((p) => p.test(query));
  if (isComplex) return 'complex';

  const isSimple = SIMPLE_QUERY_PATTERNS.some((p) => p.test(query));
  if (isSimple) return 'simple';

  // Default to complex for unknown queries (safer to do full analysis)
  return 'complex';
}

export function hashQuery(query: string): string {
  return crypto.createHash('md5').update(query.toLowerCase().trim()).digest('hex');
}

export async function cacheQueryResult(shopDomain: string, query: string, response: any, ttlSeconds = 300) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return;

  const hash = hashQuery(query);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await prisma.queryRouterCache.upsert({
    where: { id: `${shop.id}-${hash}` },
    create: {
      id: `${shop.id}-${hash}`,
      shopId: shop.id,
      queryHash: hash,
      queryType: classifyQuery(query),
      response: JSON.stringify(response),
      ttlSeconds,
      expiresAt,
    },
    update: {
      response: JSON.stringify(response),
      expiresAt,
    },
  });
}

export async function getCachedQueryResult(shopDomain: string, query: string): Promise<any | null> {
  const hash = hashQuery(query);
  const cached = await prisma.queryRouterCache.findUnique({
    where: { id: `${shopDomain}-${hash}` },
  });

  if (!cached) return null;
  if (new Date() > cached.expiresAt) {
    await prisma.queryRouterCache.delete({ where: { id: cached.id } });
    return null;
  }

  return cached.response ? JSON.parse(cached.response) : null;
}

export async function getSimpleAppAnswer(shopDomain: string, query: string): Promise<any> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  const apps = await prisma.app.findMany({ where: { shopId: shop.id } });

  if (/total.*monthly.*spend/i.test(query) || /monthly.*cost/i.test(query)) {
    const total = apps.reduce((s, a) => s + (a.monthlyCost || 0), 0);
    return { answer: `Total monthly app spend: $${total.toFixed(2)}`, data: { totalMonthlySpend: total } };
  }

  if (/how many.*apps/i.test(query) || /total.*apps/i.test(query)) {
    return { answer: `Total apps: ${apps.length}`, data: { totalApps: apps.length } };
  }

  if (/active.*apps/i.test(query)) {
    const active = apps.filter((a) => a.isActive).length;
    return { answer: `Active apps: ${active}`, data: { activeApps: active } };
  }

  if (/high.*risk.*scope/i.test(query)) {
    const perms = await prisma.appPermission.findMany({ where: { isHighRisk: true }, include: { app: true } });
    return { answer: `${perms.length} high-risk permission scopes across ${new Set(perms.map((p) => p.appId)).size} apps`, data: { highRiskScopes: perms.length } };
  }

  if (/orphan/i.test(query)) {
    const orphaned = apps.filter((a) => !a.ownerName);
    return { answer: `${orphaned.length} apps have no assigned owner`, data: { orphanedApps: orphaned.length } };
  }

  if (/category/i.test(query)) {
    const cats = apps.reduce<Record<string, number>>((acc, a) => {
      const c = a.category || 'Uncategorized';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});
    return { answer: `Apps by category: ${Object.entries(cats).map(([c, n]) => `${c}: ${n}`).join(', ')}`, data: { categories: cats } };
  }

  return null;
}
