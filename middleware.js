import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE } from '@/lib/config';

/** Refresh the session cookie, and nothing else.
 *
 *  This middleware performs NO authorisation. It is tempting to gate /office
 *  here, and it would be wrong: the rule would then live in two places, and
 *  the copy in Postgres is the one that actually holds. Row-level security
 *  decides what a person can read; this only makes sure their token is fresh
 *  enough to be judged by it.
 *
 *  getUser() (not getSession()) is deliberate — it revalidates the token with
 *  Supabase rather than trusting what the cookie claims.
 */
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE.url, SUPABASE.anonKey, {
    db: { schema: SUPABASE.schema },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    /* Everything except static assets, the service worker, the manifest, and
       the public product-preview page — which must stay reachable to a crawler
       with no session at all. */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|p/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
