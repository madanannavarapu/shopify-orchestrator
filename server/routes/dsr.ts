import { Router, Request, Response } from 'express';
import { validateSession } from '../middleware/validate-session';
import {
  listDsrs, createDsr, getDsr, getDsrStats,
  processDsr, completeDsr, rejectDsr, anonymizeDsr,
  notifyDsr, withdrawDsr, sendEmailNotification,
  getOverdueRequests, getUpcomingDeadlines,
  listDsrTemplates, createDsrTemplate, updateDsrTemplate, deleteDsrTemplate,
  seedDefaultTemplates,
} from '../services/dsr-service';

const router = Router();

// --- DSR CRUD ---
router.get('/api/dsr', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { status, requestType, limit } = req.query as any;
    const requests = await listDsrs(shopDomain, { status, requestType, limit: limit ? parseInt(limit) : undefined });
    res.json(requests);
  } catch (error) {
    console.error('List DSR error:', error);
    res.status(500).json({ error: 'Failed to list DSR requests' });
  }
});

router.post('/api/dsr', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const dsr = await createDsr(shopDomain, req.body);
    res.json(dsr);
  } catch (error) {
    console.error('Create DSR error:', error);
    res.status(500).json({ error: 'Failed to create DSR request' });
  }
});

router.get('/api/dsr/stats', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const stats = await getDsrStats(shopDomain);
    res.json(stats);
  } catch (error) {
    console.error('DSR stats error:', error);
    res.status(500).json({ error: 'Failed to get DSR stats' });
  }
});

router.post('/api/dsr/:id/process', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await processDsr(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Process DSR error:', error);
    res.status(500).json({ error: 'Failed to process DSR' });
  }
});

router.post('/api/dsr/:id/complete', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await completeDsr(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Complete DSR error:', error);
    res.status(500).json({ error: 'Failed to complete DSR' });
  }
});

router.post('/api/dsr/:id/reject', validateSession, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await rejectDsr(req.params.id as string, reason || 'No reason provided');
    res.json(result);
  } catch (error) {
    console.error('Reject DSR error:', error);
    res.status(500).json({ error: 'Failed to reject DSR' });
  }
});

router.post('/api/dsr/:id/anonymize', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await anonymizeDsr(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Anonymize DSR error:', error);
    res.status(500).json({ error: 'Failed to anonymize DSR' });
  }
});

router.post('/api/dsr/:id/notify', validateSession, async (req: Request, res: Response) => {
  try {
    const { via } = req.body;
    const result = await notifyDsr(req.params.id as string, via || 'email');
    res.json(result);
  } catch (error) {
    console.error('Notify DSR error:', error);
    res.status(500).json({ error: 'Failed to notify DSR' });
  }
});

router.post('/api/dsr/:id/withdraw', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await withdrawDsr(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Withdraw DSR error:', error);
    res.status(500).json({ error: 'Failed to withdraw DSR' });
  }
});

router.post('/api/dsr/:id/send-email', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await sendEmailNotification(req.params.id as string);
    res.json(result);
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email notification' });
  }
});

// --- Deadlines ---
router.get('/api/dsr/overdue', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const overdue = await getOverdueRequests(shopDomain);
    res.json(overdue);
  } catch (error) {
    console.error('Overdue DSR error:', error);
    res.status(500).json({ error: 'Failed to get overdue requests' });
  }
});

router.get('/api/dsr/deadlines/upcoming', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const upcoming = await getUpcomingDeadlines(shopDomain, days);
    res.json(upcoming);
  } catch (error) {
    console.error('Upcoming deadlines error:', error);
    res.status(500).json({ error: 'Failed to get upcoming deadlines' });
  }
});

// --- Templates ---
router.get('/api/dsr/templates', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { requestType } = req.query as any;
    const templates = await listDsrTemplates(shopDomain, requestType);
    res.json(templates);
  } catch (error) {
    console.error('List DSR templates error:', error);
    res.status(500).json({ error: 'Failed to list DSR templates' });
  }
});

router.post('/api/dsr/templates', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const template = await createDsrTemplate(shopDomain, req.body);
    res.json(template);
  } catch (error) {
    console.error('Create DSR template error:', error);
    res.status(500).json({ error: 'Failed to create DSR template' });
  }
});

router.put('/api/dsr/templates/:id', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await updateDsrTemplate(req.params.id as string, req.body);
    res.json(result);
  } catch (error) {
    console.error('Update DSR template error:', error);
    res.status(500).json({ error: 'Failed to update DSR template' });
  }
});

router.delete('/api/dsr/templates/:id', validateSession, async (req: Request, res: Response) => {
  try {
    await deleteDsrTemplate(req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete DSR template error:', error);
    res.status(500).json({ error: 'Failed to delete DSR template' });
  }
});

router.post('/api/dsr/templates/defaults', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    await seedDefaultTemplates(shopDomain);
    res.json({ success: true });
  } catch (error) {
    console.error('Seed DSR templates error:', error);
    res.status(500).json({ error: 'Failed to seed default templates' });
  }
});

// ponytail: GET :id registered LAST so static routes (/templates, /overdue, /deadlines/upcoming) aren't swallowed by :id
router.get('/api/dsr/:id', validateSession, async (req: Request, res: Response) => {
  try {
    const dsr = await getDsr(req.params.id as string);
    if (!dsr) return res.status(404).json({ error: 'DSR not found' });
    res.json(dsr);
  } catch (error) {
    console.error('Get DSR error:', error);
    res.status(500).json({ error: 'Failed to get DSR request' });
  }
});

export default router;
