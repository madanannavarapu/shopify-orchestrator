import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

export async function setAppOwnership(
  shopDomain: string,
  appId: string,
  data: {
    ownerName: string;
    ownerEmail?: string;
    purpose: string;
    reviewCadence?: string;
  }
) {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error('App not found');

  const cadence = data.reviewCadence || 'quarterly';
  const now = new Date();
  const nextReview = calculateNextReview(now, cadence);

  const updated = await prisma.app.update({
    where: { id: appId },
    data: {
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail || null,
      ownerPurpose: data.purpose,
      reviewCadence: cadence,
      lastReviewedAt: now,
      nextReviewAt: nextReview,
    },
  });

  await logEvidence(
    shopDomain,
    'ownership_assigned',
    `Owner "${data.ownerName}" assigned to "${app.name}" — Purpose: ${data.purpose}, Review: ${cadence}`,
    data.ownerName
  );

  return updated;
}

export async function getAppsNeedingReview(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  const now = new Date();
  const apps = await prisma.app.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
      ownerName: { not: null },
      OR: [
        { nextReviewAt: { lte: now } },
        { nextReviewAt: null },
      ],
    },
  });

  return apps;
}

export async function getOrphanedApps(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  const apps = await prisma.app.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
      ownerName: null,
    },
  });

  return apps;
}

export async function completeReview(shopDomain: string, appId: string) {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) throw new Error('App not found');

  const cadence = app.reviewCadence || 'quarterly';
  const nextReview = calculateNextReview(new Date(), cadence);

  const updated = await prisma.app.update({
    where: { id: appId },
    data: {
      lastReviewedAt: new Date(),
      nextReviewAt: nextReview,
    },
  });

  await logEvidence(
    shopDomain,
    'review_completed',
    `Review completed for "${app.name}" — Next review: ${nextReview.toISOString()}`,
    app.ownerName || 'system'
  );

  return updated;
}

function calculateNextReview(from: Date, cadence: string): Date {
  const next = new Date(from);
  switch (cadence) {
    case 'monthly': next.setMonth(next.getMonth() + 1); break;
    case 'quarterly': next.setMonth(next.getMonth() + 3); break;
    case 'bi-annual': next.setMonth(next.getMonth() + 6); break;
    case 'annual': next.setFullYear(next.getFullYear() + 1); break;
    default: next.setMonth(next.getMonth() + 3);
  }
  return next;
}
