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
