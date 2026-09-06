'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/pm/sheet';
import { Empty } from '@/components/pm/empty';
import { rupee } from '@/lib/money';

function Section({ title, note, children }) {
  return (
    <section className="mb-7">
      <h2 className="font-bold text-ink">{title}</h2>
      {note && <p className="mb-2 text-sm text-ink-3">{note}</p>}
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
        {children}
      </ul>
    </section>
  );
}

export default function ApprovalsClient({ payments, adjustments, signups, issues, reopens }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const total = payments.length + adjustments.length + signups.length + issues.length + reopens.length;

  async function call(key, fn) {
    setBusy(key); setError('');
    const { error: err } = await settle(fn, 'Saving that decision');
    setBusy(null);
    if (err) return setError(err.message || 'That did not work.');
    setReject(null); setReason('');
    router.refresh();
  }

  const sb = () => supabaseBrowser();

  if (total === 0) {
    return (
      <main>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Approvals</h1>
        <Empty icon={ClipboardCheck} title="Nothing waiting"
               body="Payments to verify, notes to approve, sign-ups to decide and queries to answer all land here."
               className="mt-6" />
      </main>
    );
  }

  return (
    <main>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Approvals</h1>
      <p className="mb-5 mt-1 text-ink-2">{total} waiting</p>
      {error && <p className="mb-4 rounded-lg bg-bad-wash px-4 py-3 text-sm text-bad">{error}</p>}

      {payments.length > 0 && (
        <Section title="Online payments"
                 note="Nobody watched these arrive, which is why they wait.">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/office/customers/${p.customer_phone}`} className="font-semibold text-ink">
                  {p.display}
                </Link>
                <p className="text-sm text-ink-2">
                  {p.receipt_no}{p.utr ? ` · ${p.utr}` : ''}
                </p>
              </div>
              <span className="font-bold tabular-nums text-ink">{rupee(p.amount)}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === `p${p.id}`}
                        onClick={() => call(`p${p.id}`, () =>
                          sb().rpc('decide_payment', { p_id: p.id, p_ok: true }))}>
                  Verify
                </Button>
                <Button size="sm" variant="danger"
                        onClick={() => setReject({ kind: 'payment', id: p.id, label: p.display })}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </Section>
      )}

      {adjustments.length > 0 && (
        <Section title="Credit and discount notes"
                 note="Approving assigns a real receipt number in place of the temporary one.">
          {adjustments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/office/customers/${a.customer_phone}`} className="font-semibold text-ink">
                  {a.display}
                </Link>
                <p className="text-sm text-ink-2">
                  {a.kind === 'credit' ? 'Credit' : 'Discount'} · {a.reason || 'no reason given'}
                </p>
                <p className="font-mono text-xs text-ink-3">{a.receipt_no}</p>
              </div>
              <span className="font-bold tabular-nums text-ink">{rupee(a.amount)}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === `a${a.id}`}
                        onClick={() => call(`a${a.id}`, () =>
                          sb().rpc('decide_adjustment', { p_id: a.id, p_ok: true }))}>
                  Approve
                </Button>
                <Button size="sm" variant="danger"
                        onClick={() => setReject({ kind: 'adjustment', id: a.id, label: a.display })}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </Section>
      )}

      {signups.length > 0 && (
        <Section title="People asking to join"
                 note="You only see the kinds your department may decide.">
          {signups.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{s.display}</p>
                <p className="text-sm text-ink-2">
                  {s.kind.replace('_', ' ')} · +91 {String(s.phone).slice(-10)}
                  {s.city ? ` · ${s.city}` : ''}
                </p>
                {s.note && <p className="text-sm text-ink-3">{s.note}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy === `s${s.id}`}
                        onClick={() => call(`s${s.id}`, () =>
                          sb().rpc('decide_signup', { p_id: s.id, p_ok: true }))}>
                  Let them in
                </Button>
                <Button size="sm" variant="danger"
                        onClick={() => setReject({ kind: 'signup', id: s.id, label: s.display })}>
                  Decline
                </Button>
              </div>
            </li>
          ))}
        </Section>
      )}

      {reopens.length > 0 && (
        <Section title="Routes asking to be reopened"
                 note="Ending a route is what makes the day's figures trustworthy.">
          {reopens.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/office/collections/${c.id}`} className="font-semibold text-ink">
                  Route {c.route_id}
                </Link>
                <p className="text-sm text-ink-2">
                  {new Date(c.on_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <Button size="sm" disabled={busy === `r${c.id}`}
                      onClick={() => call(`r${c.id}`, () =>
                        sb().rpc('approve_reopen', { p_collection: c.id }))}>
                Reopen it
              </Button>
            </li>
          ))}
        </Section>
      )}

      {issues.length > 0 && (
        <Section title="Queries" note="Raised against a bill, a receipt or an order.">
          {issues.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <p className="font-semibold text-ink">{i.display}</p>
              <p className="text-sm text-ink-2">{i.note}</p>
              <p className="mt-0.5 text-sm text-ink-3">
                about a {i.entry_kind} · raised by +91 {String(i.raised_by).slice(-10)}
              </p>
            </li>
          ))}
        </Section>
      )}

      <Sheet
        open={!!reject} onOpenChange={(v) => !v && setReject(null)}
        title="Say why"
        description={reject?.label}
        footer={
          <Button block variant="danger" disabled={!!busy}
                  onClick={() => {
                    if (!reject) return;
                    const { kind, id } = reject;
                    call(`x${id}`, () =>
                      kind === 'payment'
                        ? sb().rpc('decide_payment', { p_id: id, p_ok: false, p_note: reason })
                        : kind === 'adjustment'
                          ? sb().rpc('decide_adjustment', { p_id: id, p_ok: false, p_note: reason })
                          : sb().rpc('decide_signup', { p_id: id, p_ok: false, p_note: reason }));
                  }}>
            {busy ? 'Saving…' : 'Reject'}
          </Button>
        }
      >
        <Input value={reason} onChange={(e) => setReason(e.target.value)}
               placeholder="The person will see this" className="h-11" autoFocus />
      </Sheet>
    </main>
  );
}
