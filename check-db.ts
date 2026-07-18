import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const shops = await p.shop.findMany();
  console.log('Shops:', JSON.stringify(shops.map(s => ({ id: s.id, domain: s.myshopifyDomain }))));
  const apps = await p.app.findMany();
  console.log('Apps:', apps.length, JSON.stringify(apps.map(a => ({ id: a.id, name: a.name, cost: a.monthlyCost }))));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
