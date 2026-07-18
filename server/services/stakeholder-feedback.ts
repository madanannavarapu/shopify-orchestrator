import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

export async function collectFeedback(
  shopDomain: string,
  data: {
    appId?: string;
    submittedBy: string;
    role?: string;
    response: string;
    severity?: string;
  }
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  const feedback = await prisma.stakeholderFeedback.create({
    data: {
      shopId: shop.id,
      appId: data.appId || null,
      submittedBy: data.submittedBy,
      role: data.role || null,
      question: 'What breaks?',
      response: data.response,
      severity: data.severity || 'info',
    },
  });

  await logEvidence(
    shopDomain,
    'stakeholder_feedback',
    `Feedback from ${data.submittedBy} (${data.role || 'unknown role'}): ${data.response.substring(0, 200)}`,
    data.submittedBy
  );

  return feedback;
}

export async function getFeedbackSummary(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { total: 0, critical: 0, warnings: 0, byApp: {}, overrides: [], recent: [] };

  const allFeedback = await prisma.stakeholderFeedback.findMany({
    where: { shopId: shop.id },
    include: { app: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const critical = allFeedback.filter((f) => f.severity === 'critical');
  const warnings = allFeedback.filter((f) => f.severity === 'warning');
  const byApp = allFeedback.reduce<Record<string, { count: number; critical: number }>>((acc, f) => {
    const key = f.app?.name || 'General';
    if (!acc[key]) acc[key] = { count: 0, critical: 0 };
    acc[key].count++;
    if (f.severity === 'critical') acc[key].critical++;
    return acc;
  }, {});

  const overrides = critical.filter((f) => f.appId).map((f) => ({
    appId: f.appId,
    appName: f.app?.name || 'Unknown',
    feedbackId: f.id,
    response: f.response,
    submittedBy: f.submittedBy,
    severity: f.severity,
  }));

  return {
    total: allFeedback.length,
    critical: critical.length,
    warnings: warnings.length,
    byApp,
    overrides,
    recent: allFeedback.slice(0, 20),
  };
}
