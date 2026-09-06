'use client';

/** The ONLY file that names a localStorage key.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  THE KEYS SAY v3 ON PURPOSE. DO NOT RENAME THEM.
 *
 *  Dealers are using the catalogue right now, and some of them have a basket
 *  half-filled. Those baskets live under these exact names in those exact
 *  browsers. Renaming a key does not migrate anything — it empties every
 *  dealer's basket simultaneously, and they would have no idea why.
 *
 *  V4 kept V3's keys when it took the root for the same reason. SoSell keeps
 *  them again. The names are historical; that is the whole point of them.
 *  ─────────────────────────────────────────────────────────────────────────
 */
export const KEYS = {
  cart: 'v3_pm_basket',                       // [{slug, size, qty}] — nothing else
  saved: (who) => `v3_pm_saved_${who || 'guest'}`,
  recent: (who) => `v3_pm_recent_${who || 'guest'}`,
  orderSeq: (yyyymmdd) => `v3_pm_order_seq_${yyyymmdd}`,
  recentSearches: 'v4_pm_recent_q',
  source: 'v4_pm_source',                     // 'file' | 'live'
  lastOrder: 'v4_last_order',
  walked: 'v4_walked',                        // sessionStorage
  theme: 'v4_pm_theme',                       // sky | teal | emerald | charcoal
  mode: 'v4_pm_mode',                         // light | dark | auto
  fontSize: 'v4_pm_fs',                       // s | m | l | xl
  motion: 'v4_pm_motion',                     // full | none
  /** The catalogue's Supabase session, in localStorage. SoSell uses cookies,
   *  so this is read exactly once, handed to setSession(), and removed — see
   *  components/pm/session-shim.jsx. Without that, cutover day signs every
   *  dealer out. */
  legacyAuth: 'v3_sb_auth',
};

const canUse = () => typeof window !== 'undefined';

export function read(key, fallback = null) {
  if (!canUse()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    // A private window, cleared site data, or a browser set to block storage.
    return fallback;
  }
}

export function write(key, value) {
  if (!canUse()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  if (!canUse()) return;
  try { window.localStorage.removeItem(key); } catch {}
}

/** Raw string read — the legacy Supabase session is stored as JSON by
 *  supabase-js and must be handed over untouched. */
export function readRaw(key) {
  if (!canUse()) return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
