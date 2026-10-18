import { Router, Request, Response } from 'express';
import { validateSession } from '../middleware/validate-session';
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  getPurposes, createPurpose, updatePurpose, seedPurposes,
  recordConsent, getRecords, getRecord, getConsentStats, exportConsentRecords,
  getCustomerConsentStatus, updateCustomerConsent,
  getWidgetConfig, previewWidget,
} from '../services/consent-service';

const router = Router();

// --- Templates ---
router.get('/api/consent/templates', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const templates = await getTemplates(shopDomain);
    res.json(templates);
  } catch (error) {
    console.error('Consent templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

router.post('/api/consent/templates', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const template = await createTemplate(shopDomain, req.body);
    res.json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/api/consent/templates/:id', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await updateTemplate(req.params.id as string, req.body);
    res.json(result);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/api/consent/templates/:id', validateSession, async (req: Request, res: Response) => {
  try {
    await deleteTemplate(req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// --- Purposes ---
router.get('/api/consent/purposes', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const purposes = await getPurposes(shopDomain);
    res.json(purposes);
  } catch (error) {
    console.error('Consent purposes error:', error);
    res.status(500).json({ error: 'Failed to get purposes' });
  }
});

router.post('/api/consent/purposes', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const purpose = await createPurpose(shopDomain, req.body);
    res.json(purpose);
  } catch (error) {
    console.error('Create purpose error:', error);
    res.status(500).json({ error: 'Failed to create purpose' });
  }
});

router.put('/api/consent/purposes/:id', validateSession, async (req: Request, res: Response) => {
  try {
    const result = await updatePurpose(req.params.id as string, req.body);
    res.json(result);
  } catch (error) {
    console.error('Update purpose error:', error);
    res.status(500).json({ error: 'Failed to update purpose' });
  }
});

router.post('/api/consent/purposes/seed', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    await seedPurposes(shopDomain);
    res.json({ success: true });
  } catch (error) {
    console.error('Seed purposes error:', error);
    res.status(500).json({ error: 'Failed to seed purposes' });
  }
});

// --- Records ---
router.post('/api/consent/records', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const record = await recordConsent(shopDomain, req.body);
    res.json(record);
  } catch (error) {
    console.error('Record consent error:', error);
    res.status(500).json({ error: 'Failed to record consent' });
  }
});

router.get('/api/consent/records', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const { customerId, email, purposeId } = req.query as any;
    const records = await getRecords(shopDomain, { customerId, email, purposeId });
    res.json(records);
  } catch (error) {
    console.error('Get records error:', error);
    res.status(500).json({ error: 'Failed to get records' });
  }
});

router.get('/api/consent/records/stats', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const stats = await getConsentStats(shopDomain);
    res.json(stats);
  } catch (error) {
    console.error('Consent stats error:', error);
    res.status(500).json({ error: 'Failed to get consent stats' });
  }
});

router.get('/api/consent/records/export', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const records = await exportConsentRecords(shopDomain);
    res.json(records);
  } catch (error) {
    console.error('Export consent error:', error);
    res.status(500).json({ error: 'Failed to export consent records' });
  }
});

router.get('/api/consent/records/:id', validateSession, async (req: Request, res: Response) => {
  try {
    const record = await getRecord(req.params.id as string);
    res.json(record);
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({ error: 'Failed to get consent record' });
  }
});

// --- Shopify Customers Tab ---
router.get('/api/consent/customers/:customerId/status', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const status = await getCustomerConsentStatus(shopDomain, req.params.customerId as string);
    res.json(status);
  } catch (error) {
    console.error('Customer consent status error:', error);
    res.status(500).json({ error: 'Failed to get customer consent status' });
  }
});

router.post('/api/consent/customers/:customerId/status', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const result = await updateCustomerConsent(shopDomain, req.params.customerId as string, req.body);
    res.json(result);
  } catch (error) {
    console.error('Update customer consent error:', error);
    res.status(500).json({ error: 'Failed to update customer consent' });
  }
});

// --- Widget ---
router.get('/api/consent/widget', validateSession, async (req: Request, res: Response) => {
  try {
    const shopDomain = (req as any).shop;
    const widget = await getWidgetConfig(shopDomain);
    res.json(widget);
  } catch (error) {
    console.error('Widget config error:', error);
    res.status(500).json({ error: 'Failed to get widget config' });
  }
});

router.post('/api/consent/widget/preview', validateSession, async (req: Request, res: Response) => {
  try {
    const preview = await previewWidget(req.body);
    res.json(preview);
  } catch (error) {
    console.error('Widget preview error:', error);
    res.status(500).json({ error: 'Failed to preview widget' });
  }
});

export default router;
