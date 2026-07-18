import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { connectDatabase, disconnectDatabase, prisma } from './database';
import { supabase } from './supabase';
import { shopify } from './shopify';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import appRoutes from './routes/apps';
import complianceRoutes from './routes/compliance';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
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
