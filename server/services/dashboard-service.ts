import { prisma } from '../database';

export async function getDashboardSummary(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { overallScore: null, totalApps: 0, activeApps: 0, findings: { open: 0, high: 0, medium: 0, low: 0 }, consentCount: 0, dsrCount: 0, lastUpdated: new Date().toISOString() };

  const [apps, findings, latestSnapshot] = await Promise.all([
    prisma.app.findMany({ where: { shopId: shop.id } }),
    prisma.complianceFinding.findMany({ where: { app: { shopId: shop.id } } }),
    prisma.complianceScoreSnapshot.findFirst({ where: { shopId: shopDomain }, orderBy: { snapshotDate: 'desc' } }),
  ]);

  let consentCount = 0, dsrCount = 0;
  try { consentCount = await prisma.consentRecord.count({ where: { shopId: shopDomain } }); } catch {}
  try { dsrCount = await prisma.dataSubjectRequest.count({ where: { shopId: shopDomain } }); } catch {}

  const openFindings = findings.filter((f) => f.status === 'open');
  return {
    overallScore: latestSnapshot?.overallScore ?? null,
    totalApps: apps.length,
    activeApps: apps.filter((a) => a.isActive).length,
    findings: {
      open: openFindings.length,
      high: openFindings.filter((f) => f.severity === 'high').length,
      medium: openFindings.filter((f) => f.severity === 'medium').length,
      low: openFindings.filter((f) => f.severity === 'low').length,
    },
    consentCount,
    dsrCount,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getComplianceScore(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { overallScore: 0, breakdown: { apiVersion: 0, findings: 0, permissions: 0, performance: 0, privacy: 0 }, recommendations: ['Shop not found'] };

  const apiVersionScore = shop.apiVersion >= '2024-10' ? 100 : shop.apiVersion >= '2024-07' ? 75 : 50;

  const findings = await prisma.complianceFinding.findMany({ where: { app: { shopId: shop.id } } });
  const openFindings = findings.filter((f) => f.status === 'open').length;
  const findingsScore = Math.max(0, 100 - openFindings * 10);

  const apps = await prisma.app.findMany({ where: { shopId: shop.id }, include: { permissions: true } });
  const highRiskScopes = apps.reduce((sum, a) => sum + a.permissions.filter((p) => p.isHighRisk).length, 0);
  const permissionsScore = Math.max(0, 100 - highRiskScopes * 15);

  const latestPageSpeed = await prisma.pageSpeedResult.findFirst({ where: { shopId: shopDomain }, orderBy: { createdAt: 'desc' } });
  const performanceScore = latestPageSpeed?.performance ?? 50;

  let privacyScore = 50;
  try { const consentCount = await prisma.consentRecord.count({ where: { shopId: shopDomain } }); privacyScore = Math.min(100, 50 + consentCount * 5); } catch {}

  const overallScore = Math.round((apiVersionScore * 0.2 + findingsScore * 0.3 + permissionsScore * 0.2 + performanceScore * 0.15 + privacyScore * 0.15));

  const recommendations: string[] = [];
  if (apiVersionScore < 100) recommendations.push('Upgrade to the latest Shopify API version (2024-10)');
  if (findingsScore < 70) recommendations.push(`Resolve ${openFindings} open compliance findings`);
  if (permissionsScore < 70) recommendations.push(`Review ${highRiskScopes} high-risk app permissions`);
  if (performanceScore < 50) recommendations.push('Improve PageSpeed performance score');
  if (privacyScore < 50) recommendations.push('Collect more consent records to demonstrate privacy compliance');

  return { overallScore, breakdown: { apiVersion: apiVersionScore, findings: findingsScore, permissions: permissionsScore, performance: performanceScore, privacy: privacyScore }, recommendations };
}

const DEFAULT_CHECKLIST_ITEMS = [
  { category: 'data_protection', title: 'Data Protection', items: ['Privacy policy published', 'Cookie consent implemented', 'Data retention policy set'] },
  { category: 'app_governance', title: 'App Governance', items: ['App inventory documented', 'App ownership assigned', 'Regular review cadence set'] },
  { category: 'security', title: 'Security', items: ['HTTPS enforced', 'API key rotation scheduled', 'Access logs reviewed'] },
  { category: 'api_compliance', title: 'API Compliance', items: ['On latest Shopify API version', 'Webhook endpoints secured', 'OAuth scopes minimal'] },
  { category: 'privacy', title: 'Privacy', items: ['GDPR/CCPA compliance checked', 'DSR process documented', 'Consent records collected'] },
];

export async function getChecklist(shopDomain: string) {
  const existing = await prisma.complianceChecklistItem.findMany({ where: { shopId: shopDomain }, orderBy: { sortOrder: 'asc' } });
  if (existing.length === 0) {
    let sortOrder = 0;
    for (const cat of DEFAULT_CHECKLIST_ITEMS) {
      for (const title of cat.items) {
        await prisma.complianceChecklistItem.create({
          data: { shopId: shopDomain, category: cat.category, title, sortOrder: sortOrder++ },
        });
      }
    }
    const seeded = await prisma.complianceChecklistItem.findMany({ where: { shopId: shopDomain }, orderBy: { sortOrder: 'asc' } });
    return groupChecklist(seeded);
  }
  return groupChecklist(existing);
}

function groupChecklist(items: any[]) {
  const categories: any[] = [];
  const catMap = new Map<string, any>();
  for (const item of items) {
    if (!catMap.has(item.category)) {
      catMap.set(item.category, {
        category: item.category,
        title: DEFAULT_CHECKLIST_ITEMS.find((c) => c.category === item.category)?.title || item.category,
        items: [], done: 0, total: 0,
      });
      categories.push(catMap.get(item.category));
    }
    const group = catMap.get(item.category)!;
    group.items.push(item);
    group.total++;
    if (item.completed) group.done++;
  }
  const totalItems = items.length;
  const doneItems = items.filter((i) => i.completed).length;
  return { categories, overallProgress: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0 };
}

export async function updateChecklistItem(shopDomain: string, itemId: string, data: { completed?: boolean; score?: number }) {
  const updateData: any = {};
  if (data.completed !== undefined) { updateData.completed = data.completed; updateData.completedAt = data.completed ? new Date() : null; }
  if (data.score !== undefined) updateData.score = data.score;
  return prisma.complianceChecklistItem.update({ where: { id: itemId }, data: updateData });
}

export async function getScoreHistory(shopDomain: string, days: number = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let snapshots = await prisma.complianceScoreSnapshot.findMany({
    where: { shopId: shopDomain, snapshotDate: { gte: cutoff } },
    orderBy: { snapshotDate: 'asc' },
  });
  if (snapshots.length === 0) {
    const snapshot = await takeSnapshot(shopDomain);
    snapshots = [snapshot];
  }
  const history = snapshots.map((s) => ({ date: s.snapshotDate.toISOString(), score: s.overallScore }));
  const scores = snapshots.map((s) => s.overallScore);
  const avg_score = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (scores.length >= 4) {
    const half = Math.floor(scores.length / 2);
    const firstHalfAvg = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondHalfAvg = scores.slice(half).reduce((a, b) => a + b, 0) / (scores.length - half);
    if (secondHalfAvg > firstHalfAvg + 2) trend = 'improving';
    else if (secondHalfAvg < firstHalfAvg - 2) trend = 'declining';
  }
  return { history, stats: { avg_score, trend, data_points: scores.length } };
}

export async function takeSnapshot(shopDomain: string) {
  const score = await getComplianceScore(shopDomain);
  const checklist = await getChecklist(shopDomain);
  const checklistTotal = checklist.categories.reduce((s, c) => s + c.total, 0);
  const checklistDone = checklist.categories.reduce((s, c) => s + c.done, 0);
  return prisma.complianceScoreSnapshot.create({
    data: {
      shopId: shopDomain,
      overallScore: score.overallScore,
      dataProtection: score.breakdown.apiVersion,
      appGovernance: score.breakdown.permissions,
      securityScore: score.breakdown.findings,
      apiCompliance: score.breakdown.apiVersion,
      privacyScore: score.breakdown.privacy,
      checklistTotal,
      checklistDone,
      snapshotDate: new Date(),
    },
  });
}

export async function getPlatformStatus(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  let dbConnected = true;
  try { await prisma.$queryRaw`SELECT 1`; } catch { dbConnected = false; }
  return {
    shopify: {
      connected: !!shop,
      apiVersion: shop?.apiVersion || 'unknown',
      isCompliant: shop ? shop.apiVersion >= '2024-10' : false,
    },
    database: { connected: dbConnected },
    lastSync: new Date().toISOString(),
  };
}
