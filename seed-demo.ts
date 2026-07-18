import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { scoreApp } from './server/services/scoring-engine';
import { generateRecommendations } from './server/services/recommendation-agent';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function seed() {
  const shop = await prisma.shop.findUnique({ where: { myshopifyDomain: 'demo.myshopify.com' } });
  if (!shop) { console.log('Demo shop not found — run with ?shop=demo first'); return; }

  const existing = await prisma.app.count({ where: { shopId: shop.id } });
  if (existing > 0) { console.log(`${existing} apps already seeded`); return; }

  const app1 = await prisma.app.create({
    data: {
      id: 'app-tiny-einstein', shopId: shop.id, name: 'Tiny Einstein', handle: 'tiny-einstein',
      developerName: 'Tiny Einstein LLC', monthlyCost: 29.99,
      category: 'Marketing & Conversion', isActive: true,
      permissions: { create: [
        { scope: 'read_products', isHighRisk: false },
        { scope: 'write_products', isHighRisk: false },
        { scope: 'read_orders', isHighRisk: true },
      ]},
    },
  });

  const app2 = await prisma.app.create({
    data: {
      id: 'app-smile-io', shopId: shop.id, name: 'Smile.io Rewards', handle: 'smile-io',
      developerName: 'Smile.io', monthlyCost: 49.00,
      category: 'Loyalty & Rewards', isActive: true,
      permissions: { create: [
        { scope: 'read_customers', isHighRisk: false },
        { scope: 'write_customers', isHighRisk: true },
        { scope: 'read_orders', isHighRisk: true },
      ]},
    },
  });

  const app3 = await prisma.app.create({
    data: {
      id: 'app-oberlo', shopId: shop.id, name: 'Oberlo', handle: 'oberlo',
      developerName: 'Oberlo Inc.', monthlyCost: 0,
      category: 'Shipping & Fulfillment', isActive: true,
      permissions: { create: [{ scope: 'read_products', isHighRisk: false }]},
    },
  });

  const app4 = await prisma.app.create({
    data: {
      id: 'app-privy', shopId: shop.id, name: 'Privy', handle: 'privy',
      developerName: 'Privy', monthlyCost: 24.99,
      category: 'Marketing & Conversion', isActive: false,
      permissions: { create: [
        { scope: 'read_customers', isHighRisk: false },
        { scope: 'write_customers', isHighRisk: true },
      ]},
    },
  });

  console.log(`Seeded 4 apps`);

  for (const app of [app1, app2, app3, app4]) {
    try { await scoreApp('demo.myshopify.com', app.id); } catch (e) { console.error(`Score ${app.name}:`, e.message); }
  }
  console.log('Scored all apps');

  try { await generateRecommendations('demo.myshopify.com'); } catch (e) { console.error('Recommendations:', e.message); }
  console.log('Recommendations generated');

  await prisma.$disconnect();
}

seed().catch((e) => { console.error(e); prisma.$disconnect(); });
