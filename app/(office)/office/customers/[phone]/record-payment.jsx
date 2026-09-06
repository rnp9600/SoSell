'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/pm/sheet';
import { rupee, suggestChip, CHIPS } from '@/lib/money';

/** Taking money at the counter.
 *
 *  The chips exist because a collector standing in a shop wants a round number
 *  to suggest, not 7.5% of ₹83,412. They round to ₹2,500, or ₹5,000 once the
 *  outstanding is over a lakh.
 *
 *  Cash and cheque are approved on entry — the collector is standing there and
 *  saw it happen. Online is the only mode nobody watched, so it is the only one
 *  that waits for verification. That asymmetry is deliberate.
 *
 *  A cheque is recorded as PENDING regardless of its date. It clears when the
 *  bank pays it, not when its date arrives.
 */
export default function RecordPayment({ customerPhone, display, outstanding, lastBank }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('cash');
  const [amount, setAmount] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [bank, setBank] = useState(lastBank || '');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const amt = Number(String(amount).replace(/[^\d.]/g, '')) || 0;
  const ready = amt > 0 && (mode !== 'cheque' || (chequeDate && bank.trim()));

  async function record() {
    if (!ready || busy) return;
    setBusy(true); setError('');
    const { data, error: err } = await settle(
      () =>
        supabaseBrowser().rpc('record_payment', {
          payload: {
            customer_phone: customerPhone,
            mode,
            amount: amt,
            cheque_no: chequeNo || null,
            cheque_date: mode === 'cheque' ? chequeDate : null,
            bank_name: mode === 'cheque' ? bank.trim() : null,
            utr: mode === 'online' ? utr || null : null,
          },
        }),
      'Recording the payment',
    );
    setBusy(false);
    if (err) return setError(err.message || 'Could not record that.');
    setDone(data);
    router.refresh();
  }

  function reset() {
    setOpen(false); setDone(null); setAmount(''); setChequeNo('');
    setChequeDate(''); setUtr(''); setError('');
  }

  const chips = outstanding > 0
    ? [...CHIPS.map((c) => ({ ...c, value: suggestChip(outstanding, c.pct) })),
       { label: 'Full', value: Math.round(outstanding) }]
    : [];

  return (
    <>
      <Button size="lg" block onClick={() => setOpen(true)}>
        Record a payment
      </Button>

      <Sheet
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : reset())}
        title={done ? 'Recorded' : 'Record a payment'}
        description={done ? undefined : display}
        footer={
          done ? (
            <Button block onClick={reset}>Done</Button>
          ) : (
            <Button block size="lg" disabled={!ready || busy} onClick={record}>
              {busy ? 'Recording…' : `Record ${amt > 0 ? rupee(amt) : ''}`}
            </Button>
          )
        }
      >
        {done ? (
          <div className="py-2 text-center">
            <p className="font-mono text-2xl font-bold text-brand">{done}</p>
            <p className="mt-2 text-ink-2">
              {mode === 'cheque'
                ? 'Recorded as a cheque. It stays uncleared until the bank pays it.'
                : mode === 'online'
                  ? 'Recorded, and waiting for an admin to verify it.'
                  : 'Recorded and approved.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              {['cash', 'cheque', 'online'].map((m) => (
                <button
                  key={m} type="button" onClick={() => setMode(m)}
                  className={`min-h-tap flex-1 rounded-full border text-sm font-semibold capitalize ${
                    mode === m
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-line bg-surface text-ink-2'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amt">Amount</Label>
              <Input id="amt" inputMode="numeric" value={amount} autoFocus
                     onChange={(e) => setAmount(e.target.value)}
                     placeholder="0" className="h-12 text-lg tabular-nums" />
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {chips.map((c) => (
                    <button key={c.label} type="button"
                            onClick={() => setAmount(String(c.value))}
                            className="inline-flex min-h-tap items-center rounded-full bg-surface-2 px-3 text-sm text-ink-2">
                      {c.label} · {rupee(c.value)}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-sm text-ink-3">Outstanding {rupee(outstanding)}</p>
            </div>

            {mode === 'cheque' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank">Bank</Label>
                  <Input id="bank" value={bank} onChange={(e) => setBank(e.target.value)}
                         placeholder="Which bank" className="h-11" />
                  {lastBank && (
                    <p className="text-sm text-ink-3">Last time: {lastBank}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="cno">Cheque number</Label>
                    <Input id="cno" inputMode="numeric" value={chequeNo}
                           onChange={(e) => setChequeNo(e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cdt">Dated</Label>
                    <Input id="cdt" type="date" value={chequeDate}
                           onChange={(e) => setChequeDate(e.target.value)} className="h-11" />
                  </div>
                </div>
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  This will not reduce the outstanding until somebody marks it
                  cleared — a date passing is not the bank paying.
                </p>
              </>
            )}

            {mode === 'online' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="utr">UTR or reference</Label>
                  <Input id="utr" value={utr} onChange={(e) => setUtr(e.target.value)}
                         className="h-11" />
                </div>
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">
                  Online payments wait for an admin to verify them.
                </p>
              </>
            )}

            {error && <p className="text-sm text-bad">{error}</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}
