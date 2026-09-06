'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/pm/sheet';

/** The only Sign out in the app. It asks first — signing out costs an SMS to
 *  undo, and on a shared counter phone it is easy to hit by accident. */
export default function SignOutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    try { await supabaseBrowser().auth.signOut(); } catch { /* leaving anyway */ }
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" block onClick={() => setOpen(true)}>
        Sign out
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Sign out?"
        description="You will need a new code by SMS to sign back in."
        footer={
          <div className="flex gap-2">
            <Button variant="quiet" block onClick={() => setOpen(false)}>
              Stay signed in
            </Button>
            <Button variant="danger" block disabled={busy} onClick={out}>
              {busy ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        }
      >
        <p className="text-ink-2">
          Your saved list and the order in progress stay on this phone.
        </p>
      </Sheet>
    </>
  );
}
