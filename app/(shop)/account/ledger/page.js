import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText, Wallet } from 'lucide-react';
import { supabaseServer, currentUser, isDealer } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { AgingBadge } from '@/components/pm/aging-badge';
import { Empty } from '@/components/pm/empty';
import { rupee } from '@/lib/money';
import { fyLabel, currentFY } from '@/lib/fy';
import { FIRM } from '@/lib/config';

export const metadata = { title: 'Your account with us' };
export const dynamic = 'force-dynamic';

const KIND = {
  opening:  'Opening balance',
  invoice:  'Bill',
  payment:  'Receipt',
  credit:   'Credit note',
  discount: 'Discount',
};

/** What a dealer owes, and how it got there.
 *
 *  Every figure comes from a view — my_balance and my_ledger — so the screen
 *  does no arithmetic of its own. That is deliberate: the printed statement
 *  and this page read the same rows, and therefore cannot disagree. The
 *  prototype reassembled its print sheet in the browser from four separate
 *  arrays, which is how the two ended up telling different stories.
 */
export default async function LedgerPage() {
  const me = await currentUser();
  if (!me?.row) redirect('/signin?next=/account/ledger');
  if (!isDealer(me)) redirect('/account');

  const sb = await supabaseServer();
  const [{ data: bal }, { data: rows }, { data: cheques }] = await Promise.all([
    sb.from('my_balance').select('*').maybeSingle(),
    sb.from('my_ledger').select('*'),
    sb.from('my_cheques').select('*').eq('cheque_status', 'pending'),
  ]);

  const ledger = rows || [];
  const pendingCheques = cheques || [];

  if (!bal) {
    return (
      <main>
        <Header title="Your account with us" back="/account" />
        <Empty
          icon={Wallet}
          title="Nothing on your account yet"
          body={`When ${FIRM.legalName} raises a bill or takes a payment, it will appear here.`}
        />
      </main>
    );
  }

  // A running balance, oldest first — the way a statement reads on paper.
  let running = 0;
  const withBalance = ledger.map((r) => {
    running += Number(r.debit || 0) - Number(r.credit || 0);
    return { ...r, balance: running };
  });

  return (
    <main className="pb-8">
      <Header title="Your account with us" back="/account" />

      <section className="px-5 py-5">
        <p className="text-sm text-ink-2">Outstanding</p>
        <p className="text-4xl font-extrabold tabular-nums text-ink">
          {rupee(bal.outstanding)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AgingBadge tier={bal.aging_tier} days={bal.aging_days} />
          {bal.credit_limit > 0 && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink-2">
              Limit {rupee(bal.credit_limit)}
            </span>
          )}
        </div>
        {bal.aging_tier === 'Critical' && (
          <p className="mt-3 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">
            This is a flag for our office, not a block — you can still order.
          </p>
        )}
      </section>

      {Number(bal.pdc_pending) > 0 && (
        <section className="mx-5 mb-5 rounded-lg border border-dashed border-line-strong px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">Cheques not yet cleared</h2>
              <p className="text-sm text-ink-2">
                Counted separately — they do not reduce the outstanding above
                until the bank pays them.
              </p>
            </div>
            <span className="shrink-0 text-xl font-bold tabular-nums text-ink">
              {rupee(bal.pdc_pending)}
            </span>
          </div>
          {pendingCheques.length > 0 && (
            <Link href="/account/cheques" className="mt-3 inline-block text-sm font-semibold text-brand">
              See {pendingCheques.length}{' '}
              {pendingCheques.length === 1 ? 'cheque' : 'cheques'} coming up
            </Link>
          )}
        </section>
      )}

      <nav className="grid grid-cols-2 gap-3 px-5 pb-5">
        <Link href="/account/bills"
              className="rounded-lg border border-line px-4 py-3 text-center font-semibold text-ink">
          Your bills
        </Link>
        <Link href="/account/cheques"
              className="rounded-lg border border-line px-4 py-3 text-center font-semibold text-ink">
          Your cheques
        </Link>
      </nav>

      <section>
        <div className="flex items-baseline justify-between px-5 pb-2">
          <h2 className="font-bold text-ink">Statement</h2>
          <span className="text-sm text-ink-3">{fyLabel(currentFY())}</span>
        </div>

        {withBalance.length === 0 ? (
          <Empty icon={FileText} title="Nothing on the statement yet" />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {withBalance.map((r, i) => (
              <li key={`${r.kind}-${r.ref || i}-${r.at}`} className="flex gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {KIND[r.kind] || r.kind}
                    {r.ref && <span className="ml-1.5 font-mono text-sm font-normal text-ink-3">{r.ref}</span>}
                  </p>
                  <p className="truncate text-sm text-ink-2">{r.description}</p>
                  <p className="text-sm text-ink-3">
                    {new Date(r.at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-bold tabular-nums ${Number(r.credit) > 0 ? 'text-ok' : 'text-ink'}`}>
                    {Number(r.credit) > 0 ? `− ${rupee(r.credit)}` : rupee(r.debit)}
                  </p>
                  <p className="text-sm tabular-nums text-ink-3">{rupee(r.balance)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-5 pt-5 text-sm text-ink-3">
        Something look wrong? Message {FIRM.legalName} and we will check it.
      </p>
    </main>
  );
}
