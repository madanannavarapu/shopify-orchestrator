import { Router, Request, Response } from 'express';
import { shopify } from '../shopify';
import { handleBulkOperationWebhook } from '../services/bulk-operations';

const router = Router();

router.post('/webhooks/bulk_operations/finish', async (req: Request, res: Response) => {
  try {
    const rawBody = JSON.stringify(req.body);

    const isValid = await shopify.webhooks.validate({
      rawBody,
      rawRequest: req,
      rawResponse: res,
    });

    if (!isValid) {
      return res.status(401).send('Invalid webhook signature');
    }

    await handleBulkOperationWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

router.post('/webhooks/app_uninstalled', async (req: Request, res: Response) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const isValid = await shopify.webhooks.validate({
      rawBody,
      rawRequest: req,
      rawResponse: res,
    });

    if (!isValid) {
      return res.status(401).send('Invalid webhook signature');
    }

    const domain = req.body.myshopify_domain || req.body.domain;
    if (domain) {
      const { prisma } = await import('../database');
      await prisma.app.deleteMany({ where: { shopId: domain } });
      await prisma.shop.update({
        where: { myshopifyDomain: domain },
        data: { lastActivityAt: new Date() },
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('App uninstalled webhook error:', error);
    res.status(500).send('Error');
  }
});

export default router;
