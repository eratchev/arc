import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import * as schema from './schema';

// Admin DB: Drizzle with service role — bypasses RLS
// ONLY for: migrations, SDS→MOS connector, embedding generation
export function createAdminDb() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error('SUPABASE_DB_URL is required');
  const client = postgres(dbUrl);
  return drizzle(client, { schema });
}

// User-scoped: Supabase client with user's JWT — RLS enforced
export function getUserClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase URL and anon key are required');

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Service role client for system operations
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Supabase URL and service role key are required');

  return createClient(url, serviceKey);
}
