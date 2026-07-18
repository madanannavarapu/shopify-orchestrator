import { prisma } from '../database';

interface CostAgentResult {
  totalMonthlySpend: number;
  totalAnnualSpend: number;
  topCostlyApps: { name: string; cost: number; handle: string }[];
  potentialSavings: number;
}

interface RedundancyAgentResult {
  category: string;
  apps: { id: string; name: string; monthlyCost: number | null }[];
  redundancyScore: number;
  recommendation: string;
  estimatedSavings: number;
}

export async function costAgent(shopDomain: string): Promise<CostAgentResult> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { totalMonthlySpend: 0, totalAnnualSpend: 0, topCostlyApps: [], potentialSavings: 0 };

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true, monthlyCost: { not: null } },
    orderBy: { monthlyCost: 'desc' },
  });

  const totalMonthlySpend = apps.reduce((sum, a) => sum + (a.monthlyCost || 0), 0);
  const topCostlyApps = apps.slice(0, 10).map((a) => ({
    name: a.name,
    handle: a.handle,
    cost: a.monthlyCost || 0,
  }));

  const redundantCategories = await redundancyAgent(shopDomain);
  const potentialSavings = redundantCategories.reduce((s, r) => s + r.estimatedSavings, 0);

  return {
    totalMonthlySpend,
    totalAnnualSpend: totalMonthlySpend * 12,
    topCostlyApps,
    potentialSavings,
  };
}

export async function redundancyAgent(shopDomain: string): Promise<RedundancyAgentResult[]> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true },
    include: { permissions: true },
  });

  const grouped = apps.reduce<Record<string, typeof apps>>((acc, app) => {
    const cat = app.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(app);
    return acc;
  }, {});

  const results: RedundancyAgentResult[] = [];

  for (const [category, categoryApps] of Object.entries(grouped)) {
    if (categoryApps.length < 2) continue;

    const sortedByCost = [...categoryApps].sort(
      (a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0)
    );

    const redundancyScore = Math.min((categoryApps.length - 1) / 3, 1);

    const keep = sortedByCost[0];
    const redundant = sortedByCost.slice(1);
    const estimatedSavings = redundant.reduce(
      (sum, app) => sum + (app.monthlyCost || 0),
      0
    );

    results.push({
      category,
      apps: categoryApps.map((a) => ({
        id: a.id,
        name: a.name,
        monthlyCost: a.monthlyCost,
      })),
      redundancyScore,
      recommendation: redundancyScore > 0.5
        ? `Consider consolidating from ${categoryApps.length} ${category} apps. Keep "${keep.name}" ($${keep.monthlyCost || 0}/mo) and remove ${redundant.map((a) => `"${a.name}"`).join(', ')}.`
        : `Low redundancy risk in ${category}.`,
      estimatedSavings,
    });
  }

  return results;
}

export async function generateRemediationRoadmap(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { summary: { totalMonthlySpend: 0, totalAnnualSpend: 0, potentialSavings: 0, redundantCategories: 0, proposedActions: 0 }, costAnalysis: null, redundancyAnalysis: [], proposedActions: [] };

  const costResult = await costAgent(shopDomain);
  const redundancyResults = await redundancyAgent(shopDomain);

  const actions = await prisma.remediationAction.findMany({
    where: { shopId: shop.id, status: 'proposed' },
  });

  return {
    summary: {
      totalMonthlySpend: costResult.totalMonthlySpend,
      totalAnnualSpend: costResult.totalAnnualSpend,
      potentialSavings: costResult.potentialSavings,
      redundantCategories: redundancyResults.length,
      proposedActions: actions.length,
    },
    costAnalysis: costResult,
    redundancyAnalysis: redundancyResults,
    proposedActions: actions,
  };
}

export async function proposeRemediationAction(
  shopDomain: string,
  data: {
    appId?: string;
    actionType: string;
    title: string;
    description?: string;
    savings?: number;
  }
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  return prisma.remediationAction.create({
    data: {
      shopId: shop.id,
      appId: data.appId,
      actionType: data.actionType,
      title: data.title,
      description: data.description,
      savings: data.savings,
    },
  });
}

export async function approveAction(actionId: string, approvedBy: string) {
  return prisma.remediationAction.update({
    where: { id: actionId },
    data: {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy,
    },
  });
}
