import { prisma } from '../database';

interface RuleDefinition {
  name: string;
  description: string;
  condition: string;
  severity: string;
  evaluate: (apps: any[], shopDomain: string) => Promise<ComplianceFinding[]>;
}

interface ComplianceFinding {
  appId: string;
  appName: string;
  message: string;
  severity: string;
  ruleName: string;
}

const BUILT_IN_RULES: RuleDefinition[] = [
  {
    name: 'Unused High-Risk Apps',
    description: 'Flags apps with write permissions that have not been used in 90+ days',
    condition: 'IF app requests write_* scopes AND lastUsedAt > 90 days THEN flag as Cut candidate',
    severity: 'high',
    evaluate: async (apps) => {
      const findings: ComplianceFinding[] = [];
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      for (const app of apps) {
        const hasWriteScope = app.permissions?.some(
          (p: any) => p.scope.startsWith('write_') && p.isHighRisk
        );
        const isUnused = !app.lastUsedAt || new Date(app.lastUsedAt) < ninetyDaysAgo;

        if (hasWriteScope && isUnused) {
          findings.push({
            appId: app.id,
            appName: app.name,
            message: `"${app.name}" has write-level permissions but hasn't been used in 90+ days.`,
            severity: 'high',
            ruleName: 'Unused High-Risk Apps',
          });
        }
      }
      return findings;
    },
  },
  {
    name: 'Permission Scope Bloat',
    description: 'Flags apps that request more scopes than typical for their category',
    condition: 'IF app requests 3+ distinct high-risk scopes THEN flag for review',
    severity: 'medium',
    evaluate: async (apps) => {
      const findings: ComplianceFinding[] = [];
      for (const app of apps) {
        const highRiskScopes = app.permissions?.filter((p: any) => p.isHighRisk) || [];
        if (highRiskScopes.length >= 3) {
          findings.push({
            appId: app.id,
            appName: app.name,
            message: `"${app.name}" requests ${highRiskScopes.length} high-risk scopes (${highRiskScopes.map((p: any) => p.scope).join(', ')}). Consider reviewing necessity.`,
            severity: 'medium',
            ruleName: 'Permission Scope Bloat',
          });
        }
      }
      return findings;
    },
  },
  {
    name: 'Duplicate Category Apps',
    description: 'Flags categories with >2 apps that do the same thing',
    condition: 'IF 3+ apps share same category THEN flag redundancy',
    severity: 'low',
    evaluate: async (apps) => {
      const findings: ComplianceFinding[] = [];
      const grouped: Record<string, any[]> = {};
      for (const app of apps) {
        const cat = app.category || 'Uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(app);
      }
      for (const [cat, catApps] of Object.entries(grouped)) {
        if (catApps.length >= 3) {
          for (const app of catApps.slice(1)) {
            findings.push({
              appId: app.id,
              appName: app.name,
              message: `"${app.name}" is in "${cat}" with ${catApps.length} other apps. Potential redundancy.`,
              severity: 'low',
              ruleName: 'Duplicate Category Apps',
            });
          }
        }
      }
      return findings;
    },
  },
  {
    name: 'Zero-Usage Apps',
    description: 'Flags apps with no recorded usage events',
    condition: 'IF app has 0 events AND installed >30 days ago THEN flag as stale',
    severity: 'medium',
    evaluate: async (apps) => {
      const findings: ComplianceFinding[] = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const app of apps) {
        if (!app.events?.length && new Date(app.installedAt) < thirtyDaysAgo) {
          findings.push({
            appId: app.id,
            appName: app.name,
            message: `"${app.name}" has no recorded usage since installation ${new Date(app.installedAt).toLocaleDateString()}. Consider removing.`,
            severity: 'medium',
            ruleName: 'Zero-Usage Apps',
          });
        }
      }
      return findings;
    },
  },
];

export async function runBuiltInComplianceScan(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { scannedApps: 0, totalFindings: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0, findings: [] };

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id },
    include: { permissions: true, events: true },
  });

  const allFindings: ComplianceFinding[] = [];

  for (const rule of BUILT_IN_RULES) {
    const findings = await rule.evaluate(apps, shopDomain);
    allFindings.push(...findings);

    const dbRule = await prisma.complianceRule.upsert({
      where: { id: `${shop.id}-${rule.name}` },
      create: {
        id: `${shop.id}-${rule.name}`,
        shopId: shop.id,
        name: rule.name,
        description: rule.description,
        condition: rule.condition,
        severity: rule.severity,
      },
      update: {},
    });

    for (const finding of findings) {
      await prisma.complianceFinding.create({
        data: {
          ruleId: dbRule.id,
          appId: finding.appId,
          message: finding.message,
          severity: finding.severity,
        },
      });
    }
  }

  return {
    scannedApps: apps.length,
    totalFindings: allFindings.length,
    highSeverity: allFindings.filter((f) => f.severity === 'high').length,
    mediumSeverity: allFindings.filter((f) => f.severity === 'medium').length,
    lowSeverity: allFindings.filter((f) => f.severity === 'low').length,
    findings: allFindings,
  };
}

export async function approveFinding(findingId: string, approvedBy: string) {
  return prisma.complianceFinding.update({
    where: { id: findingId },
    data: {
      status: 'resolved',
      resolvedAt: new Date(),
      approvedAt: new Date(),
      approvedBy,
    },
  });
}

export async function getComplianceSummary(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { openFindings: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0, findings: [] };

  const findings = await prisma.complianceFinding.findMany({
    where: {
      rule: { shopId: shop.id },
      status: 'open',
    },
    include: { rule: true, app: true },
    orderBy: { flaggedAt: 'desc' },
  });

  return {
    openFindings: findings.length,
    highSeverity: findings.filter((f) => f.severity === 'high').length,
    mediumSeverity: findings.filter((f) => f.severity === 'medium').length,
    lowSeverity: findings.filter((f) => f.severity === 'low').length,
    findings: findings.map((f) => ({
      id: f.id,
      rule: f.rule.name,
      app: f.app.name,
      message: f.message,
      severity: f.severity,
      flaggedAt: f.flaggedAt,
    })),
  };
}
