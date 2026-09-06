'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/pm/sheet';
import { Empty } from '@/components/pm/empty';
import { rupee } from '@/lib/money';

/** Cheques, and what happened to each.
 *
 *  This screen exists because a cheque clearing is an EVENT somebody records,
 *  not a date passing. The prototype had no way to say a cheque bounced at
 *  all, so a bounced one silently stayed counted as paid — the money vanished
 *  from the ledger and nobody found out for weeks.
 */
export default function ChequesClient({ cheques }) {
  const router = useRouter();
  const [tab, setTab] = useState('pending');
  const [target, setTarget] = useState(null);
  const [action, setAction] = useState('clear');
  const [on, setOn] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const shown = cheques.filter((c) => c.cheque_status === tab);
  const dueCount = cheques.filter(
    (c) => c.cheque_status === 'pending' && c.cheque_date && c.cheque_date <= today,
  ).length;
  const pendingTotal = cheques
    .filter((c) => c.cheque_status === 'pending')
    .reduce((s, c) => s + Number(c.amount), 0);

  async function submit() {
    if (!target || busy) return;
    setBusy(true); setError('');
    const sb = supabaseBrowser();
    const { error: err } = await settle(
      () =>
        action === 'clear'
          ? sb.rpc('clear_cheque', { p_id: target.id, p_on: on })
          : sb.rpc('bounce_cheque', { p_id: target.id, p_reason: reason || null }),
      action === 'clear' ? 'Clearing the cheque' : 'Marking it bounced',
    );
    setBusy(false);
    if (err) return setError(err.message || 'That did not work.');
    setTarget(null); setReason('');
    router.refresh();
  }

  const TABS = [
    ['pending', 'Not cleared'],
    ['cleared', 'Cleared'],
    ['bounced', 'Bounced'],
  ];

  return (
    <main>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Cheques</h1>
      <p className="mt-1 text-ink-2">
        {rupee(pendingTotal)} uncleared
        {dueCount > 0 && <span className="text-warn"> · {dueCount} due to bank</span>}
      </p>

      <div className="mt-4 flex gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
                  className={`min-h-tap rounded-full border px-4 text-sm font-semibold ${
                    tab === id ? 'border-brand bg-brand text-on-brand'
                               : 'border-line bg-surface text-ink-2'}`}>
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty icon={Landmark} title={`No ${tab} cheques`} className="mt-6" />
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
          {shown.map((c) => {
            const due = c.cheque_status === 'pending' && c.cheque_date && c.cheque_date <= today;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/office/customers/${c.customer_phone}`}
                        className="truncate font-semibold text-ink">
                    {c.display || `+91 ${String(c.customer_phone).slice(-10)}`}
                  </Link>
                  <p className="text-sm text-ink-2">
                    {c.bank_name || 'Cheque'} {c.cheque_no} · dated{' '}
                    {c.cheque_date && new Date(c.cheque_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric' })}
                    {due && <span className="ml-1 font-semibold text-warn">· due</span>}
                  </p>
                  <p className="font-mono text-xs text-ink-3">{c.receipt_no}</p>
                  {c.bounce_reason && (
                    <p className="text-sm text-bad">{c.bounce_reason}</p>
                  )}
                </div>
                <span className="font-bold tabular-nums text-ink">{rupee(c.amount)}</span>
                {c.cheque_status === 'pending' && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button size="sm" onClick={() => { setTarget(c); setAction('clear'); }}>
                      Cleared
                    </Button>
                    <Button size="sm" variant="danger"
                            onClick={() => { setTarget(c); setAction('bounce'); }}>
                      Bounced
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        title={action === 'clear' ? 'The bank paid it' : 'The cheque bounced'}
        description={target ? `${target.bank_name || 'Cheque'} ${target.cheque_no || ''} · ${rupee(target.amount)}` : ''}
        footer={
          <Button block size="lg" variant={action === 'clear' ? 'primary' : 'danger'}
                  disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : action === 'clear' ? 'Mark cleared' : 'Mark bounced'}
          </Button>
        }
      >
        {action === 'clear' ? (
          <div className="space-y-2">
            <Label htmlFor="on">Cleared on</Label>
            <Input id="on" type="date" value={on} onChange={(e) => setOn(e.target.value)}
                   className="h-11" />
            <p className="text-sm text-ink-2">
              This reduces their outstanding by {target ? rupee(target.amount) : ''}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="why">Why (optional)</Label>
            <Input id="why" value={reason} onChange={(e) => setReason(e.target.value)}
                   placeholder="Insufficient funds, signature, stopped…" className="h-11" />
            <p className="rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">
              The {target ? rupee(target.amount) : ''} goes back onto their
              outstanding, and the customer will see it on their statement.
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      </Sheet>
    </main>
  );
}
