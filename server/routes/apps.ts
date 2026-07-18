import { Router, Request, Response } from 'express';
import { validateSession } from '../middleware/validate-session';
import {
  getCanonicalAppGraph,
  autoCategorizeApps,
} from '../services/app-graph';
import { submitAppInventoryBulkOperation, pollBulkOperation } from '../services/bulk-operations';

const router = Router();

router.get('/api/apps', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const graph = await getCanonicalAppGraph(shopDomain);
    res.json(graph);
  } catch (error) {
    console.error('Failed to fetch app graph:', error);
    res.status(500).json({ error: 'Failed to fetch app inventory' });
  }
});

router.post('/api/apps/refresh', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const operation = await submitAppInventoryBulkOperation(shopDomain);
    res.json({ operationId: operation.id, status: operation.status });
  } catch (error) {
    console.error('Failed to start bulk operation:', error);
    res.status(500).json({ error: 'Failed to start data refresh' });
  }
});

router.get('/api/apps/bulk-status/:id', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const operation = await pollBulkOperation(shopDomain, req.params.id as string);
    res.json(operation);
  } catch (error) {
    console.error('Failed to poll bulk operation:', error);
    res.status(500).json({ error: 'Failed to check operation status' });
  }
});

router.post('/api/apps/categorize', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const categorized = await autoCategorizeApps(shopDomain);
    res.json({ categorized });
  } catch (error) {
    console.error('Failed to categorize apps:', error);
    res.status(500).json({ error: 'Failed to categorize' });
  }
});

export default router;
