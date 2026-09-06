import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '@/lib/config';

/** The service-role client. It bypasses row-level security completely.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  THE RULE
 *
 *  This module may be imported from exactly three places, and each is a path
 *  that announces itself in the file tree:
 *
 *    1. app/api/cron/**          jobs that act as nobody, guarded by CRON_SECRET
 *    2. app/api/push/send        delivering to phones other than the caller's,
 *                                which by definition reads another person's
 *                                subscription row
 *    3. scripts/**               one-off jobs, never imported by the app
 *
 *  Everywhere else — INCLUDING every office and admin screen — uses
 *  lib/supabase/server.js: the anon key plus the session, with RLS deciding.
 *
 *  The test to apply in review: *would this code be wrong if RLS were
 *  enforced?* If the answer is yes, the code is wrong, not RLS.
 *
 *  `yarn check:secrets` fails the build if this module is imported anywhere
 *  else. That check is the enforcement; this comment is the reason.
 *  ─────────────────────────────────────────────────────────────────────────
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not set. It is required only by the cron and ' +
        'push-delivery routes; every other path should use lib/supabase/server.',
    );
  }
  return createClient(SUPABASE.url, key, {
    db: { schema: SUPABASE.schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
