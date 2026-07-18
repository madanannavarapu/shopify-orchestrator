import { prisma } from '../database';

export async function logEvidence(
  shopDomain: string,
  eventType: string,
  details: string,
  actor?: string
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  return prisma.complianceEvidence.create({
    data: {
      shopId: shop.id,
      eventType,
      action: eventType,
      details,
      actor: actor || 'system',
      immutable: true,
    },
  });
}

export async function getEvidenceLog(
  shopDomain: string,
  options?: {
    eventType?: string;
    limit?: number;
    offset?: number;
  }
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { items: [], total: 0 };

  const where: any = { shopId: shop.id };
  if (options?.eventType) where.eventType = options.eventType;

  const [items, total] = await Promise.all([
    prisma.complianceEvidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    }),
    prisma.complianceEvidence.count({ where }),
  ]);

  return { items, total };
}

export async function getAuditReport(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { summary: { totalEvents: 0, byType: {}, dateRange: null }, evidence: [] };

  const evidence = await prisma.complianceEvidence.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: 'asc' },
  });

  const summary = {
    totalEvents: evidence.length,
    byType: evidence.reduce<Record<string, number>>((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {}),
    dateRange: evidence.length > 0
      ? { from: evidence[0].createdAt, to: evidence[evidence.length - 1].createdAt }
      : null,
  };

  return { summary, evidence };
}
