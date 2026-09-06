'use client';

import { useEffect } from 'react';

/** Registers the push-only service worker.
 *
 *  It caches nothing (see public/sw.js), so registering it cannot pin a stale
 *  app onto anyone's phone. It is registered on every load rather than behind
 *  the notification permission, because the worker must already exist when
 *  somebody later says yes to notifications.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A registration that fails is not worth interrupting anyone over —
      // everything except push works exactly the same without it.
    });
  }, []);
  return null;
}
