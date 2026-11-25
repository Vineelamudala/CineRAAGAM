import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from '@/lib/supabase/env';

/**
 * Runs before matching requests (Next.js 16 "proxy", formerly middleware).
 *
 * Refreshes the player's Supabase session and writes the auth cookies from
 * the server. Server-set cookies are not subject to Safari's 7-day cap on
 * script-written storage, which helps anonymous players keep their identity.
 *
 * It deliberately does NOT create anonymous users: that happens in the
 * browser, so bots and link previews don't create junk accounts and the
 * auth rate limit applies per visitor IP rather than to this server.
 */
export async function proxy(request: NextRequest) {
  const env = supabaseEnv();
  let response = NextResponse.next({ request });
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: toSet => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Validates the JWT and refreshes it when expired. Do not remove.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Skip static files, images and the manifest.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|robots.txt|api/catalog|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|ogg|woff2?)$).*)',
  ],
};
