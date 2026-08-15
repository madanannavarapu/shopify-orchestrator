import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { shopify } from '../shopify';
import { prisma } from '../database';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'orchestrator-dev-secret-change-in-prod';

// Shopify auth
router.get('/auth', async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  if (!shop) return res.status(400).send('Missing shop parameter');
  const authPath = await shopify.auth.begin({
    shop, callbackPath: '/auth/callback', isOnline: false,
    rawRequest: req, rawResponse: res,
  });
  res.redirect(authPath);
});

router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const callback = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
    const { session } = callback;
    await prisma.shop.upsert({
      where: { id: session.shop },
      create: { id: session.shop, myshopifyDomain: session.shop, accessToken: session.accessToken || '' },
      update: { accessToken: session.accessToken || '', lastActivityAt: new Date() },
    });

    const engineUrl = process.env.COMPLIANCE_ENGINE_URL || 'http://localhost:8000';
    try {
      const params = new URLSearchParams({ shop: session.shop, access_token: session.accessToken || '' });
      await fetch(`${engineUrl}/webhooks/shopify/register-webhooks?${params}`, { method: 'POST' });
    } catch { /* non-fatal */ }

    res.redirect(`/?shop=${session.shop}&host=${req.query.host}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

router.get('/auth/token', async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  if (!shop) return res.status(400).json({ error: 'Missing shop' });
  const shopRecord = await prisma.shop.findUnique({ where: { myshopifyDomain: shop } });
  if (!shopRecord) return res.status(404).json({ error: 'Shop not found' });
  res.json({ shop: shopRecord.myshopifyDomain });
});

// --- Web user auth (email/password) ---

router.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const shopId = `web_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const shopDomain = `${email.split('@')[0]}.webapp.local`;

    const shop = await prisma.shop.create({
      data: { id: shopId, myshopifyDomain: shopDomain, accessToken: 'web-token' },
    });

    const user = await prisma.user.create({
      data: { email, passwordHash, name, shopId: shop.id },
    });

    const token = jwt.sign({ userId: user.id, email: user.email, shopId: shop.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id, email: user.email, shopId: user.shopId }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({ user: { id: user.id, email: user.email, name: user.name, shopId: user.shopId } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export { router as default, JWT_SECRET };
