'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

/** Starting the day.
 *
 *  start_collection() is idempotent on (route, today) — pressing this twice on
 *  a shaky signal in a shop doorway must not open two day sheets for the same
 *  route, and on a phone that is exactly what happens.
 */
export default function StartRoute({ routeId, disabled }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setBusy(true); setError('');
    const { data, error: err } = await settle(
      () => supabaseBrowser().rpc('start_collection', { p_route: routeId }),
      'Starting the route',
    );
    setBusy(false);
    if (err) return setError(err.message || 'Could not start it.');
    router.push(`/office/collections/${data}`);
  }

  return (
    <>
      <Button onClick={start} disabled={busy || disabled}>
        {busy ? 'Starting…' : 'Start route'}
      </Button>
      {error && <p className="mt-1 text-sm text-bad">{error}</p>}
    </>
  );
}
