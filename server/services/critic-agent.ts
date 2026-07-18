import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

interface CriticAssessment {
  agentType: string;
  status: 'pass' | 'warning' | 'fail';
  issues: string[];
  suggestions: string[];
}

export async function criticAgent(shopDomain: string, agentOutputs: Record<string, any>): Promise<{
  assessments: CriticAssessment[];
  overallStatus: 'pass' | 'warning' | 'fail';
  summary: string;
}> {
  const assessments: CriticAssessment[] = [];
  let hasWarnings = false;
  let hasFailures = false;

  // Cross-validate Inventory Agent output
  if (agentOutputs['inventory']) {
    const inv = agentOutputs['inventory'];
    const issues: string[] = [];
    if (inv.orphanedEntries && inv.orphanedEntries.length > 10) {
      issues.push(`High number of orphaned entries (${inv.orphanedEntries.length}) — may be false positives`);
      hasWarnings = true;
    }
    assessments.push({
      agentType: 'inventory',
      status: issues.length > 0 ? 'warning' : 'pass',
      issues,
      suggestions: issues.length > 0 ? ['Manually verify a sample of flagged orphaned apps before taking action'] : [],
    });
  }

  // Cross-validate Compliance Agent output
  if (agentOutputs['compliance']) {
    const comp = agentOutputs['compliance'];
    const issues: string[] = [];
    const criticalCount = (comp.gdprFindings || []).filter((f: any) => f.severity === 'critical').length
      + (comp.securityFindings || []).filter((f: any) => f.severity === 'critical').length;

    if (criticalCount > 0) {
      issues.push(`${criticalCount} critical findings require immediate attention`);
      hasFailures = true;
    }
    if (comp.gdprFindings && comp.gdprFindings.length > 0) {
      issues.push(`Verify GDPR webhooks are configured at the Shopify Partner level, not app level`);
      hasWarnings = true;
    }
    assessments.push({
      agentType: 'compliance',
      status: hasFailures ? 'fail' : hasWarnings ? 'warning' : 'pass',
      issues,
      suggestions: ['Cross-reference GDPR findings with actual Shopify webhook configuration in Partner dashboard'],
    });
  }

  // Cross-validate Redundancy Agent output
  if (agentOutputs['redundancy']) {
    const red = agentOutputs['redundancy'];
    const issues: string[] = [];
    if (red.length > 0) {
      // Check if redundancy recommendations conflict with stakeholder feedback
      const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
      const criticalFeedback = shop ? await prisma.stakeholderFeedback.findMany({
        where: { shopId: shop.id, severity: 'critical' },
      }) : [];
      const feedbackAppIds = new Set(criticalFeedback.map((f) => f.appId));
      const redundantAppIds = new Set(red.flatMap((r: any) => r.apps?.map((a: any) => a.id) || []));

      const conflictAppIds = [...redundantAppIds].filter((id) => feedbackAppIds.has(id as string));
      if (conflictAppIds.length > 0) {
        issues.push(`${conflictAppIds.length} apps flagged as redundant have critical stakeholder feedback — override to Keep`);
        hasWarnings = true;
      }
    }
    assessments.push({
      agentType: 'redundancy',
      status: issues.length > 0 ? 'warning' : 'pass',
      issues,
      suggestions: ['Stakeholder feedback overrides automated redundancy decisions'],
    });
  }

  // Cross-validate Cost Agent output
  if (agentOutputs['cost']) {
    const cost = agentOutputs['cost'];
    const issues: string[] = [];
    if (cost.topCostlyApps && cost.topCostlyApps.length > 0) {
      // Verify top costly apps actually have costs
      const zeroCost = cost.topCostlyApps.filter((a: any) => !a.cost || a.cost === 0);
      if (zeroCost.length > 0) {
        issues.push(`${zeroCost.length} top-costly apps have $0 cost — data may be incomplete`);
        hasWarnings = true;
      }
    }
    assessments.push({
      agentType: 'cost',
      status: issues.length > 0 ? 'warning' : 'pass',
      issues,
      suggestions: issues.length > 0 ? ['Manually verify billing data for apps with unknown costs'] : [],
    });
  }

  const overallStatus = hasFailures ? 'fail' : hasWarnings ? 'warning' : 'pass';
  const summary = `Critic cross-validated ${assessments.length} agents: ${assessments.filter((a) => a.status === 'pass').length} pass, ${assessments.filter((a) => a.status === 'warning').length} warnings, ${assessments.filter((a) => a.status === 'fail').length} failures`;

  await logEvidence(shopDomain, 'critic_validation', summary, 'critic-agent');

  return { assessments, overallStatus, summary };
}
