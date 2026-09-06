'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Check, Clock, X, SkipForward } from 'lucide-react';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/pm/sheet';
import { AgingBadge } from '@/components/pm/aging-badge';
import { rupee } from '@/lib/money';

const OUTCOMES = [
  { id: 'paid',          label: 'Paid',          icon: Check,       cls: 'bg-ok-wash text-ok' },
  { id: 'not_available', label: 'Not available', icon: Clock,       cls: 'bg-warn-wash text-warn' },
  { id: 'refused',       label: 'Refused',       icon: X,           cls: 'bg-bad-wash text-bad' },
  { id: 'skipped',       label: 'Skipped',       icon: SkipForward, cls: 'bg-surface-2 text-ink-2' },
];

/** The day sheet — one card per shop, worked through in order.
 *
 *  Ending the route locks the VISIT statuses and nothing else. Payments stay
 *  allowed deliberately: money that arrives after the sheet is closed is still
 *  money, and refusing to record it would mean somebody writing it on paper.
 *
 *  Reopening is a request and an admin decision rather than a button, because
 *  the lock is the only thing making the day's figures trustworthy.
 */
export default function DaySheet({ collection, route, visits }) {
  const router = useRouter();
  const [target, setTarget] = useState(null);
  const [outcome, setOutcome] = useState('not_available');
  const [followup, setFollowup] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);

  const ended = collection.status === 'ended';
  const done = visits.filter((v) => v.status !== 'not_visited').length;
  const collected = visits.filter((v) => v.status === 'paid').length;

  async function saveVisit() {
    if (!target || busy) return;
    setBusy(true); setError('');
    const { error: err } = await settle(
      () =>
        supabaseBrowser().rpc('set_visit', {
          p_collection: collection.id,
          p_customer: target.customer_phone,
          p_status: outcome,
          p_followup: outcome === 'not_available' && followup ? followup : null,
          p_note: note || null,
        }),
      'Saving the visit',
    );
    setBusy(false);
    if (err) return setError(err.message || 'Could not save that.');
    setTarget(null); setNote(''); setFollowup('');
    router.refresh();
  }

  async function endRoute() {
    setBusy(true);
    const { error: err } = await settle(
      () => supabaseBrowser().rpc('end_collection', { p_collection: collection.id }),
      'Ending the route',
    );
    setBusy(false); setEnding(false);
    if (!err) router.refresh();
  }

  async function askReopen() {
    setBusy(true);
    await settle(
      () => supabaseBrowser().rpc('request_reopen', { p_collection: collection.id }),
      'Asking for it to be reopened',
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <main>
      <div className="mb-4">
        <Link href="/office/routes" className="text-sm font-semibold text-brand">← Routes</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          {route?.name || 'Day sheet'}
        </h1>
        <p className="text-ink-2">
          {new Date(collection.on_date).toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}{done} of {visits.length} done · {collected} paid
        </p>
        {ended && (
          <p className="mt-2 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">
            This route was ended, so visits can no longer be changed. Payments
            can still be recorded — money that arrives late is still money.
            {collection.reopen_requested_at
              ? ' An admin has been asked to reopen it.'
              : ''}
          </p>
        )}
      </div>

      <ul className="space-y-3">
        {visits.map((v) => {
          const oc = OUTCOMES.find((o) => o.id === v.status);
          const b = v.balance;
          return (
            <li key={v.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/office/customers/${v.customer_phone}`}
                        className="font-bold text-ink">
                    {b?.display || `+91 ${String(v.customer_phone).slice(-10)}`}
                  </Link>
                  <p className="text-sm text-ink-2">
                    {rupee(b?.outstanding || 0)} outstanding
                    {Number(b?.pdc_pending) > 0 && ` · ${rupee(b.pdc_pending)} in cheques`}
                  </p>
                  {b && <AgingBadge tier={b.aging_tier} days={b.aging_days} className="mt-1.5" />}
                  {v.followup_date && (
                    <p className="mt-1 text-sm text-warn">
                      Come back {new Date(v.followup_date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short' })}
                    </p>
                  )}
                  {v.note && <p className="mt-1 text-sm text-ink-3">{v.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {oc && (
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${oc.cls}`}>
                      {oc.label}
                    </span>
                  )}
                  <a href={`tel:+91${String(v.customer_phone).slice(-10)}`}
                     aria-label="Call"
                     className="grid size-11 place-items-center rounded-full border border-line text-ink-2">
                    <Phone className="size-4" />
                  </a>
                </div>
              </div>

              {!ended && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/office/customers/${v.customer_phone}`}>Take payment</Link>
                  </Button>
                  {OUTCOMES.filter((o) => o.id !== 'paid').map((o) => (
                    <Button key={o.id} size="sm" variant="quiet"
                            onClick={() => { setTarget(v); setOutcome(o.id); setNote(v.note || ''); }}>
                      {o.label}
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        {ended ? (
          !collection.reopen_requested_at && (
            <Button variant="secondary" block disabled={busy} onClick={askReopen}>
              Ask an admin to reopen this
            </Button>
          )
        ) : (
          <Button variant="danger" block size="lg" onClick={() => setEnding(true)}>
            End route
          </Button>
        )}
      </div>

      <Sheet
        open={!!target} onOpenChange={(v) => !v && setTarget(null)}
        title={OUTCOMES.find((o) => o.id === outcome)?.label || 'Visit'}
        description={target?.balance?.display}
        footer={
          <Button block size="lg" disabled={busy} onClick={saveVisit}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="space-y-4">
          {outcome === 'not_available' && (
            <div className="space-y-2">
              <Label htmlFor="fu">Come back on</Label>
              <Input id="fu" type="date" value={followup}
                     onChange={(e) => setFollowup(e.target.value)} className="h-11" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="nt">Note (optional)</Label>
            <Input id="nt" value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="Shop shut, owner travelling, will pay Friday…"
                   className="h-11" />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      </Sheet>

      <Sheet
        open={ending} onOpenChange={setEnding}
        title="End this route?"
        description="Visits can no longer be changed afterwards."
        footer={
          <div className="flex gap-2">
            <Button variant="quiet" block onClick={() => setEnding(false)}>Not yet</Button>
            <Button variant="danger" block disabled={busy} onClick={endRoute}>
              {busy ? 'Ending…' : 'End route'}
            </Button>
          </div>
        }
      >
        <p className="text-ink-2">
          {done} of {visits.length} shops have an outcome recorded.
          {done < visits.length && ' The rest will stay as not visited.'}
          {' '}Reopening needs an admin.
        </p>
      </Sheet>
    </main>
  );
}
