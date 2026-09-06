import { redirect } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { supabaseServer, currentUser, isDealer } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { Empty } from '@/components/pm/empty';
import { rupee } from '@/lib/money';

export const metadata = { title: 'Your cheques' };
export const dynamic = 'force-dynamic';

const STATE = {
  pending: { label: 'Coming up',  cls: 'bg-warn-wash text-warn' },
  cleared: { label: 'Cleared',    cls: 'bg-ok-wash text-ok' },
  bounced: { label: 'Bounced',    cls: 'bg-bad-wash text-bad' },
};

/** Cheques a dealer has given us, and where each one has got to.
 *
 *  A cheque is 'pending' until somebody says the bank paid it — not because
 *  its date has passed. That distinction is the whole reason this screen can
 *  be trusted: "coming up for clearance" means genuinely outstanding, and a
 *  bounced one is visible rather than silently counted as paid.
 */
export default async function ChequesPage() {
  const me = await currentUser();
  if (!me?.row) redirect('/signin?next=/account/cheques');
  if (!isDealer(me)) redirect('/account');

  const sb = await supabaseServer();
  const { data } = await sb.from('my_cheques').select('*');
  const cheques = data || [];
  const pending = cheques.filter((c) => c.cheque_status === 'pending');
  const pendingTotal = pending.reduce((s, c) => s + Number(c.amount || 0), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="pb-8">
      <Header title="Your cheques" back="/account/ledger" />

      {cheques.length === 0 ? (
        <Empty icon={Landmark} title="No cheques on record"
               body="Any cheque you give us will be listed here with its clearing date." />
      ) : (
        <>
          {pending.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-sm text-ink-2">
                {pending.length} not yet cleared
              </p>
              <p className="text-3xl font-extrabold tabular-nums text-ink">
                {rupee(pendingTotal)}
              </p>
              <p className="mt-1 text-sm text-ink-3">
                These are counted separately and do not reduce your outstanding
                until the bank pays them.
              </p>
            </div>
          )}

          <ul className="divide-y divide-line border-y border-line">
            {cheques.map((c) => {
              const st = STATE[c.cheque_status] || STATE.pending;
              const due = c.cheque_status === 'pending' && c.cheque_date && c.cheque_date <= today;
              return (
                <li key={c.receipt_no} className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {c.bank_name || 'Cheque'}
                      {c.cheque_no && (
                        <span className="ml-2 font-mono text-sm font-normal text-ink-3">
                          {c.cheque_no}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-ink-2">
                      {c.cheque_date
                        ? `Dated ${new Date(c.cheque_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric' })}`
                        : ''}
                      {c.cleared_on && ` · cleared ${new Date(c.cleared_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                      {due && (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                          due for banking
                        </span>
                      )}
                      <span className="font-mono text-xs text-ink-3">{c.receipt_no}</span>
                    </div>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-ink">
                    {rupee(c.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
