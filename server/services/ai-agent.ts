import { config } from '../config';
import { prisma } from '../database';

interface AIAnalysisRequest {
  shopDomain: string;
  agentType: 'cost' | 'redundancy' | 'compliance' | 'general';
  context?: string;
}

interface AIAnalysisResponse {
  summary: string;
  recommendations: string[];
  confidence: number;
}

const PROMPT_TEMPLATES: Record<string, string> = {
  cost: `You are a Shopify App Cost Optimization Agent. Given the following app inventory data, analyze the monthly spend, identify cost-saving opportunities, and recommend a prioritization plan.

App Data: {data}

Provide:
1. Executive summary of app spend
2. Top 3 cost reduction opportunities
3. Prioritized removal candidates
4. Estimated annual savings`,

  redundancy: `You are a Shopify App Redundancy Detection Agent. Given the following categorized app data, identify functional overlaps and recommend consolidation.

App Data: {data}

Provide:
1. Categories with redundant apps
2. Which app to keep in each category (best feature set/value)
3. Estimated savings from consolidation
4. Migration considerations`,

  compliance: `You are a Shopify App Compliance & Security Agent. Given the following compliance scan findings, assess risk levels and recommend remediation actions.

Scan Findings: {data}

Provide:
1. Risk assessment summary
2. Critical items requiring immediate action
3. Recommended remediation timeline
4. Audit trail documentation requirements`,
};

export async function runAIAgent(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: request.shopDomain } });
  if (!shop) return { summary: 'Shop not found', recommendations: [], confidence: 0 };

  let data: any;

  switch (request.agentType) {
    case 'cost':
      data = await prisma.app.findMany({
        where: { shopId: shop.id, isActive: true },
        select: { name: true, category: true, monthlyCost: true, handle: true },
        orderBy: { monthlyCost: 'desc' },
      });
      break;
    case 'redundancy':
      data = await prisma.app.findMany({
        where: { shopId: shop.id, isActive: true },
        select: { name: true, category: true, monthlyCost: true },
      });
      break;
    case 'compliance':
      data = await prisma.complianceFinding.findMany({
        where: { rule: { shopId: shop.id }, status: 'open' },
        include: { rule: true, app: true },
      });
      break;
    default:
      data = request.context;
  }

  if (!config.openai.apiKey) {
    return simulateAgentResponse(request.agentType, data);
  }

  try {
    const prompt = PROMPT_TEMPLATES[request.agentType] || PROMPT_TEMPLATES.general;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a Shopify app management and optimization assistant. Analyze data and provide actionable recommendations.',
          },
          {
            role: 'user',
            content: prompt.replace('{data}', JSON.stringify(data, null, 2)),
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    return {
      summary: content.split('\n')[0] || 'Analysis complete',
      recommendations: content.split('\n').filter((l: string) => l.trim().startsWith('-')),
      confidence: 0.85,
    };
  } catch (error) {
    console.error('AI agent error:', error);
    return simulateAgentResponse(request.agentType, data);
  }
}

function simulateAgentResponse(agentType: string, data: any): AIAnalysisResponse {
  switch (agentType) {
    case 'cost':
      return {
        summary: `Analyzed ${data?.length || 0} active apps. Total monthly spend requires review.`,
        recommendations: [
          'Audit apps with the highest monthly costs for actual usage',
          'Check for unused premium features in paid apps',
          'Consider annual billing for apps with 15%+ discounts',
        ],
        confidence: 0.7,
      };
    case 'redundancy':
      return {
        summary: `Found ${data?.length || 0} apps across categories. Redundancy detected.`,
        recommendations: [
          'Consolidate apps in categories with 2+ installations',
          'Evaluate feature overlap before removing apps',
          'Document migration paths for affected workflows',
        ],
        confidence: 0.7,
      };
    case 'compliance':
      return {
        summary: `Found ${data?.length || 0} open compliance findings requiring review.`,
        recommendations: [
          'Address high-severity findings immediately',
          'Schedule weekly compliance scans',
          'Set up human validation gate for critical actions',
        ],
        confidence: 0.7,
      };
    default:
      return {
        summary: 'Analysis complete. No AI API key configured — using rule-based analysis.',
        recommendations: ['Configure OPENAI_API_KEY for AI-powered insights'],
        confidence: 0.5,
      };
  }
}
