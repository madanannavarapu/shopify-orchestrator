import { createClient } from '@supabase/supabase-js';
import { config } from './config';

const hasSupabase = config.supabase.url
  && config.supabase.anonKey
  && config.supabase.url !== 'https://your-project.supabase.co'
  && config.supabase.anonKey !== 'your-anon-key';

export const supabase = hasSupabase
  ? createClient(config.supabase.url!, config.supabase.anonKey!)
  : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
