'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_COOKIE_NAME, supabaseEnv } from './env';

let client: SupabaseClient | null | undefined;

/** Browser Supabase client (session stored in cookies so the server can read it). */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = supabaseEnv();
  client = env ? createBrowserClient(env.url, env.key, { cookieOptions: { name: AUTH_COOKIE_NAME } }) : null;
  return client;
}
