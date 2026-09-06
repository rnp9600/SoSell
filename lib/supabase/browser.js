'use client';

/** The browser client.
 *
 *  Three things here are fixes for live failures, not incidental code. Each
 *  cost a round of debugging on the catalogue; do not remove them.
 */

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE } from '@/lib/config';

/** FIX 1 — the web lock deadlock.
 *
 *  By default supabase-js serialises auth calls with navigator.locks, shared
 *  across every tab on the same origin. On a phone with many tabs open, a
 *  backgrounded tab can be suspended while holding that lock — and then every
 *  auth call in this tab waits on it forever: no network request is ever made,
 *  no error is raised, the button just sits on "Sending…".
 *
 *  This app only ever has one client doing auth, so cross-tab coordination
 *  buys nothing. Queue in-page instead: same ordering guarantee, no dependency
 *  on a lock another tab might be sitting on.
 */
let chain = Promise.resolve();
function inPageLock(_name, _acquireTimeout, fn) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => {},
    () => {},
  ); // never let a failure break the queue
  return run;
}

let client;

export function supabaseBrowser() {
  if (client) return client;
  client = createBrowserClient(SUPABASE.url, SUPABASE.anonKey, {
    /** FIX 2 — the schema.
     *
     *  Every table and function this app uses lives in `catalog`, not
     *  `public`. Without this the client silently queries public.* —
     *  from('allowlist') looks for public.allowlist — and every call fails.
     *  The sign-in symptom was the worst kind: the OTP verified fine, then
     *  the allowlist lookup came back empty and the screen said "we do not
     *  recognise that number" about a number that was plainly there.
     */
    db: { schema: SUPABASE.schema },
    auth: { lock: inPageLock },
  });
  return client;
}

/** FIX 3 — an answer, always.
 *
 *  Supabase's auth calls normally resolve with {data, error}. But a dropped
 *  connection can make the underlying fetch reject, and an auth hook that
 *  stalls (ours calls an SMS provider) can leave the request open with no
 *  answer at all. Either way the caller's await would never come back and the
 *  button would sit on "Sending…" with nothing to tell the reader.
 *
 *  Takes a FUNCTION, not a promise. If sb.auth is not the shape we expect
 *  (a mismatched library build), calling the method throws synchronously —
 *  and had we been handed the already-created promise, the throw would happen
 *  while evaluating the argument, before this try block. Starting the call in
 *  here means a synchronous throw is caught too.
 */
const TIMEOUT_MS = 30000;

export async function settle(start, what) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(start),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${what} took too long. Please try again.`)),
          TIMEOUT_MS,
        );
      }),
    ]);
  } catch (e) {
    // Surface the real reason rather than a generic failure — it is the only
    // diagnostic the person on the phone can read back to us.
    return { error: { message: (e && e.message) || `${what} failed.` } };
  } finally {
    clearTimeout(timer);
  }
}

export const digits = (s) => String(s || '').replace(/\D/g, '');
export const toE164 = (s) => '+91' + digits(s).slice(-10);

/** Turn a Supabase auth error into a sentence a person can act on. */
export function friendlyAuthError(error) {
  if (!error) return '';
  const m = error.message || '';
  if (error.status === 429 || /rate limit/i.test(m)) {
    return 'Too many attempts. Please try again in an hour.';
  }
  // The PIN path returns this, and "invalid login credentials" tells a tester
  // nothing about which of the two things they got wrong.
  if (/invalid login credentials/i.test(m)) {
    return 'That PIN is not right for this number.';
  }
  // Supabase reports a failing Send SMS hook as a bare status code, which
  // means nothing to the reader. The code is kept for us; the sentence is
  // for them.
  if (/from hook/i.test(m) || /\b50[0-9]\b/.test(m)) {
    return (
      'We could not send the code just now — the SMS service refused it. ' +
      `Please try again in a moment. (${m})`
    );
  }
  return m || 'Something went wrong — please try again.';
}
