import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import { JWT_SECRET } from '../routes/auth';
import { buildSession } from '../shopify';

export async function validateWebSession(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authentication required' });

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
    if (!shop) return res.status(401).json({ error: 'Shop not found' });

    const session = buildSession(shop.myshopifyDomain, shop.accessToken);
    (req as any).session = session;
    (req as any).shop = shop.myshopifyDomain;
    (req as any).shopRecord = shop;
    (req as any).user = user;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
