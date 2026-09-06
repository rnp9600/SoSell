/* SoSell — the service worker.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS WORKER DELIBERATELY CACHES NOTHING.
 *
 * It exists for one reason: a browser will not deliver a push notification
 * without one. That is the whole job.
 *
 * A cache-first shell worker — which is what the previous, no-build site
 * used — is ACTIVELY WRONG for this app. Next.js content-hashes its asset
 * names, so a cached shell points at chunks that no longer exist after a
 * deploy, and the result is a blank screen that reloading does not fix.
 *
 * If offline browsing is wanted later, it is a real piece of work: cache
 * /_next/static/** (immutable by construction) and the image bucket, and
 * NEVER an HTML document. Two rules hold whatever else changes:
 *   · never touch *.supabase.co — sessions, orders and the noticeboard go
 *     straight to the network, always;
 *   · never skipWaiting() on install — a half-swapped worker serving a
 *     half-swapped app is worse than a slow update.
 *
 * ── THE KILL SWITCH ────────────────────────────────────────────────────────
 * A bad worker pins a stale copy of the shop onto every dealer's phone and no
 * amount of reloading shifts it. If that ever happens, replace this WHOLE file
 * with the following and deploy:
 *
 *   self.addEventListener('install', () => self.skipWaiting());
 *   self.addEventListener('activate', async () => {
 *     for (const k of await caches.keys()) await caches.delete(k);
 *     await self.registration.unregister();
 *   });
 *
 * ── SWEEPING THE OLD ONE ───────────────────────────────────────────────────
 * The site this replaces cached under `pm-v4-<build>` and `pm-v<build>`. If
 * SoSell is ever served from that same hostname, those caches survive the
 * cutover unless something deletes them — so activate does, below. Removing
 * that sweep is only safe once nobody is left running the old app.
 * ═══════════════════════════════════════════════════════════════════════════
 */

self.addEventListener('install', () => {
  // No precache. Waiting rather than skipping, deliberately.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Sweep the previous site's caches. Ours are none.
      for (const key of await caches.keys()) {
        if (/^pm-v/.test(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SoSell', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SoSell', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // A tag means a second message about the same thing replaces the first
      // rather than stacking up on the lock screen.
      tag: data.tag || 'sosell',
      data: { url: data.url || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Reuse a tab that is already open rather than opening a fifth one.
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) await c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
