import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
async function main() {
  const shops = await p.shop.findMany();
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('Shops:', JSON.stringify(shops));
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); p.$disconnect(); });
