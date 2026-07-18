import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { shopify, buildSession } from '../shopify';
import { prisma } from '../database';
import { JWT_SECRET } from '../routes/auth';

export async function validateSession(req: Request, res: Response, next: NextFunction) {
  // 1. Check for JWT auth header (web users)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (user) {
        const shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
        if (shop) {
          const session = buildSession(shop.myshopifyDomain, shop.accessToken);
          (req as any).session = session;
          (req as any).shop = shop.myshopifyDomain;
          (req as any).shopRecord = shop;
          (req as any).user = user;
          return next();
        }
      }
    } catch {}
  }

  // 2. Check for shop query param
  const shop = req.query.shop as string;
  if (!shop) {
    return res.status(401).json({ error: 'Missing shop parameter or authorization' });
  }

  if (shop === 'demo' || shop === 'test-store.myshopify.com') {
    const demoShop = shop === 'demo' ? 'demo.myshopify.com' : shop;
    const existing = await prisma.shop.findUnique({ where: { myshopifyDomain: demoShop } });
    if (!existing) {
      await prisma.shop.create({
        data: { id: `offline_${demoShop}`, myshopifyDomain: demoShop, accessToken: 'demo-token' },
      });
    }
    const session = buildSession(demoShop, 'demo-token');
    (req as any).session = session;
    (req as any).shop = demoShop;
    (req as any).shopRecord = { myshopifyDomain: demoShop, accessToken: 'demo-token' };
    return next();
  }

  const shopRecord = await prisma.shop.findUnique({ where: { myshopifyDomain: shop } });
  if (!shopRecord || !shopRecord.accessToken) {
    return res.status(401).json({ error: 'Shop not found or not authenticated' });
  }

  const session = buildSession(shop, shopRecord.accessToken);
  (req as any).session = session;
  (req as any).shop = shop;
  (req as any).shopRecord = shopRecord;
  next();
}
