import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE } from '@/lib/config';

/** The server client — the anon key plus the caller's session cookie.
 *
 *  This is what almost everything should use, INCLUDING every office screen.
 *  Reading with the user's cookie means row-level security decides what comes
 *  back, so there is exactly one copy of every access rule and it lives in
 *  Postgres. A screen that renders empty for the wrong role is the correct
 *  outcome, not a bug to work around with the service role.
 *
 *  This is also the change that made moving to Next worth doing: the catalogue
 *  kept its session in localStorage, which a server component and middleware
 *  cannot see. Cookies can.
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE.url, SUPABASE.anonKey, {
    // Without this every query silently looks in `public` and finds nothing.
    db: { schema: SUPABASE.schema },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // middleware.js refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** The signed-in person's allowlist row, or null.
 *
 *  Always filtered by the caller's own phone, never an unfiltered
 *  select().maybeSingle(). There are two SELECT policies on allowlist —
 *  everyone reads their own row, an admin reads them all — so for an admin an
 *  unfiltered select returns every row, maybeSingle() rejects with "multiple
 *  rows returned", and the caller reads that failure as "not on the list".
 *  That is exactly how a real admin got told their number was unrecognised.
 */
export async function currentUser() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const phone = String(user.phone || '').replace(/\D/g, '');
  if (!phone) return { authed: true, phone: null, row: null, reason: 'no phone on the session' };

  const { data, error } = await sb
    .from('allowlist')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  // A failed lookup and a genuinely absent row must not look the same to the
  // caller. Collapsing them is what let a 404 masquerade as a rejected number
  // for a whole round of testing.
  if (error) {
    return {
      authed: true,
      phone,
      row: null,
      reason: `${error.code ? error.code + ' ' : ''}${error.message || 'lookup failed'}`,
    };
  }
  return { authed: true, phone, row: data || null, reason: data ? null : 'no row for this number' };
}

/** Role helpers, mirroring the SQL of the same names. The database is still
 *  the authority — these decide what to DRAW, never what to allow. */
export const roleOf = (u) => u?.row?.role || 'guest';
export const isAdmin = (u) => !!u?.row?.is_admin;
export const isOffice = (u) => isAdmin(u) || roleOf(u) === 'staff';
export const isDealer = (u) => ['dealer', 'shop_owner'].includes(roleOf(u));
export const isEndCustomer = (u) => roleOf(u) === 'end_customer';
/** Office staff never order — an order they placed would be addressed to
 *  themselves — and a consumer buys from a shop, not from us. */
export const canOrder = (u) => isDealer(u);
