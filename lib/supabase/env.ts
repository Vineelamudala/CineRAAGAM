/**
 * Public Supabase settings. Both values are safe to expose: the publishable
 * (anon) key only grants what Row Level Security allows. The service/secret
 * key must NEVER use a NEXT_PUBLIC_ name.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Server-side only: in production the app container reaches Supabase over the
 * private Docker network (SUPABASE_INTERNAL_URL) instead of going out to the
 * public domain and back. Falls back to the public URL (local development).
 */
export function serverSupabaseEnv(): { url: string; key: string } | null {
  const env = supabaseEnv();
  if (!env) return null;
  return { url: process.env.SUPABASE_INTERNAL_URL || env.url, key: env.key };
}

/**
 * Fixed auth cookie name. By default it is derived from the Supabase URL,
 * which would differ between the browser (public URL) and the server
 * (internal URL) — pinning it lets both read the same session.
 */
export const AUTH_COOKIE_NAME = 'sb-cineraagam-auth-token';
