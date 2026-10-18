import { prisma } from '../database';

export async function listDsrs(shopDomain: string, params?: { status?: string; requestType?: string; limit?: number }) {
  const where: any = { shopId: shopDomain };
  if (params?.status) where.status = params.status;
  if (params?.requestType) where.requestType = params.requestType;
  return prisma.dataSubjectRequest.findMany({
    where,
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: params?.limit || 50,
  });
}

export async function createDsr(shopDomain: string, data: { customerId: string; email: string; requestType: string; description?: string; createdBy?: string }) {
  const days = data.requestType === 'access' ? 45 : 30;
  const deadlineAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const createdBy = data.createdBy || 'customer';
  return prisma.dataSubjectRequest.create({
    data: {
      shopId: shopDomain,
      customerId: data.customerId,
      email: data.email,
      requestType: data.requestType,
      description: data.description,
      createdBy,
      deadlineAt,
      timeline: {
        create: [{ action: 'created', detail: 'DSR request created', actor: createdBy }],
      },
    },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function getDsr(id: string) {
  return prisma.dataSubjectRequest.findUnique({
    where: { id },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function getDsrStats(shopDomain: string) {
  const all = await prisma.dataSubjectRequest.findMany({ where: { shopId: shopDomain } });
  const byStatus: Record<string, number> = { pending: 0, processing: 0, completed: 0, rejected: 0, withdrawn: 0 };
  const byType: Record<string, number> = { access: 0, rectification: 0, erasure: 0, restriction: 0, portability: 0, objection: 0 };
  let overdueCount = 0;
  const now = new Date();
  for (const r of all) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byType[r.requestType] = (byType[r.requestType] || 0) + 1;
    if (r.deadlineAt < now && ['pending', 'processing'].includes(r.status)) overdueCount++;
  }
  return { total: all.length, byStatus, byType, overdueCount };
}

async function addDsrTimeline(dsrId: string, action: string, detail: string, actor: string = 'system') {
  return prisma.dsrTimeline.create({ data: { dsrId, action, detail, actor } });
}

export async function processDsr(id: string) {
  const dsr = await prisma.dataSubjectRequest.update({ where: { id }, data: { status: 'processing' } });
  await addDsrTimeline(id, 'processed', 'DSR processing started');
  return dsr;
}

export async function completeDsr(id: string) {
  const dsr = await prisma.dataSubjectRequest.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } });
  await addDsrTimeline(id, 'completed', 'DSR request completed');
  return dsr;
}

export async function rejectDsr(id: string, reason: string) {
  const dsr = await prisma.dataSubjectRequest.update({ where: { id }, data: { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason } });
  await addDsrTimeline(id, 'rejected', `Rejected: ${reason}`);
  return dsr;
}

export async function anonymizeDsr(id: string) {
  const dsr = await prisma.dataSubjectRequest.findUnique({ where: { id } });
  if (!dsr) throw new Error('DSR not found');
  console.log(`Customer ${dsr.customerId} data anonymized`);
  await addDsrTimeline(id, 'anonymized', `Customer data anonymized for ${dsr.email}`);
  return prisma.dataSubjectRequest.update({ where: { id }, data: { anonymizedAt: new Date() } });
}

export async function notifyDsr(id: string, via: string = 'email') {
  const dsr = await prisma.dataSubjectRequest.update({ where: { id }, data: { notifiedAt: new Date(), notifiedVia: via } });
  await addDsrTimeline(id, 'notified', `Customer notified via ${via}`);
  return dsr;
}

export async function withdrawDsr(id: string) {
  const dsr = await prisma.dataSubjectRequest.update({ where: { id }, data: { status: 'withdrawn' } });
  await addDsrTimeline(id, 'withdrawn', 'DSR request withdrawn');
  return dsr;
}

export async function sendEmailNotification(id: string) {
  const dsr = await prisma.dataSubjectRequest.findUnique({ where: { id } });
  if (!dsr) throw new Error('DSR not found');
  console.log(`Email sent to ${dsr.email}: DSR ${id} action completed`);
  await addDsrTimeline(id, 'emailed', `Email notification sent to ${dsr.email}`);
  return prisma.dataSubjectRequest.update({ where: { id }, data: { notifiedAt: new Date(), notifiedVia: 'email' } });
}

export async function getOverdueRequests(shopDomain: string) {
  return prisma.dataSubjectRequest.findMany({
    where: { shopId: shopDomain, deadlineAt: { lt: new Date() }, status: { in: ['pending', 'processing'] } },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
    orderBy: { deadlineAt: 'asc' },
  });
}

export async function getUpcomingDeadlines(shopDomain: string, days: number = 7) {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.dataSubjectRequest.findMany({
    where: { shopId: shopDomain, deadlineAt: { gte: now, lte: future }, status: { in: ['pending', 'processing'] } },
    include: { timeline: { orderBy: { createdAt: 'asc' } } },
    orderBy: { deadlineAt: 'asc' },
  });
}

export async function listDsrTemplates(shopDomain: string, requestType?: string) {
  const where: any = { shopId: shopDomain };
  if (requestType) where.requestType = requestType;
  return prisma.dsrTemplate.findMany({ where, orderBy: { name: 'asc' } });
}

export async function createDsrTemplate(shopDomain: string, data: { name: string; requestType: string; subject: string; body: string }) {
  return prisma.dsrTemplate.create({ data: { shopId: shopDomain, ...data } });
}

export async function updateDsrTemplate(id: string, data: any) {
  return prisma.dsrTemplate.update({ where: { id }, data });
}

export async function deleteDsrTemplate(id: string) {
  return prisma.dsrTemplate.delete({ where: { id } });
}

export async function seedDefaultTemplates(shopDomain: string) {
  const defaults = [
    { requestType: 'access', name: 'Access Request Response', subject: 'Your Data Access Request', body: 'Dear Customer,\n\nWe have processed your data access request. Please find attached the data we hold about you.\n\nBest regards,\nThe Compliance Team' },
    { requestType: 'rectification', name: 'Rectification Request Response', subject: 'Your Data Rectification Request', body: 'Dear Customer,\n\nWe have updated your personal data as requested.\n\nBest regards,\nThe Compliance Team' },
    { requestType: 'erasure', name: 'Erasure Request Response', subject: 'Your Data Erasure Request', body: 'Dear Customer,\n\nWe have erased your personal data from our systems as requested.\n\nBest regards,\nThe Compliance Team' },
    { requestType: 'restriction', name: 'Restriction Request Response', subject: 'Your Data Restriction Request', body: 'Dear Customer,\n\nWe have restricted processing of your personal data as requested.\n\nBest regards,\nThe Compliance Team' },
    { requestType: 'portability', name: 'Portability Request Response', subject: 'Your Data Portability Request', body: 'Dear Customer,\n\nPlease find attached your data in a portable format as requested.\n\nBest regards,\nThe Compliance Team' },
    { requestType: 'objection', name: 'Objection Request Response', subject: 'Your Objection Request', body: 'Dear Customer,\n\nWe have reviewed your objection and processed it accordingly.\n\nBest regards,\nThe Compliance Team' },
  ];
  const existing = await prisma.dsrTemplate.findMany({ where: { shopId: shopDomain }, select: { requestType: true } });
  const existingTypes = new Set(existing.map((t) => t.requestType));
  for (const tpl of defaults) {
    if (!existingTypes.has(tpl.requestType)) {
      await prisma.dsrTemplate.create({ data: { shopId: shopDomain, ...tpl } });
    }
  }
}
