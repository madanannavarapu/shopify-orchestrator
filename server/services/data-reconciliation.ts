import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

const CONFLICT_PATTERNS: { type: string; keywords: string[] }[] = [
  { type: 'inventory', keywords: ['inventory', 'stock', 'warehouse', 'fulfillment'] },
  { type: 'reporting', keywords: ['analytics', 'report', 'dashboard', 'insight'] },
  { type: 'pricing', keywords: ['pricing', 'price', 'discount', 'sales'] },
  { type: 'notifications', keywords: ['notification', 'alert', 'push', 'email'] },
  { type: 'customer_data', keywords: ['customer', 'crm', 'loyalty', 'profile'] },
];

export async function detectDataConflicts(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { totalConflicts: 0, newConflicts: 0, conflicts: [] };

  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true },
    include: { permissions: true },
  });

  const conflicts: {
    appIdOne: string;
    appIdTwo: string;
    conflictType: string;
    description: string;
    severity: string;
  }[] = [];

  // Find apps in same category (potential overlap conflicts)
  const categorized = apps.reduce<Record<string, typeof apps>>((acc, app) => {
    const cat = app.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(app);
    return acc;
  }, {});

  for (const [, categoryApps] of Object.entries(categorized)) {
    if (categoryApps.length < 2) continue;

    // Check each pair in the same category
    for (let i = 0; i < categoryApps.length; i++) {
      for (let j = i + 1; j < categoryApps.length; j++) {
        const appA = categoryApps[i];
        const appB = categoryApps[j];

        // Check for conflicting permission overlaps (both have write_* on same domain)
        const aWriteScopes = appA.permissions.filter((p) => p.scope.startsWith('write_'));
        const bWriteScopes = appB.permissions.filter((p) => p.scope.startsWith('write_'));
        const overlappingWrite = aWriteScopes.filter((a) =>
          bWriteScopes.some((b) => b.scope === a.scope)
        );

        if (overlappingWrite.length > 0) {
          const conflictType = appA.category?.toLowerCase().includes('inventory') ? 'inventory'
            : appA.category?.toLowerCase().includes('analytics') ? 'reporting'
            : appA.category?.toLowerCase().includes('pricing') ? 'pricing'
            : 'reporting';

          conflicts.push({
            appIdOne: appA.id,
            appIdTwo: appB.id,
            conflictType,
            description: `"${appA.name}" and "${appB.name}" both have write access to: ${overlappingWrite.map((s) => s.scope).join(', ')}. This can cause conflicting data, missed orders, or chargebacks.`,
            severity: overlappingWrite.length >= 3 ? 'high' : 'medium',
          });
        }
      }
    }
  }

  // Save conflicts to database
  let savedCount = 0;
  for (const conflict of conflicts) {
    // Check if this conflict pair already exists
    const existing = await prisma.dataConflict.findFirst({
      where: {
        shopId: shop.id,
        OR: [
          { appIdOne: conflict.appIdOne, appIdTwo: conflict.appIdTwo },
          { appIdOne: conflict.appIdTwo, appIdTwo: conflict.appIdOne },
        ],
        conflictType: conflict.conflictType,
        status: 'open',
      },
    });

    if (!existing) {
      await prisma.dataConflict.create({
        data: {
          shopId: shop.id,
          ...conflict,
        },
      });
      savedCount++;
    }
  }

  await logEvidence(
    shopDomain,
    'data_reconciliation',
    `Detected ${savedCount} new data conflicts across ${apps.length} apps`,
    'system'
  );

  return { totalConflicts: conflicts.length, newConflicts: savedCount, conflicts };
}

export async function getDataConflicts(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  return prisma.dataConflict.findMany({
    where: { shopId: shop.id },
    include: {
      appOne: { select: { name: true, category: true } },
      appTwo: { select: { name: true, category: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveConflict(conflictId: string) {
  const conflict = await prisma.dataConflict.update({
    where: { id: conflictId },
    data: { status: 'resolved', resolvedAt: new Date() },
  });

  return conflict;
}
