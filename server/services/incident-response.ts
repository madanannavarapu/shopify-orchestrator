import { prisma } from '../database';
import { logEvidence } from './compliance-evidence';

export async function createIncident(
  shopDomain: string,
  data: {
    incidentType: string;
    severity: string;
    title: string;
    description: string;
    source?: string;
    assignedTo?: string;
  }
) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return null;

  const incident = await prisma.incident.create({
    data: {
      shopId: shop.id,
      incidentType: data.incidentType,
      severity: data.severity,
      title: data.title,
      description: data.description,
      source: data.source || 'system',
      assignedTo: data.assignedTo,
    },
  });

  // Auto-escalate critical incidents
  if (data.severity === 'critical') {
    await prisma.incidentEscalation.create({
      data: {
        incidentId: incident.id,
        escalatedTo: 'admin',
        reason: 'Critical severity — auto-escalated',
      },
    });
  }

  await logEvidence(shopDomain, 'incident_created', `[${data.severity}] ${data.title}`, data.source || 'system');

  return incident;
}

export async function getOpenIncidents(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  return prisma.incident.findMany({
    where: { shopId: shop.id, status: { not: 'resolved' } },
    include: { escalations: { orderBy: { escalatedAt: 'desc' } } },
    orderBy: { detectedAt: 'desc' },
  });
}

export async function updateIncidentStatus(id: string, status: string, resolution?: string) {
  return prisma.incident.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === 'resolved' ? new Date() : undefined,
      resolution,
    },
  });
}

export async function escalateIncident(incidentId: string, escalatedTo: string, reason: string) {
  return prisma.incidentEscalation.create({
    data: { incidentId, escalatedTo, reason },
  });
}

export async function respondToEscalation(id: string, response: string) {
  return prisma.incidentEscalation.update({
    where: { id },
    data: { respondedAt: new Date(), response },
  });
}

export async function detectAbnormalAccess(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return [];

  // Check for apps with unusually high risk scores
  const apps = await prisma.app.findMany({
    where: { shopId: shop.id, isActive: true },
    include: { permissions: true },
  });

  const incidents: any[] = [];

  for (const app of apps) {
    const highRiskCount = app.permissions.filter((p) => p.isHighRisk).length;

    // Flag apps with 5+ high-risk scopes as abnormal
    if (highRiskCount >= 5) {
      const existing = await prisma.incident.findFirst({
        where: {
          shopId: shop.id,
          incidentType: 'abnormal_access',
          status: { not: 'resolved' },
        },
      });

      if (!existing) {
        const inc = await createIncident(shopDomain, {
          incidentType: 'abnormal_access',
          severity: 'high',
          title: `Abnormal access pattern: ${app.name}`,
          description: `App "${app.name}" has ${highRiskCount} high-risk permission scopes (${app.permissions.filter((p) => p.isHighRisk).map((p) => p.scope).join(', ')}). Review if all permissions are necessary.`,
          source: 'scanner',
        });
        incidents.push(inc);
      }
    }
  }

  return incidents;
}

export async function getIncidentSummary(shopDomain: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
  if (!shop) return { total: 0, open: 0, investigating: 0, contained: 0, resolved: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }, byType: {} };

  const incidents = await prisma.incident.findMany({ where: { shopId: shop.id } });

  return {
    total: incidents.length,
    open: incidents.filter((i) => i.status === 'open').length,
    investigating: incidents.filter((i) => i.status === 'investigating').length,
    contained: incidents.filter((i) => i.status === 'contained').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
    bySeverity: {
      critical: incidents.filter((i) => i.severity === 'critical').length,
      high: incidents.filter((i) => i.severity === 'high').length,
      medium: incidents.filter((i) => i.severity === 'medium').length,
      low: incidents.filter((i) => i.severity === 'low').length,
    },
    byType: incidents.reduce<Record<string, number>>((acc, i) => {
      acc[i.incidentType] = (acc[i.incidentType] || 0) + 1;
      return acc;
    }, {}),
  };
}
