import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { supabase } from './supabase';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.database.url,
    },
  },
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL database connected');

    if (supabase) {
      supabase.from('Shop').select('id').limit(1).then(
        ({ error }: any) => {
          if (error && error.code !== 'PGRST116') {
            console.warn('Supabase API check:', error.message);
          } else {
            console.log('Supabase client ready');
          }
        },
        () => {}
      );
    }
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
