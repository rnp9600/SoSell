/** The cutover checks that cannot be automated, written down so they are not
 *  skipped. Run: node tests/cutover.test.mjs
 *
 *  This asserts the CODE is in place. The two live tests at the bottom need a
 *  real browser against a real deploy and are the ones that actually matter.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

console.log('the session shim');
it('exists and is mounted in the root layout', () => {
  read('components/pm/session-shim.jsx');
  assert.match(read('app/layout.js'), /<SessionShim \/>/);
});
it('reads V3\'s key and removes it', () => {
  const s = read('components/pm/session-shim.jsx');
  assert.match(s, /KEYS\.legacyAuth/);
  assert.match(s, /remove\(KEYS\.legacyAuth\)/);
  assert.match(s, /setSession/);
});

console.log("V3's localStorage keys must never be renamed");
it('the basket key is still v3_pm_basket', () => {
  // Dealers have half-filled baskets under this exact name right now.
  assert.match(read('lib/storage.js'), /cart: 'v3_pm_basket'/);
});
it('saved and recent are still per-account v3 keys', () => {
  const s = read('lib/storage.js');
  assert.match(s, /v3_pm_saved_/);
  assert.match(s, /v3_pm_recent_/);
});
it('lib/storage.js is the only file naming a storage key', () => {
  // Anything else naming one is a rename waiting to happen somewhere nobody
  // is looking. The shim and the theme bootstrap are the documented exceptions.
  const allowed = ['lib/storage.js', 'lib/theme.js'];
  const files = [
    'lib/cart.js', 'lib/saved.js', 'components/pm/session-shim.jsx',
    'app/(shop)/settings/settings-client.jsx',
  ];
  for (const f of files) {
    assert.doesNotMatch(read(f), /'v3_pm_|'v4_pm_|'v3_sb_/,
      `${f} names a storage key directly — go through lib/storage.js`);
  }
});

console.log('/v4/ must rewrite, never redirect');
it('skipTrailingSlashRedirect is on', () => {
  // Next normalises a trailing slash with a 308 BEFORE rewrites run. An
  // installed icon pinned to /v4/ degrades to a browser tab if it redirects.
  assert.match(read('next.config.js'), /skipTrailingSlashRedirect: true/);
});
it('/v4 is a rewrite and not a redirect', () => {
  const s = read('next.config.js');
  const redirects = s.slice(s.indexOf('async redirects'), s.indexOf('async rewrites'));
  // Match an actual route ENTRY, not the word in an explanatory comment —
  // the comments here deliberately talk about /v4 at length.
  assert.doesNotMatch(redirects, /source:\s*'\/v4/,
    '/v4 must not be a redirect source');
  assert.match(s.slice(s.indexOf('async rewrites')), /source:\s*'\/v4'/,
    '/v4 must be a rewrite source');
});

console.log('the service worker must not cache the app');
it('caches nothing and sweeps the old caches', () => {
  const sw = read('public/sw.js');
  assert.doesNotMatch(sw, /caches\.open|cache\.put|cache\.addAll/,
    'a cache-first worker is actively wrong for content-hashed assets');
  assert.match(sw, /pm-v/, 'must sweep the previous site\'s caches');
});

console.log(`\n${pass} passed, ${fail} failed`);
console.log(`
Two things this file CANNOT check. Do them by hand before the domain moves:

  1. Fill a basket on the live catalogue. Deploy SoSell to the same hostname.
     Reload. Basket intact, still signed in.
  2. Seed catalog.voucher_sequence from the last receipt number the office
     actually issued, or the app starts at Mob/1 beside a book at Mob/812.
`);
process.exit(fail ? 1 : 0);
