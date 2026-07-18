import { prisma } from '../database';
import { startAgentExecution, completeAgentExecution, failAgentExecution } from './agent-ops';
import { logEvidence } from './compliance-evidence';

interface ChainStep {
  agentType: string;
  execute: (context: ChainContext) => Promise<any>;
  dependsOn?: string[];
}

interface ChainContext {
  shopId: string;
  data: Record<string, any>;
  executionIds: string[];
  errors: string[];
}

export class ChainOfPrompts {
  private steps: ChainStep[] = [];
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  addStep(step: ChainStep) {
    this.steps.push(step);
    return this;
  }

  async execute(initialData?: Record<string, any>): Promise<ChainContext> {
    const context: ChainContext = {
      shopId: this.shopId,
      data: initialData || {},
      executionIds: [],
      errors: [],
    };

    const startTime = Date.now();

    for (const step of this.steps) {
      // Check dependencies
      if (step.dependsOn) {
        const missing = step.dependsOn.filter((dep) => !context.data[dep]);
        if (missing.length > 0) {
          const err = `Step "${step.agentType}" waiting for: ${missing.join(', ')}`;
          context.errors.push(err);
          continue;
        }
      }

      const execution = await startAgentExecution({
        shopId: this.shopId,
        agentType: step.agentType,
        input: { contextData: Object.keys(context.data) },
        parentExecutionId: context.executionIds[context.executionIds.length - 1],
      });

      context.executionIds.push(execution.id);

      try {
        const stepStart = Date.now();
        const result = await step.execute(context);
        const latency = Date.now() - stepStart;

        context.data[step.agentType] = result;

        await completeAgentExecution(execution.id, result, {
          latencyMs: latency,
          prompts: [`Chain step: ${step.agentType}`],
        });
      } catch (error: any) {
        await failAgentExecution(execution.id, error.message);
        context.errors.push(`${step.agentType}: ${error.message}`);
      }
    }

    await logEvidence(
      this.shopId,
      'chain_execution',
      `Chain executed ${this.steps.length} steps in ${Date.now() - startTime}ms with ${context.errors.length} errors`,
      'system'
    );

    return context;
  }
}

export function createDefaultAuditChain(shopId: string) {
  const chain = new ChainOfPrompts(shopId);

  chain.addStep({
    agentType: 'inventory',
    execute: async (ctx) => {
      const { validateAppInventory } = await import('./inventory-agent');
      return validateAppInventory(shopId);
    },
  });

  chain.addStep({
    agentType: 'compliance',
    dependsOn: ['inventory'],
    execute: async (ctx) => {
      const { runComplianceAgent } = await import('./compliance-agent');
      return runComplianceAgent(shopId);
    },
  });

  chain.addStep({
    agentType: 'redundancy',
    dependsOn: ['inventory'],
    execute: async (ctx) => {
      const { redundancyAgent } = await import('./remediation');
      return redundancyAgent(shopId);
    },
  });

  chain.addStep({
    agentType: 'cost',
    dependsOn: ['inventory'],
    execute: async (ctx) => {
      const { costAgent } = await import('./remediation');
      return costAgent(shopId);
    },
  });

  chain.addStep({
    agentType: 'critic',
    dependsOn: ['inventory', 'compliance', 'redundancy', 'cost'],
    execute: async (ctx) => {
      const { criticAgent } = await import('./critic-agent');
      return criticAgent(shopId, ctx.data);
    },
  });

  return chain;
}
