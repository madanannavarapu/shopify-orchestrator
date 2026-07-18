import { Router, Request, Response } from 'express';
import { validateSession } from '../middleware/validate-session';
import {
  runBuiltInComplianceScan,
  getComplianceSummary,
  approveFinding,
} from '../services/compliance-scanner';
import { generateRemediationRoadmap, proposeRemediationAction, approveAction } from '../services/remediation';
import { runAIAgent } from '../services/ai-agent';
import { scoreAllApps, scoreApp } from '../services/scoring-engine';
import { runPageSpeedCheck, estimateAppPerformanceImpact } from '../services/performance-scoring';
import { setAppOwnership, getAppsNeedingReview, getOrphanedApps, completeReview } from '../services/ownership-tracking';
import { collectFeedback, getFeedbackSummary } from '../services/stakeholder-feedback';
import { detectDataConflicts, getDataConflicts, resolveConflict } from '../services/data-reconciliation';
import { getEvidenceLog, getAuditReport } from '../services/compliance-evidence';
import { generateRecommendations } from '../services/recommendation-agent';
import { prisma } from '../database';

const router = Router();

// --- Existing Compliance routes ---
router.get('/api/compliance/scan', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const results = await runBuiltInComplianceScan(shopDomain);
    res.json(results);
  } catch (error) {
    console.error('Compliance scan error:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

router.get('/api/compliance/summary', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const summary = await getComplianceSummary(shopDomain);
    res.json(summary);
  } catch (error) {
    console.error('Compliance summary error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

router.post('/api/compliance/findings/:id/approve', validateSession, async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    const finding = await approveFinding(req.params.id as string, approvedBy || 'merchant');
    res.json(finding);
  } catch (error) {
    console.error('Approve finding error:', error);
    res.status(500).json({ error: 'Failed to approve finding' });
  }
});

router.get('/api/remediation/roadmap', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const roadmap = await generateRemediationRoadmap(shopDomain);
    res.json(roadmap);
  } catch (error) {
    console.error('Roadmap generation error:', error);
    res.status(500).json({ error: 'Failed to generate roadmap' });
  }
});

router.post('/api/remediation/propose', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const action = await proposeRemediationAction(shopDomain, req.body);
    res.json(action);
  } catch (error) {
    console.error('Propose action error:', error);
    res.status(500).json({ error: 'Failed to propose action' });
  }
});

router.post('/api/remediation/actions/:id/approve', validateSession, async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    const action = await approveAction(req.params.id as string, approvedBy || 'merchant');
    res.json(action);
  } catch (error) {
    console.error('Approve action error:', error);
    res.status(500).json({ error: 'Failed to approve action' });
  }
});

router.post('/api/ai/analyze', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { agentType, context } = req.body;
    const result = await runAIAgent({ shopDomain, agentType, context });
    res.json(result);
  } catch (error) {
    console.error('AI agent error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

router.get('/api/version-compliance', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const currentApiVersion = shop.apiVersion;
    const latestVersion = '2024-10';
    const versionNum = (v: string) => parseInt(v.replace(/[^\d]/g, ''));
    const isCompliant = versionNum(currentApiVersion) >= versionNum(latestVersion);
    const versionsBehind = versionNum(latestVersion) - versionNum(currentApiVersion);

    res.json({
      shop: shop.myshopifyDomain,
      currentApiVersion,
      latestVersion,
      isCompliant,
      versionsBehind: Math.max(0, versionsBehind),
      lastChecked: new Date().toISOString(),
      recommendation: isCompliant
        ? 'API version is up to date'
        : `Upgrade from ${currentApiVersion} to ${latestVersion}`,
      supportedVersions: ['2024-10', '2024-07', '2024-04', '2024-01'],
    });
  } catch (error) {
    console.error('Version compliance error:', error);
    res.status(500).json({ error: 'Failed to check version compliance' });
  }
});

// --- Four-Pillar Scoring Engine ---
router.post('/api/scoring/score-all', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const results = await scoreAllApps(shopDomain);
    res.json({ scored: results.length, results });
  } catch (error) {
    console.error('Scoring error:', error);
    res.status(500).json({ error: 'Scoring failed' });
  }
});

router.post('/api/scoring/score/:appId', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const result = await scoreApp(shopDomain, req.params.appId as string);
    res.json(result);
  } catch (error) {
    console.error('Scoring error:', error);
    res.status(500).json({ error: 'Scoring failed' });
  }
});

// --- Performance Scoring (PageSpeed) ---
router.post('/api/performance/pagespeed', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const storeUrl = req.body.url || `https://${shopDomain}`;
    const result = await runPageSpeedCheck(shopDomain, storeUrl);
    if (!result) return res.status(502).json({ error: 'PageSpeed API unavailable' });

    const apps = await prisma.app.findMany({ where: { shopId: shopDomain, isActive: true } });
    const impacts = await estimateAppPerformanceImpact(shopDomain, result.id, apps);

    res.json({ pagespeed: result, impacts });
  } catch (error) {
    console.error('PageSpeed error:', error);
    res.status(500).json({ error: 'PageSpeed check failed' });
  }
});

// --- App Ownership & Accountability ---
router.post('/api/ownership/set', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { appId, ownerName, ownerEmail, purpose, reviewCadence } = req.body;
    const result = await setAppOwnership(shopDomain, appId, { ownerName, ownerEmail, purpose, reviewCadence });
    res.json(result);
  } catch (error) {
    console.error('Ownership error:', error);
    res.status(500).json({ error: 'Failed to set ownership' });
  }
});

router.get('/api/ownership/needs-review', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const apps = await getAppsNeedingReview(shopDomain);
    res.json({ count: apps.length, apps });
  } catch (error) {
    console.error('Review check error:', error);
    res.status(500).json({ error: 'Failed to check reviews' });
  }
});

router.get('/api/ownership/orphaned', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const apps = await getOrphanedApps(shopDomain);
    res.json({ count: apps.length, apps });
  } catch (error) {
    console.error('Orphaned check error:', error);
    res.status(500).json({ error: 'Failed to check orphaned apps' });
  }
});

router.post('/api/ownership/review/:appId', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const result = await completeReview(shopDomain, req.params.appId as string);
    res.json(result);
  } catch (error) {
    console.error('Review complete error:', error);
    res.status(500).json({ error: 'Failed to complete review' });
  }
});

// --- Stakeholder Feedback ---
router.post('/api/feedback/submit', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const result = await collectFeedback(shopDomain, req.body);
    res.json(result);
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

router.get('/api/feedback/summary', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const summary = await getFeedbackSummary(shopDomain);
    res.json(summary);
  } catch (error) {
    console.error('Feedback summary error:', error);
    res.status(500).json({ error: 'Failed to get feedback summary' });
  }
});

// --- Data Reconciliation ---
router.post('/api/conflicts/detect', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const result = await detectDataConflicts(shopDomain);
    res.json(result);
  } catch (error) {
    console.error('Conflict detection error:', error);
    res.status(500).json({ error: 'Failed to detect conflicts' });
  }
});

router.get('/api/conflicts', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const conflicts = await getDataConflicts(shopDomain);
    res.json({ count: conflicts.length, conflicts });
  } catch (error) {
    console.error('Get conflicts error:', error);
    res.status(500).json({ error: 'Failed to get conflicts' });
  }
});

router.post('/api/conflicts/:id/resolve', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await resolveConflict(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Resolve conflict error:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

// --- Compliance Evidence Store ---
router.get('/api/evidence', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { eventType, limit, offset } = req.query;
    const result = await getEvidenceLog(shopDomain, {
      eventType: eventType as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Evidence log error:', error);
    res.status(500).json({ error: 'Failed to get evidence log' });
  }
});

router.get('/api/evidence/audit-report', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const report = await getAuditReport(shopDomain);
    res.json(report);
  } catch (error) {
    console.error('Audit report error:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

// --- Recommendation Agent ---
router.post('/api/recommendations/generate', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const recommendations = await generateRecommendations(shopDomain);
    res.json({ count: recommendations.length, recommendations });
  } catch (error) {
    console.error('Recommendation generation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// --- AgentOps Tracing ---
router.get('/api/agent-ops/summary', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { getAgentOpsSummary } = await import('../services/agent-ops');
    const summary = await getAgentOpsSummary(shopDomain);
    res.json(summary);
  } catch (error) {
    console.error('AgentOps error:', error);
    res.status(500).json({ error: 'Failed to get agent ops summary' });
  }
});

router.get('/api/agent-ops/history', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { getAgentExecutionHistory } = await import('../services/agent-ops');
    const { agentType, limit } = req.query;
    const history = await getAgentExecutionHistory(shopDomain, {
      agentType: agentType as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ count: history.length, history });
  } catch (error) {
    console.error('AgentOps history error:', error);
    res.status(500).json({ error: 'Failed to get agent history' });
  }
});

// --- Chain-of-Prompts ---
router.post('/api/chain/run-audit', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { createDefaultAuditChain } = await import('../services/chain-of-prompts');
    const chain = createDefaultAuditChain(shopDomain);
    const result = await chain.execute();
    res.json({
      steps: Object.keys(result.data),
      errors: result.errors,
      executionIds: result.executionIds,
      data: result.data,
    });
  } catch (error) {
    console.error('Chain execution error:', error);
    res.status(500).json({ error: 'Chain execution failed' });
  }
});

// --- Inventory Agent ---
router.post('/api/agents/inventory', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { validateAppInventory } = await import('../services/inventory-agent');
    const result = await validateAppInventory(shopDomain);
    res.json(result);
  } catch (error) {
    console.error('Inventory agent error:', error);
    res.status(500).json({ error: 'Inventory agent failed' });
  }
});

// --- Compliance Agent ---
router.post('/api/agents/compliance', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { runComplianceAgent } = await import('../services/compliance-agent');
    const result = await runComplianceAgent(shopDomain);
    res.json(result);
  } catch (error) {
    console.error('Compliance agent error:', error);
    res.status(500).json({ error: 'Compliance agent failed' });
  }
});

// --- Critic Agent ---
router.post('/api/agents/critic', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { criticAgent } = await import('../services/critic-agent');
    const agentOutputs = req.body.agentOutputs || {};
    const result = await criticAgent(shopDomain, agentOutputs);
    res.json(result);
  } catch (error) {
    console.error('Critic agent error:', error);
    res.status(500).json({ error: 'Critic agent failed' });
  }
});

// --- Query Router ---
router.post('/api/query/ask', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    const { classifyQuery, getCachedQueryResult, cacheQueryResult, getSimpleAppAnswer } = await import('../services/query-router');
    const queryType = classifyQuery(query);

    // Check cache
    const cached = await getCachedQueryResult(shopDomain, query);
    if (cached) return res.json({ ...cached, cached: true, queryType });

    if (queryType === 'simple') {
      const answer = await getSimpleAppAnswer(shopDomain, query);
      if (answer) {
        await cacheQueryResult(shopDomain, query, answer);
        return res.json({ ...answer, cached: false, queryType });
      }
    }

    // Complex query — return guidance to run full chain
    res.json({
      queryType: 'complex',
      message: 'This requires a full audit. Use the chain-of-prompts audit endpoint to get comprehensive recommendations.',
      cached: false,
    });
  } catch (error) {
    console.error('Query router error:', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

// --- Incident Response ---
router.get('/api/incidents', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { getOpenIncidents, getIncidentSummary } = await import('../services/incident-response');
    const [open, summary] = await Promise.all([
      getOpenIncidents(shopDomain),
      getIncidentSummary(shopDomain),
    ]);
    res.json({ open, summary });
  } catch (error) {
    console.error('Incidents error:', error);
    res.status(500).json({ error: 'Failed to get incidents' });
  }
});

router.post('/api/incidents/detect', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { detectAbnormalAccess } = await import('../services/incident-response');
    const incidents = await detectAbnormalAccess(shopDomain);
    res.json({ detected: incidents.length, incidents });
  } catch (error) {
    console.error('Incident detection error:', error);
    res.status(500).json({ error: 'Failed to detect incidents' });
  }
});

router.post('/api/incidents/:id/status', validateSession, async (req: Request, res: Response) => {
  try {
    const { status, resolution } = req.body;
    const { updateIncidentStatus } = await import('../services/incident-response');
    const result = await updateIncidentStatus(req.params.id as string, status, resolution);
    res.json(result);
  } catch (error) {
    console.error('Incident status error:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

router.post('/api/incidents/:id/escalate', validateSession, async (req: Request, res: Response) => {
  try {
    const { escalatedTo, reason } = req.body;
    const { escalateIncident } = await import('../services/incident-response');
    const result = await escalateIncident(req.params.id as string, escalatedTo, reason);
    res.json(result);
  } catch (error) {
    console.error('Escalation error:', error);
    res.status(500).json({ error: 'Failed to escalate' });
  }
});

// --- Theme Cleanup ---
router.get('/api/theme-cleanup', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { getThemeCleanupSummary } = await import('../services/theme-cleanup');
    const summary = await getThemeCleanupSummary(shopDomain);
    res.json(summary);
  } catch (error) {
    console.error('Theme cleanup error:', error);
    res.status(500).json({ error: 'Failed to get theme cleanup' });
  }
});

router.post('/api/theme-cleanup/check/:appId', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { checkThemeAssets } = await import('../services/theme-cleanup');
    const result = await checkThemeAssets(shopDomain, req.params.appId as string);
    res.json({ checked: result.length, assets: result });
  } catch (error) {
    console.error('Theme check error:', error);
    res.status(500).json({ error: 'Failed to check theme assets' });
  }
});

// --- Vendor Negotiations ---
router.post('/api/negotiations/draft', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { draftNegotiationMessage } = await import('../services/vendor-negotiation');
    const result = await draftNegotiationMessage(shopDomain, req.body);
    res.json(result);
  } catch (error) {
    console.error('Negotiation draft error:', error);
    res.status(500).json({ error: 'Failed to draft negotiation' });
  }
});

router.get('/api/negotiations', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { getNegotiationsSummary } = await import('../services/vendor-negotiation');
    const summary = await getNegotiationsSummary(shopDomain);
    res.json(summary);
  } catch (error) {
    console.error('Negotiations error:', error);
    res.status(500).json({ error: 'Failed to get negotiations' });
  }
});

router.post('/api/negotiations/:id/status', validateSession, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { updateNegotiationStatus } = await import('../services/vendor-negotiation');
    const result = await updateNegotiationStatus(req.params.id as string, status);
    res.json(result);
  } catch (error) {
    console.error('Negotiation status error:', error);
    res.status(500).json({ error: 'Failed to update negotiation' });
  }
});

// --- Supabase Storage: Evidence Upload ---
router.post('/api/evidence/upload', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'No file provided. Send base64 payload in "file" field.' });
    }

    const { supabase } = await import('../supabase');
    const buffer = Buffer.from(file.replace(/^data:.+;base64,/, ''), 'base64');
    const fileName = `${shopDomain}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

    const { data, error } = await supabase.storage
      .from('evidence')
      .upload(fileName, buffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      return res.status(500).json({ error: `Upload failed: ${error.message}` });
    }

    const { data: urlData } = supabase.storage
      .from('evidence')
      .getPublicUrl(fileName);

    await prisma.complianceEvidence.create({
      data: {
        shopId: shopDomain,
        eventType: 'evidence_upload',
        action: 'upload',
        details: JSON.stringify({ fileName, url: urlData.publicUrl }),
        actor: 'merchant',
      },
    });

    res.json({ fileName, url: urlData.publicUrl });
  } catch (error) {
    console.error('Evidence upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/api/evidence/files', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { supabase } = await import('../supabase');

    const { data, error } = await supabase.storage
      .from('evidence')
      .list(shopDomain, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) {
      return res.status(500).json({ error: `List failed: ${error.message}` });
    }

    const files = (data || []).map((f: any) => {
      const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(`${shopDomain}/${f.name}`);
      return { name: f.name, url: urlData.publicUrl, created: f.created_at };
    });

    res.json({ count: files.length, files });
  } catch (error) {
    console.error('Evidence list error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// --- Multi-Tenant ---
router.get('/api/tenant/policies', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { getTenantPolicies, getTenantIsolationReport } = await import('../services/multi-tenant');
    const [policies, report] = await Promise.all([
      getTenantPolicies(shopDomain),
      getTenantIsolationReport(shopDomain),
    ]);
    res.json({ policies, report });
  } catch (error) {
    console.error('Tenant policies error:', error);
    res.status(500).json({ error: 'Failed to get tenant policies' });
  }
});

router.post('/api/tenant/policies', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { setTenantPolicy } = await import('../services/multi-tenant');
    const result = await setTenantPolicy(shopDomain, req.body);
    res.json(result);
  } catch (error) {
    console.error('Set policy error:', error);
    res.status(500).json({ error: 'Failed to set policy' });
  }
});

router.post('/api/tenant/metadata', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { updateStoreMetadata } = await import('../services/multi-tenant');
    const result = await updateStoreMetadata(shopDomain, req.body);
    res.json(result);
  } catch (error) {
    console.error('Metadata error:', error);
    res.status(500).json({ error: 'Failed to update metadata' });
  }
});

// --- Custom app creation for testing ---
router.post('/api/apps/custom', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const { name, developerName, monthlyCost, category, isActive, permissions } = req.body;
    const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = `custom-${handle}-${Date.now()}`;

    const app = await prisma.app.create({
      data: {
        id,
        shopId: shop.id,
        name,
        handle,
        developerName: developerName || 'Custom',
        monthlyCost: monthlyCost ? parseFloat(monthlyCost) : 0,
        category: category || 'Custom',
        isActive: isActive !== false,
        permissions: {
          create: (permissions || ['read_products']).map((s: string) => ({
            scope: s,
            isHighRisk: ['write_products', 'write_customers', 'write_orders', 'read_orders'].includes(s),
          })),
        },
      },
    });

    res.json({ success: true, app: { id: app.id, name: app.name, handle: app.handle } });
  } catch (error) {
    console.error('Create app error:', error);
    res.status(500).json({ error: 'Failed to create app' });
  }
});

// --- Delete app ---
router.delete('/api/apps/:appId', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { appId } = req.params;
    const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const app = await prisma.app.findFirst({ where: { id: appId as string, shopId: shop.id } });
    if (!app) return res.status(404).json({ error: 'App not found' });

    await prisma.appPermission.deleteMany({ where: { appId: app.id } });
    await prisma.appScoreHistory.deleteMany({ where: { appId: app.id } });
    await prisma.complianceFinding.deleteMany({ where: { appId: app.id } });
    await prisma.remediationAction.deleteMany({ where: { appId: app.id } });
    await prisma.app.delete({ where: { id: app.id } });

    res.json({ success: true, deleted: app.name });
  } catch (error) {
    console.error('Delete app error:', error);
    res.status(500).json({ error: 'Failed to delete app' });
  }
});

// --- Update app ---
router.put('/api/apps/:appId', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { appId } = req.params;
    const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const { name, developerName, monthlyCost, category, isActive } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (developerName !== undefined) data.developerName = developerName;
    if (monthlyCost !== undefined) data.monthlyCost = parseFloat(monthlyCost);
    if (category !== undefined) data.category = category;
    if (isActive !== undefined) data.isActive = isActive;

    const app = await prisma.app.update({ where: { id: appId as string }, data });
    res.json({ success: true, app });
  } catch (error) {
    console.error('Update app error:', error);
    res.status(500).json({ error: 'Failed to update app' });
  }
});

// --- Compare apps ---
router.get('/api/apps/compare', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: shopDomain } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const apps = await prisma.app.findMany({
      where: { shopId: shop.id },
      include: {
        permissions: true,
        scoreHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const comparison = apps.map((app) => {
      const latestScore = app.scoreHistory[0];
      return {
        id: app.id,
        name: app.name,
        category: app.category,
        monthlyCost: app.monthlyCost,
        isActive: app.isActive,
        developerName: app.developerName,
        recommendation: app.recommendation,
        performanceScore: app.performanceScore,
        highRiskScopes: app.permissions.filter((p) => p.isHighRisk).length,
        totalScopes: app.permissions.length,
        scores: latestScore ? {
          performance: latestScore.performance,
          cost: latestScore.cost,
          functionality: latestScore.functionality,
          security: latestScore.securityRisk,
          overall: latestScore.overallScore,
        } : null,
      };
    });

    res.json({ apps: comparison, totalMonthlySpend: apps.reduce((s, a) => s + (a.monthlyCost || 0), 0) });
  } catch (error) {
    console.error('Compare error:', error);
    res.status(500).json({ error: 'Failed to compare apps' });
  }
});

export default router;
