'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/pm/icon';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

/** Marks what is on screen as read, and offers push.
 *
 *  ⚠ THE PERMISSION IS ASKED HERE, NEVER ON LOAD. A notification prompt that
 *  appears the moment somebody opens a shop is the fastest way to get denied
 *  permanently — and once denied, the browser will not ask again. Asking on
 *  the screen that is *about* notifications means the request makes sense when
 *  it arrives.
 */
export default function MarkRead({ ids }) {
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (!ids.length) return;
    supabaseBrowser().rpc('mark_notifications_read', { p_ids: ids }).then(() => {});
  }, [ids]);

  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  if (!supported || state === 'done') return null;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return null;
  // Denied is final — the browser will not ask again, and nagging about it in
  // the UI helps nobody.
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return null;

  async function enable() {
    setState('asking');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState('idle');
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return setState('idle');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const j = sub.toJSON();
      await supabaseBrowser().from('push_subscriptions').upsert(
        {
          endpoint: j.endpoint,
          p256dh: j.keys.p256dh,
          auth: j.keys.auth,
          user_agent: navigator.userAgent.slice(0, 200),
        },
        { onConflict: 'endpoint' },
      );
      setState('done');
    } catch {
      setState('idle');
    }
  }

  return (
    <div className="border-b border-line bg-surface-2 px-5 py-4">
      <p className="font-semibold text-ink">Get these on your phone</p>
      <p className="mb-3 text-sm text-ink-2">
        We will only send what matters — an order update, or a message from the
        office.
      </p>
      <Button size="sm" disabled={state === 'asking'} onClick={enable}>
        <Icon name="bell" className="size-4" />
        {state === 'asking' ? 'Asking…' : 'Turn on notifications'}
      </Button>
    </div>
  );
}
