import { prisma } from '../database';

export async function getTemplates(shopDomain: string) {
  return prisma.consentTemplate.findMany({ where: { shopId: shopDomain } });
}

export async function createTemplate(shopDomain: string, data: any) {
  return prisma.consentTemplate.create({ data: { shopId: shopDomain, ...data } });
}

export async function updateTemplate(id: string, data: any) {
  return prisma.consentTemplate.update({ where: { id }, data });
}

export async function deleteTemplate(id: string) {
  return prisma.consentTemplate.delete({ where: { id } });
}

export async function getPurposes(shopDomain: string) {
  return prisma.consentPurpose.findMany({ where: { shopId: shopDomain }, orderBy: { sortOrder: 'asc' } });
}

export async function createPurpose(shopDomain: string, data: any) {
  return prisma.consentPurpose.create({ data: { shopId: shopDomain, ...data } });
}

export async function updatePurpose(id: string, data: any) {
  return prisma.consentPurpose.update({ where: { id }, data });
}

export async function seedPurposes(shopDomain: string) {
  const defaults = [
    { name: 'marketing', label: 'Marketing', description: 'Email marketing and promotional offers', sortOrder: 1 },
    { name: 'analytics', label: 'Analytics', description: 'Usage analytics and cookie tracking', sortOrder: 2, isRequired: true },
    { name: 'personalization', label: 'Personalization', description: 'Personalized shopping experience', sortOrder: 3 },
    { name: 'communication', label: 'Communication', description: 'Order updates and support communications', sortOrder: 4, isRequired: true },
    { name: 'social', label: 'Social Media', description: 'Social media integration and targeting', sortOrder: 5 },
  ];
  const existing = await prisma.consentPurpose.findMany({ where: { shopId: shopDomain }, select: { name: true } });
  const existingNames = new Set(existing.map((p) => p.name));
  const toCreate = defaults.filter((d) => !existingNames.has(d.name));
  for (const item of toCreate) {
    await prisma.consentPurpose.create({ data: { shopId: shopDomain, ...item } });
  }
}

export async function recordConsent(shopDomain: string, data: { customerId: string; email: string; purposeId: string; granted: boolean; source: string; ipAddress?: string; userAgent?: string }) {
  return prisma.consentRecord.create({ data: { shopId: shopDomain, ...data }, include: { purpose: true } });
}

export async function getRecords(shopDomain: string, params?: { customerId?: string; email?: string; purposeId?: string }) {
  const where: any = { shopId: shopDomain };
  if (params?.customerId) where.customerId = params.customerId;
  if (params?.email) where.email = params.email;
  if (params?.purposeId) where.purposeId = params.purposeId;
  return prisma.consentRecord.findMany({ where, include: { purpose: true }, orderBy: { consentedAt: 'desc' } });
}

export async function getRecord(id: string) {
  return prisma.consentRecord.findUnique({ where: { id }, include: { purpose: true } });
}

export async function getConsentStats(shopDomain: string) {
  const records = await prisma.consentRecord.findMany({ where: { shopId: shopDomain }, include: { purpose: true } });
  const total = records.length;
  const granted = records.filter((r) => r.granted).length;
  const declined = total - granted;
  const byPurposeMap = new Map<string, { name: string; granted: number; declined: number }>();
  for (const r of records) {
    const key = r.purpose.name;
    if (!byPurposeMap.has(key)) byPurposeMap.set(key, { name: r.purpose.label || r.purpose.name, granted: 0, declined: 0 });
    const entry = byPurposeMap.get(key)!;
    if (r.granted) entry.granted++; else entry.declined++;
  }
  return { total, granted, declined, byPurpose: Array.from(byPurposeMap.values()) };
}

export async function exportConsentRecords(shopDomain: string) {
  const records = await prisma.consentRecord.findMany({
    where: { shopId: shopDomain },
    include: { purpose: true },
    orderBy: { consentedAt: 'desc' },
  });
  return records.map((r) => ({
    id: r.id, customerId: r.customerId, email: r.email,
    purpose: r.purpose.label || r.purpose.name, granted: r.granted,
    source: r.source, consentedAt: r.consentedAt.toISOString(),
  }));
}

export async function getCustomerConsentStatus(shopDomain: string, customerId: string) {
  const records = await prisma.consentRecord.findMany({
    where: { shopId: shopDomain, customerId },
    include: { purpose: true },
    orderBy: { consentedAt: 'desc' },
  });
  const purposes = await prisma.consentPurpose.findMany({ where: { shopId: shopDomain, isActive: true } });
  const consentMap = new Map<string, { granted: boolean; consentedAt: string }>();
  for (const r of records) {
    consentMap.set(r.purpose.name, { granted: r.granted, consentedAt: r.consentedAt.toISOString() });
  }
  const consents = purposes.map((p) => ({
    purpose: p.label || p.name,
    granted: consentMap.get(p.name)?.granted ?? false,
    consentedAt: consentMap.get(p.name)?.consentedAt ?? new Date().toISOString(),
  }));
  const email = records[0]?.email || '';
  return { customerId, email, consents };
}

export async function updateCustomerConsent(shopDomain: string, customerId: string, data: { consents: { purposeId: string; granted: boolean }[] }) {
  const email = data.consents[0]?.purposeId ? '' : '';
  const results = [];
  for (const c of data.consents) {
    const record = await prisma.consentRecord.create({
      data: {
        shopId: shopDomain, customerId, email: data.consents[0]?.purposeId || '',
        purposeId: c.purposeId, granted: c.granted, source: 'customers_tab',
      },
    });
    results.push(record);
  }
  return getCustomerConsentStatus(shopDomain, customerId);
}

export async function getWidgetConfig(shopDomain: string) {
  const template = await prisma.consentTemplate.findFirst({ where: { shopId: shopDomain, isActive: true } });
  const purposes = await prisma.consentPurpose.findMany({ where: { shopId: shopDomain, isActive: true }, orderBy: { sortOrder: 'asc' } });
  return { template, purposes };
}

export async function previewWidget(data: { title: string; message: string; theme: string; position: string; buttonText: string; declineText: string }) {
  return { preview: true, ...data };
}
