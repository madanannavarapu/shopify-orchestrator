import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { shopify } from '../shopify';
import { config } from '../config';
import { prisma } from '../database';
import { deliverTokensToEngine } from '../engine-client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'orchestrator-dev-secret-change-in-prod';

// ponytail: Bypass SDK's auth.begin() — its in-memory session store returns 410 after container restarts.
// Generate HMAC-signed state ourselves, redirect directly to Shopify's OAuth endpoint.
router.get('/auth', async (req: Request, res: Response) => {
  const shop = req.query.shop as string;
  if (!shop) return res.status(400).send('Missing shop parameter');

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${config.shopify.appUrl}/auth/callback`;
  const scopes = config.shopify.scopes.join(', ');

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${config.shopify.apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  // ponytail: state is HMAC-signed so callback can verify it came from us
  const signedState = crypto.createHmac('sha256', config.shopify.apiSecret).update(state).digest('hex');
  res.cookie(`shopify_state_${shop}`, signedState, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600000 });
  res.cookie('shopify.shop', shop, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600000 });

  res.redirect(authUrl);
});

// ponytail: Manual token exchange with `expiring: 1` — SDK doesn't send it
function verifyHmac(query: Record<string, string>, secret: string): boolean {
  const hmac = query.hmac;
  const params = { ...query };
  delete params.hmac;
  delete params.signature;
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const computed = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
  return computed === hmac;
}

router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const shop = req.query.shop as string;
    const code = req.query.code as string;
    const hmac = req.query.hmac as string;

    if (!shop || !code || !hmac) {
      return res.status(400).send('Missing required parameters');
    }

    if (!verifyHmac(req.query as Record<string, string>, config.shopify.apiSecret)) {
      return res.status(401).send('HMAC verification failed');
    }

    // ponytail: Verify HMAC-signed state from cookie instead of SDK session store
    const state = req.query.state as string;
    const storedState = req.cookies?.[`shopify_state_${shop}`];
    if (state && storedState) {
      const expected = crypto.createHmac('sha256', config.shopify.apiSecret).update(state).digest('hex');
      if (storedState !== expected) {
        return res.status(401).send('State mismatch — possible CSRF');
      }
    }

    // ponytail: Manual token exchange — SDK doesn't send `expiring: 1`
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.shopify.apiKey,
        client_secret: config.shopify.apiSecret,
        code,
        expiring: 1,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error(`[auth] Token exchange failed (${tokenRes.status}):`, errText);
      return res.status(500).send('Token exchange failed');
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope: string;
    };

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    // ponytail: expires_in is seconds from now; compute absolute Date
    const tokenExpiresAt = refreshToken && tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    console.log(`[auth] OAuth callback for ${shop}: has_refresh=${!!refreshToken}, expires=${tokenExpiresAt?.toISOString()}`);

    await prisma.shop.upsert({
      where: { id: shop },
      create: {
        id: shop,
        myshopifyDomain: shop,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      },
      update: {
        accessToken,
        refreshToken: refreshToken || undefined,
        tokenExpiresAt: tokenExpiresAt || undefined,
        lastActivityAt: new Date(),
      },
    });

    // Tokens go in the body, never the query string (they would land in access logs).
    await deliverTokensToEngine(shop, accessToken, refreshToken ?? null, { scope: tokenData.scope });

    // ponytail: connected=1 marks "token stored" so the SPA can enter app state without looping back into OAuth
    res.redirect(`/orchestrator/?shop=${shop}&host=${req.query.host}&connected=1`);
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
  res.json({
    shop: shopRecord.myshopifyDomain,
    access_token: shopRecord.accessToken,
    refresh_token: shopRecord.refreshToken,
    token_expires_at: shopRecord.tokenExpiresAt?.toISOString(),
  });
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

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      // ponytail: accept Shopify ID token (App Bridge session token) as auth for embedded app
      try {
        const payload = jwt.verify(token, config.shopify.apiSecret, {
          algorithms: ['HS256'],
          audience: config.shopify.apiKey,
        }) as any;
        const issHost = new URL(payload.iss).hostname;
        const destHost = new URL(payload.dest).hostname;
        if (issHost !== destHost) return res.status(401).json({ error: 'Invalid session token' });
        return res.json({
          user: {
            id: String(payload.sub),
            email: `${payload.sub}@${destHost}`,
            name: 'Shopify user',
            shopId: destHost,
          },
        });
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });

    res.json({ user: { id: user.id, email: user.email, name: user.name, shopId: user.shopId } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export { router as default, JWT_SECRET };
