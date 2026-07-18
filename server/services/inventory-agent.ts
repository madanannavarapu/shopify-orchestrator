import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

interface InventoryValidationResult {
  totalApps: number;
  activeApps: number;
  orphanedEntries: { appId: string; appName: string; reason: string }[];
  missingEntries: { expectedApp: string; reason: string }[];
  recommendations: string[];
}

export async function validateAppInventory(shopDomain: string): Promise<InventoryValidationResult> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { totalApps: 0, activeApps: 0, orphanedEntries: [], missingEntries: [], recommendations: [] };

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id },
    include: { permissions: true, events: true },
  });

  const orphanedEntries: InventoryValidationResult['orphanedEntries'] = [];
  const missingEntries: InventoryValidationResult['missingEntries'] = [];
  const recommendations: string[] = [];

  // Check for inactive apps still costing money
  for (const app of apps) {
    if (!app.isActive && (app.monthlyCost || 0) > 0) {
      orphanedEntries.push({
        appId: app.id,
        appName: app.name,
        reason: `Inactive but still costing $${app.monthlyCost}/mo`,
      });
      recommendations.push(`Remove inactive paid app "${app.name}" to save $${app.monthlyCost}/mo`);
    }
  }

  // Check for apps with no permissions (orphaned data)
  for (const app of apps) {
    if (app.permissions.length === 0 && app.isActive) {
      orphanedEntries.push({
        appId: app.id,
        appName: app.name,
        reason: 'Active but has no permission scopes — may be orphaned',
      });
    }
  }

  // Check for apps with no usage events in 90+ days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const app of apps) {
    if (!app.isActive) continue;
    const recentEvents = app.events.filter((e) => new Date(e.createdAt) > ninetyDaysAgo);
    if (recentEvents.length === 0 && app.permissions.length > 0) {
      orphanedEntries.push({
        appId: app.id,
        appName: app.name,
        reason: 'No usage events in 90+ days despite having permissions',
      });
    }
  }

  // Check for duplicate handles (shouldn't happen but verify)
  const handleCounts = new Map<string, number>();
  for (const app of apps) {
    handleCounts.set(app.handle, (handleCounts.get(app.handle) || 0) + 1);
  }
  for (const [handle, count] of handleCounts) {
    if (count > 1) {
      missingEntries.push({
        expectedApp: handle,
        reason: `Duplicate handle "${handle}" found ${count} times`,
      });
    }
  }

  // Check if total monthly spend is tracked
  const totalCost = apps.reduce((s, a) => s + (a.monthlyCost || 0), 0);
  const untrackedCost = apps.filter((a) => a.isActive && a.monthlyCost === null);
  if (untrackedCost.length > 0) {
    recommendations.push(`Track pricing for ${untrackedCost.length} apps with unknown monthly cost`);
  }

  await logEvidence(
    shopDomain,
    'inventory_validation',
    `Validated ${apps.length} apps: ${orphanedEntries.length} orphaned, ${missingEntries.length} missing`,
    'inventory-agent'
  );

  return {
    totalApps: apps.length,
    activeApps: apps.filter((a) => a.isActive).length,
    orphanedEntries,
    missingEntries,
    recommendations,
  };
}
