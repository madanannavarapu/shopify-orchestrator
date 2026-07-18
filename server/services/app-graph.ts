import { prisma } from '../database';

const HIGH_RISK_SCOPES = [
  'write_orders',
  'write_customers',
  'write_products',
  'write_inventory',
  'write_gift_cards',
  'write_draft_orders',
];

interface RawAppInstallation {
  id: string;
  app: {
    id: string;
    title: string;
    handle: string;
    developerName: string;
    pricing: { price: string; interval: string } | null;
  };
  accessScopes: { handle: string; description: string }[];
  createdAt: string;
}

export async function ingestAppInstallations(shopDomain: string, rawData: RawAppInstallation[]) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return 0;
  for (const item of rawData) {
    const monthlyCost = item.app.pricing
      ? parseFloat(item.app.pricing.price) || 0
      : null;

    const app = await prisma.app.upsert({
      where: {
        shopId_handle: { shopId: shop.id, handle: item.app.handle },
      },
      create: {
        id: item.app.id,
        shopId: shop.id,
        name: item.app.title,
        handle: item.app.handle,
        developerName: item.app.developerName,
        monthlyCost,
        billingInterval: item.app.pricing?.interval || null,
        installedAt: new Date(item.createdAt),
      },
      update: {
        name: item.app.title,
        developerName: item.app.developerName,
        monthlyCost,
        billingInterval: item.app.pricing?.interval || null,
      },
    });

    for (const scope of item.accessScopes) {
      const isHighRisk = HIGH_RISK_SCOPES.includes(scope.handle);

      await prisma.appPermission.upsert({
        where: {
          appId_scope: { appId: app.id, scope: scope.handle },
        },
        create: {
          appId: app.id,
          scope: scope.handle,
          isHighRisk,
        },
        update: {
          isHighRisk,
        },
      });
    }
  }

  return rawData.length;
}

export async function getCanonicalAppGraph(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { totalApps: 0, activeApps: 0, totalMonthlySpend: 0, totalHighRiskScopes: 0, appsByCategory: {}, apps: [] };
  const apps = await prisma.app.findMany({
    where: { shopId: shop.id },
    include: {
      permissions: true,
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
    orderBy: { installedAt: 'desc' },
  });

  const summary = {
    totalApps: apps.length,
    activeApps: apps.filter((a) => a.isActive).length,
    totalMonthlySpend: apps.reduce((sum, a) => sum + (a.monthlyCost || 0), 0),
    totalHighRiskScopes: apps.reduce(
      (sum, a) => sum + a.permissions.filter((p) => p.isHighRisk).length,
      0
    ),
    appsByCategory: apps.reduce<Record<string, number>>((acc, a) => {
      const cat = a.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {}),
    apps,
  };

  return summary;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Reviews: ['review', 'rating', 'testimonial'],
  SEO: ['seo', 'search', 'optimization', 'meta'],
  Marketing: ['marketing', 'email', 'campaign', 'social'],
  Shipping: ['shipping', 'fulfillment', 'delivery'],
  Analytics: ['analytics', 'report', 'insight', 'tracking'],
  Loyalty: ['loyalty', 'reward', 'points', 'referral'],
  'Customer Service': ['chat', 'support', 'service', 'ticket'],
  Inventory: ['inventory', 'stock', 'warehouse'],
  Sales: ['sales', 'upsell', 'cross-sell', 'discount', 'cart'],
  Design: ['theme', 'design', 'customize', 'landing'],
};

export function categorizeApp(appName: string, handle: string): string {
  const text = `${appName} ${handle}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return category;
    }
  }
  return 'Uncategorized';
}

export async function autoCategorizeApps(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return 0;
  const apps = await prisma.app.findMany({ where: { shopId: shop.id, category: null } });

  for (const app of apps) {
    const category = categorizeApp(app.name, app.handle);
    await prisma.app.update({
      where: { id: app.id },
      data: { category },
    });
  }

  return apps.length;
}
