import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

// Four-Pillar Scoring: performance (1-5), cost (1-5), functionality (1-5), security/risk (1-5)
interface PillarScores {
  performance: number;  // 1 = heavy drag, 5 = lightweight
  cost: number;         // 1 = expensive with no value, 5 = good value
  functionality: number;// 1 = low/poor functionality, 5 = essential
  securityRisk: number; // 1 = high risk, 5 = secure/compliant
}

export interface ScoredApp {
  appId: string;
  appName: string;
  scores: PillarScores;
  overallScore: number;
  recommendation: 'Keep' | 'Consolidate' | 'Replace' | 'Cut';
}

export async function scoreApp(shopDomain: string, appId: string): Promise<ScoredApp> {
  const app = await prisma.app.findUnique({
    where: { id: appId },
    include: { permissions: true, events: true, pageSpeedImpacts: true },
  });

  if (!app) throw new Error('App not found');

  const scores = await computePillarScores(app, shopDomain);
  const weights = { performance: 0.25, cost: 0.25, functionality: 0.25, securityRisk: 0.25 };
  const overallScore =
    scores.performance * weights.performance +
    scores.cost * weights.cost +
    scores.functionality * weights.functionality +
    scores.securityRisk * weights.securityRisk;

  const recommendation = determineRecommendation(scores, overallScore, app);

  await prisma.appScoreHistory.create({
    data: {
      appId: app.id,
      performance: scores.performance,
      cost: scores.cost,
      functionality: scores.functionality,
      securityRisk: scores.securityRisk,
      overallScore,
      recommendation,
      scoredBy: 'rule',
    },
  });

  await prisma.app.update({
    where: { id: app.id },
    data: { performanceScore: scores.performance, recommendation },
  });

  await logEvidence(shopDomain, 'scoring', `App "${app.name}" scored: P=${scores.performance} C=${scores.cost} F=${scores.functionality} S=${scores.securityRisk} → ${recommendation}`, 'system');

  return { appId: app.id, appName: app.name, scores, overallScore, recommendation };
}

export async function scoreAllApps(shopDomain: string): Promise<ScoredApp[]> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true },
    include: { permissions: true, events: true, pageSpeedImpacts: true },
  });

  const results: ScoredApp[] = [];
  for (const app of apps) {
    const result = await scoreApp(shopDomain, app.id);
    results.push(result);
  }
  return results;
}

async function computePillarScores(app: any, shopDomain: string): Promise<PillarScores> {
  const performance = await scorePerformance(app);
  const cost = scoreCost(app);
  const functionality = scoreFunctionality(app);
  const securityRisk = await scoreSecurityRisk(app);
  return { performance, cost, functionality, securityRisk };
}

async function scorePerformance(app: any): Promise<number> {
  // Use PageSpeed impact data if available
  const latestImpact = app.pageSpeedImpacts?.[app.pageSpeedImpacts.length - 1];
  if (latestImpact?.score) return latestImpact.score;

  // Estimate based on permissions — more permissions = likely heavier
  const highRiskCount = app.permissions?.filter((p: any) => p.isHighRisk).length || 0;
  if (highRiskCount >= 5) return 2;
  if (highRiskCount >= 3) return 3;
  if (highRiskCount >= 1) return 4;
  return 5;
}

function scoreCost(app: any): number {
  const cost = app.monthlyCost || 0;
  if (cost === 0) return 5; // Free apps get 5
  if (cost <= 5) return 4;
  if (cost <= 15) return 3;
  if (cost <= 50) return 2;
  return 1;
}

function scoreFunctionality(app: any): number {
  // Apps used recently, with events, active = more functional value
  if (!app.isActive) return 1;

  const eventCount = app.events?.length || 0;
  const isRecent = app.lastUsedAt && (new Date().getTime() - new Date(app.lastUsedAt).getTime()) < 90 * 24 * 60 * 60 * 1000;

  if (isRecent && eventCount > 10) return 5;
  if (isRecent && eventCount > 0) return 4;
  if (eventCount > 5) return 3;
  if (eventCount > 0) return 2;
  return 1;
}

async function scoreSecurityRisk(app: any): Promise<number> {
  const highRiskScopes = app.permissions?.filter((p: any) => p.isHighRisk) || [];

  // Check for open compliance findings
  const openFindings = await prisma.complianceFinding.count({
    where: { appId: app.id, status: 'open' },
  });

  let score = 5;
  if (highRiskScopes.length >= 3) score -= 2;
  else if (highRiskScopes.length >= 1) score -= 1;
  if (openFindings > 0) score -= Math.min(openFindings, score - 1);
  if (!app.lastUsedAt && app.isActive) score -= 1; // active but never used = suspicious
  return Math.max(1, score);
}

function determineRecommendation(
  scores: PillarScores,
  overall: number,
  app: any
): 'Keep' | 'Consolidate' | 'Replace' | 'Cut' {
  // Cut: low performance, high cost, high risk, not used
  if (scores.cost <= 2 && scores.functionality <= 2 && scores.securityRisk <= 2) return 'Cut';
  if (scores.cost <= 1 && scores.functionality <= 1) return 'Cut';
  if (!app.isActive && scores.cost >= 1) return 'Cut';
  if (scores.securityRisk === 1) return 'Cut';

  // Replace: bad value and functionality but not critical risk
  if (scores.cost <= 2 && scores.functionality <= 2) return 'Replace';
  if (scores.performance <= 2 && scores.cost >= 3) return 'Replace';

  // Consolidate: OK scores but not great in any category, likely duplicate
  if (overall >= 2.5 && overall < 3.5) return 'Consolidate';

  // Keep: high scores across the board
  if (overall >= 3.5) return 'Keep';

  // Default
  return 'Consolidate';
}
