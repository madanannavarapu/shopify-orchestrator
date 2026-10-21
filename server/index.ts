import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { connectDatabase, disconnectDatabase, prisma } from './database';
import { supabase } from './supabase';
import { shopify } from './shopify';
import { deliverTokensToEngine } from './engine-client';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import appRoutes from './routes/apps';
import complianceRoutes from './routes/compliance';
import consentRoutes from './routes/consent';
import dsrRoutes from './routes/dsr';

const app = express();

app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
  );
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// Raw body for webhook signature verification
app.use('/webhooks', express.raw({ type: '*/*' }));

app.use(express.json());

// Bypass auth for Shopify auth, webhooks, and web user auth endpoints
app.use((req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/webhooks') || req.path.startsWith('/api/auth/')) {
    return next();
  }

  next();
});

// Routes
app.use('/', authRoutes);
app.use('/', webhookRoutes);
app.use('/', appRoutes);
app.use('/', complianceRoutes);
app.use('/', consentRoutes);
app.use('/', dsrRoutes);

app.get('/api/health', async (_req, res) => {
  const dbOk = { connected: true };
  const supabaseOk = { connected: true, project: config.supabase.url?.replace(/https:\/\//, '').replace(/\.supabase\.co.*/, '') || 'not-set' };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbOk.connected = false;
  }

  res.json({ status: 'ok', database: dbOk, supabase: supabaseOk, timestamp: new Date().toISOString() });
});

// Serve frontend in production
const frontendPath = path.join(process.cwd(), 'frontend', 'dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/webhooks')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

async function start() {
  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`Shopify Orchestrator running on port ${config.port}`);
    console.log(`Auth URL: ${config.shopify.appUrl}/auth`);
    console.log(`Scopes: ${config.shopify.scopes.join(', ')}`);
  });

  // ponytail: Refresh expiring tokens every 6h before they expire (24h lifetime)
  setInterval(async () => {
    try {
      const shops = await prisma.shop.findMany({
        where: { tokenExpiresAt: { not: null }, refreshToken: { not: null } },
      });
      for (const shop of shops) {
        if (!shop.tokenExpiresAt || !shop.refreshToken) continue;
        const hoursUntilExpiry = (shop.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilExpiry > 6) continue; // still fresh

        console.log(`[refresh] Token for ${shop.myshopifyDomain} expires in ${hoursUntilExpiry.toFixed(1)}h — refreshing`);
        const resp = await fetch(`https://${shop.myshopifyDomain}/admin/oauth/access_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: config.shopify.apiKey,
            client_secret: config.shopify.apiSecret,
            refresh_token: shop.refreshToken,
          }),
        });

        if (!resp.ok) {
          console.error(`[refresh] Failed for ${shop.myshopifyDomain}: ${resp.status}`);
          continue;
        }

        const data = await resp.json() as { access_token: string; refresh_token?: string; expires_in?: number };
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || shop.refreshToken,
            tokenExpiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : shop.tokenExpiresAt,
            lastActivityAt: new Date(),
          },
        });

        await deliverTokensToEngine(
          shop.myshopifyDomain,
          data.access_token,
          data.refresh_token || shop.refreshToken,
        );

        console.log(`[refresh] Token refreshed for ${shop.myshopifyDomain}`);
      }
    } catch (e) {
      console.error('[refresh] Cron error:', e);
    }
  }, 6 * 60 * 60 * 1000); // every 6 hours
}

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});

start().catch(console.error);
