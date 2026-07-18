import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

interface PageSpeedResponse {
  lighthouseResult: {
    categories: {
      performance: { score: number | null };
      accessibility: { score: number | null };
      'best-practices': { score: number | null };
      seo: { score: number | null };
    };
  };
}

export async function runPageSpeedCheck(shopDomain: string, storeUrl: string) {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(storeUrl)}&category=performance&category=accessibility&category=best-practices&category=seo&strategy=mobile`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`PageSpeed API error: ${response.status}`);
    }

    const data: PageSpeedResponse = await response.json();
    const categories = data.lighthouseResult?.categories;

    const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
    if (!shop) return null;

    const result = await prisma.pageSpeedResult.create({
      data: {
        shopId: shop.id,
        url: storeUrl,
        performance: categories?.performance?.score ?? null,
        accessibility: categories?.accessibility?.score ?? null,
        bestPractices: categories?.['best-practices']?.score ?? null,
        seo: categories?.seo?.score ?? null,
        fullJson: JSON.stringify(data),
      },
    });

    await logEvidence(shopDomain, 'performance_scan', `PageSpeed scan completed for ${storeUrl}: perf=${result.performance}`, 'system');

    return result;
  } catch (error: any) {
    console.error('PageSpeed check failed:', error.message);
    return null;
  }
}

interface AppScriptTag {
  src: string;
  appId: string;
  appName: string;
}

export async function estimateAppPerformanceImpact(
  shopDomain: string,
  pageSpeedResultId: string,
  installedApps: { id: string; name: string; handle: string }[]
) {
  const pageSpeed = await prisma.pageSpeedResult.findUnique({ where: { id: pageSpeedResultId } });
  if (!pageSpeed || pageSpeed.performance === null) return [];

  const basePerformance = pageSpeed.performance;
  const impacts: { appId: string; score: number; performanceHit: number }[] = [];

  // Estimate impact per app based on number of high-risk permissions
  // (proxy for app complexity/weight)
  for (const app of installedApps) {
    const fullApp = await prisma.app.findUnique({
      where: { id: app.id },
      include: { permissions: true },
    });

    if (!fullApp) continue;

    const highRiskCount = fullApp.permissions.filter((p) => p.isHighRisk).length;
    const totalScopes = fullApp.permissions.length;

    // heuristic: each high-risk scope = ~2% performance hit, each scope = ~0.5%
    const estimatedHit = (highRiskCount * 0.02 + totalScopes * 0.005) * 100;
    const cappedHit = Math.min(estimatedHit, 80);

    let score = 5;
    if (cappedHit > 30) score = 1;
    else if (cappedHit > 20) score = 2;
    else if (cappedHit > 10) score = 3;
    else if (cappedHit > 5) score = 4;

    await prisma.appPageSpeedImpact.create({
      data: {
        appId: app.id,
        pageSpeedId: pageSpeedResultId,
        performanceHit: cappedHit,
        score,
      },
    });

    await prisma.app.update({
      where: { id: app.id },
      data: { performanceScore: score },
    });

    impacts.push({ appId: app.id, score, performanceHit: cappedHit });
  }

  return impacts;
}
