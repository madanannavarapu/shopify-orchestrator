import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';
import { scoreAllApps, ScoredApp } from './scoring-engine';

export type Decision = 'Keep' | 'Consolidate' | 'Replace' | 'Cut';

interface Recommendation {
  appId: string;
  appName: string;
  decision: Decision;
  rationale: string;
  savings: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependsOn?: string[]; // app IDs that need to be dealt with first
}

export async function generateRecommendations(shopDomain: string): Promise<Recommendation[]> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  // Score all apps first
  const scoredApps = await scoreAllApps(shopDomain);
  const recommendations: Recommendation[] = [];

  // Get existing context
  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true },
    include: { permissions: true, events: true, findings: { where: { status: 'open' } } },
  });

  // Get stakeholder feedback that overrides data-driven decisions
  const criticalFeedback = await prisma.stakeholderFeedback.findMany({
    where: { shopId: shop.id, severity: 'critical', appId: { not: null } },
  });
  const appsWithCriticalFeedback = new Set(criticalFeedback.map((f) => f.appId));

  // Get data conflicts
  const conflicts = await prisma.dataConflict.findMany({
    where: { shopId: shop.id, status: 'open' },
  });
  const conflictedAppIds = new Set<string>();
  conflicts.forEach((c) => { conflictedAppIds.add(c.appIdOne); conflictedAppIds.add(c.appIdTwo); });

  for (const scored of scoredApps) {
    const app = apps.find((a) => a.id === scored.appId);
    if (!app) continue;

    const decision = scored.recommendation as Decision;

    // If stakeholders say it breaks, override to Keep
    if (appsWithCriticalFeedback.has(app.id) && decision !== 'Keep') {
      recommendations.push({
        appId: app.id,
        appName: app.name,
        decision: 'Keep',
        rationale: `Overridden to Keep — stakeholder feedback reported critical breakage risk. Original score: ${scored.recommendation}`,
        savings: 0,
        priority: 'low',
      });
      continue;
    }

    const rationale = buildRationale(scored, app, conflictedAppIds);
    const savings = (decision === 'Cut' || decision === 'Replace') ? (app.monthlyCost || 0) : 0;
    const priority = decision === 'Cut' ? 'critical'
      : decision === 'Replace' ? 'high'
      : decision === 'Consolidate' ? 'medium'
      : 'low';

    const recommendation: Recommendation = {
      appId: app.id,
      appName: app.name,
      decision,
      rationale,
      savings,
      priority,
    };

    // If there are conflicts involving this app, note dependency
    const appConflicts = conflicts.filter((c) => c.appIdOne === app.id || c.appIdTwo === app.id);
    if (appConflicts.length > 0) {
      const relatedIds = appConflicts.map((c) =>
        c.appIdOne === app.id ? c.appIdTwo : c.appIdOne
      );
      recommendation.dependsOn = relatedIds;
    }

    recommendations.push(recommendation);

    // Create remediation action in DB
    await prisma.remediationAction.create({
      data: {
        shopId: shop.id,
        appId: app.id,
        actionType: decision.toLowerCase(),
        title: `${decision}: ${app.name}`,
        description: rationale,
        savings,
        status: 'proposed',
      },
    });
  }

  await logEvidence(
    shopDomain,
    'recommendations_generated',
    `Generated ${recommendations.length} recommendations (${recommendations.filter((r) => r.decision === 'Cut').length} Cut, ${recommendations.filter((r) => r.decision === 'Keep').length} Keep)`,
    'system'
  );

  return recommendations;
}

function buildRationale(scored: ScoredApp, app: any, conflictedAppIds: Set<string>): string {
  const parts: string[] = [];

  if (scored.scores.performance <= 2) parts.push('Heavy performance impact');
  if (scored.scores.cost <= 2) parts.push(`High cost: $${app.monthlyCost || 0}/mo with low value`);
  if (scored.scores.functionality <= 2) parts.push('Low usage — app may be redundant or unnecessary');
  if (scored.scores.securityRisk <= 2) parts.push('High security risk from permissions or open findings');
  if (conflictedAppIds.has(app.id)) parts.push('Causes data conflicts with other installed apps');

  if (parts.length === 0) parts.push('App scores well across all four pillars');
  if (scored.recommendation === 'Keep') parts.push('Essential app with good value and low risk');
  if (scored.recommendation === 'Consolidate') parts.push('Consider merging with similar apps');
  if (scored.recommendation === 'Replace') parts.push('Better alternatives likely exist');
  if (scored.recommendation === 'Cut') parts.push('No longer justified — remove to reduce cost and risk');

  return parts.join('. ') + '.';
}
