import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

interface NegotiationDraft {
  vendorName: string;
  currentCost: number;
  proposedCost: number;
  savings: number;
  message: string;
}

const NEGOTIATION_TEMPLATES = {
  reduction: `Dear {vendor} team,

We've been using {appName} on our Shopify store and value the {feature} capabilities.

We're currently reviewing our app stack and looking to optimize our monthly spend. Our team would like to continue using {appName}, but we need to align the pricing with our current usage patterns and budget.

We're hoping to discuss a {discount}% reduction on our current plan of {currentCost}/mo. We believe a revised rate of {proposedCost}/mo would better reflect our usage and commitment.

We'd love to continue the partnership and would appreciate your flexibility on pricing.

Best regards,
{storeName}`,

  annual: `Dear {vendor} team,

We've been using {appName} and would like to move to annual billing to secure a better rate.

Our current monthly cost is {currentCost}/mo. We're looking for an annual plan at approximately {proposedCost}/mo (a ~{discount}% discount), which would give us predictable pricing and save on processing fees for your team.

Please let us know if this is possible.

Best regards,
{storeName}`,
};

export async function draftNegotiationMessage(
  shopDomain: string,
  data: {
    appId?: string;
    vendorName: string;
    currentCost: number;
    targetSavings?: number;
    templateType?: 'reduction' | 'annual';
  }
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  const discount = data.targetSavings
    ? Math.round((data.targetSavings / data.currentCost) * 100)
    : 15;
  const proposedCost = data.targetSavings
    ? data.currentCost - data.targetSavings
    : Math.round(data.currentCost * (1 - discount / 100) * 100) / 100;

  const template = NEGOTIATION_TEMPLATES[data.templateType || 'reduction'];
  const storeName = shopDomain.replace('.myshopify.com', '');

  const draftText = template
    .replace(/{vendor}/g, data.vendorName)
    .replace(/{appName}/g, data.vendorName)
    .replace(/{feature}/g, 'Shopify')
    .replace(/{discount}/g, discount.toString())
    .replace(/{currentCost}/g, data.currentCost.toFixed(2))
    .replace(/{proposedCost}/g, proposedCost.toFixed(2))
    .replace(/{storeName}/g, storeName);

  const negotiation = await prisma.vendorNegotiation.create({
    data: {
      shopId: shop.id,
      appId: data.appId,
      vendorName: data.vendorName,
      currentCost: data.currentCost,
      proposedCost,
      savings: data.currentCost - proposedCost,
      status: 'draft',
      draftText,
    },
  });

  await logEvidence(
    shopDomain,
    'negotiation_drafted',
    `Drafted negotiation for ${data.vendorName}: $${data.currentCost} → $${proposedCost}/mo`,
    'system'
  );

  return negotiation;
}

export async function sendNegotiation(id: string) {
  return prisma.vendorNegotiation.update({
    where: { id },
    data: { status: 'sent', sentAt: new Date() },
  });
}

export async function updateNegotiationStatus(id: string, status: string) {
  const data: any = { status };
  if (status === 'accepted') data.acceptedAt = new Date();
  return prisma.vendorNegotiation.update({ where: { id }, data });
}

export async function getNegotiationsSummary(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { total: 0, totalSavings: 0, byStatus: {}, pending: [], negotiations: [] };

  const negotiations = await prisma.vendorNegotiation.findMany({
    where: { shopId: shop.id },
    include: { app: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return {
    total: negotiations.length,
    totalSavings: negotiations.filter((n) => n.status === 'accepted').reduce((s, n) => s + (n.savings || 0), 0),
    byStatus: negotiations.reduce<Record<string, number>>((acc, n) => {
      acc[n.status] = (acc[n.status] || 0) + 1;
      return acc;
    }, {}),
    pending: negotiations.filter((n) => n.status === 'draft' || n.status === 'sent'),
    negotiations,
  };
}
