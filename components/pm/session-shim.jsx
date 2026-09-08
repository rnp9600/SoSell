'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { KEYS, readRaw, remove } from '@/lib/storage';

/** Carry the old session across, once.
 *
 *  ═══════════════════════════════════════════════════════════════════════
 *  WITHOUT THIS, CUTOVER DAY SIGNS EVERY DEALER OUT.
 *
 *  The catalogue keeps its Supabase session in localStorage under
 *  `v3_sb_auth`. SoSell keeps it in a cookie, because a server component and
 *  middleware cannot read localStorage. Those are two different places, so on
 *  the morning the domain moves, every dealer who was signed in is suddenly
 *  not — and signing back in costs a real SMS each, on a number they may not
 *  have to hand.
 *
 *  So: read the old session ONCE, hand it to setSession() so the cookie is
 *  written, and remove the key. After that this is a no-op forever.
 *
 *  ── THE ACCEPTANCE TEST ────────────────────────────────────────────────
 *  Fill a basket on the live site. Deploy SoSell to the SAME hostname.
 *  Reload. The basket must be intact and you must still be signed in.
 *  Skip that test and you find out from the dealers.
 *  ═══════════════════════════════════════════════════════════════════════
 *
 *  The basket needs nothing — lib/storage.js keeps V3's keys deliberately, so
 *  it is already where the app looks. Only the session has moved house.
 */
export function SessionShim() {
  useEffect(() => {
    const raw = readRaw(KEYS.legacyAuth);
    if (!raw) return;

    let tokens;
    try {
      const parsed = JSON.parse(raw);
      // supabase-js has stored this a couple of ways over the years. Accept
      // either shape rather than assuming the one we happen to have seen.
      const s = parsed?.currentSession || parsed;
      if (s?.access_token && s?.refresh_token) {
        tokens = { access_token: s.access_token, refresh_token: s.refresh_token };
      }
    } catch {
      // Unreadable. Removing it below is still right — it cannot be used.
    }

    // Drop the key whatever happened. Leaving an unusable session behind means
    // this runs on every load forever, and a stale token is not worth keeping.
    remove(KEYS.legacyAuth);
    if (!tokens) return;

    supabaseBrowser()
      .auth.setSession(tokens)
      .then(({ error }) => {
        // A refresh token that has already expired is the normal failure here,
        // and there is nothing to do about it — they sign in as they would
        // have anyway. Reloading only helps when it worked.
        if (!error) window.location.reload();
      })
      .catch(() => {});
  }, []);

  return null;
}
