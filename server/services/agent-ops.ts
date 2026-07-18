import { prisma } from '../database';

export interface AgentExecutionInput {
  shopId: string;
  agentType: string;
  input?: any;
  parentExecutionId?: string;
}

export async function startAgentExecution(input: AgentExecutionInput) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: input.shopId } });
  if (!shop) throw new Error('Shop not found');

  return prisma.agentExecution.create({
    data: {
      shopId: shop.id,
      agentType: input.agentType,
      input: input.input ? JSON.stringify(input.input) : null,
      status: 'running',
      startedAt: new Date(),
      parentExecutionId: input.parentExecutionId,
    },
  });
}

export async function completeAgentExecution(
  id: string,
  output: any,
  meta?: { prompts?: string[]; toolCalls?: any[]; latencyMs?: number; costUsd?: number }
) {
  return prisma.agentExecution.update({
    where: { id },
    data: {
      status: 'completed',
      output: output ? JSON.stringify(output) : null,
      prompts: meta?.prompts ? JSON.stringify(meta.prompts) : undefined,
      toolCalls: meta?.toolCalls ? JSON.stringify(meta.toolCalls) : undefined,
      latencyMs: meta?.latencyMs,
      costUsd: meta?.costUsd,
      completedAt: new Date(),
    },
  });
}

export async function failAgentExecution(id: string, error: string) {
  return prisma.agentExecution.update({
    where: { id },
    data: { status: 'failed', error, completedAt: new Date() },
  });
}

export async function getAgentExecutionHistory(shopId: string, options?: { agentType?: string; limit?: number }) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopId } });
  if (!shop) return [];
  const where: any = { shopId: shop.id };
  if (options?.agentType) where.agentType = options.agentType;

  return prisma.agentExecution.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: options?.limit || 50,
  });
}

export async function getAgentOpsSummary(shopId: string) {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopId } });
  if (!shop) return { totalExecutions: 0, completed: 0, failed: 0, running: 0, byAgent: {}, totalCostUsd: 0 };
  const executions = await prisma.agentExecution.findMany({
    where: { shopId: shop.id },
  });

  const byAgent = executions.reduce<Record<string, { count: number; failed: number; avgLatency: number }>>((acc, e) => {
    if (!acc[e.agentType]) acc[e.agentType] = { count: 0, failed: 0, avgLatency: 0 };
    acc[e.agentType].count++;
    if (e.status === 'failed') acc[e.agentType].failed++;
    if (e.latencyMs) acc[e.agentType].avgLatency += e.latencyMs;
    return acc;
  }, {});

  for (const key of Object.keys(byAgent)) {
    byAgent[key].avgLatency = byAgent[key].count > 0
      ? Math.round(byAgent[key].avgLatency / byAgent[key].count)
      : 0;
  }

  return {
    totalExecutions: executions.length,
    completed: executions.filter((e) => e.status === 'completed').length,
    failed: executions.filter((e) => e.status === 'failed').length,
    running: executions.filter((e) => e.status === 'running').length,
    byAgent,
    totalCostUsd: executions.reduce((s, e) => s + (e.costUsd || 0), 0),
  };
}
