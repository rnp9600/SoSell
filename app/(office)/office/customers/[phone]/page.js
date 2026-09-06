import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer, currentUser, isAdmin } from '@/lib/supabase/server';
import { AgingBadge } from '@/components/pm/aging-badge';
import { rupee } from '@/lib/money';
import RecordPayment from './record-payment';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { phone } = await params;
  return { title: `Customer +91 ${String(phone).slice(-10)}` };
}

const KIND = {
  opening: 'Opening balance', invoice: 'Bill', payment: 'Receipt',
  credit: 'Credit note', discount: 'Discount',
};

export default async function CustomerPage({ params }) {
  const { phone } = await params;
  const me = await currentUser();
  const sb = await supabaseServer();

  // RLS decides whether this row comes back at all. A collector who is not on
  // this customer's route gets nothing, and that is the right answer.
  const { data: bal } = await sb
    .from('customer_balances').select('*').eq('customer_phone', phone).maybeSingle();
  if (!bal) notFound();

  const [{ data: ledger }, { data: cheques }, { data: person }] = await Promise.all([
    sb.from('customer_ledger').select('*').eq('customer_phone', phone),
    sb.from('payments').select('id,receipt_no,amount,bank_name,cheque_no,cheque_date,cheque_status')
      .eq('customer_phone', phone).eq('mode', 'cheque').eq('cheque_status', 'pending'),
    sb.from('allowlist').select('name,shop,area,address,last_cheque_bank,credit_limit,reminder_only')
      .eq('phone', phone).maybeSingle(),
  ]);

  let running = 0;
  const rows = (ledger || []).map((r) => {
    running += Number(r.debit || 0) - Number(r.credit || 0);
    return { ...r, balance: running };
  }).reverse();

  return (
    <main className="space-y-6">
      <div>
        <Link href="/office/customers" className="text-sm font-semibold text-brand">
          ← Customers
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{bal.display}</h1>
        <p className="text-ink-2">
          {person?.area ? `${person.area} · ` : ''}+91 {String(phone).slice(-10)}
        </p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-sm text-ink-2">Outstanding</p>
        <p className="text-3xl font-extrabold tabular-nums text-ink">{rupee(bal.outstanding)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AgingBadge tier={bal.aging_tier} days={bal.aging_days} />
          {Number(bal.pdc_pending) > 0 && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink-2">
              {rupee(bal.pdc_pending)} in uncleared cheques
            </span>
          )}
          {person?.reminder_only && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink-2">
              reminders only, no visit
            </span>
          )}
        </div>
      </section>

      <RecordPayment
        customerPhone={phone}
        display={bal.display}
        outstanding={Number(bal.outstanding)}
        lastBank={person?.last_cheque_bank || ''}
      />

      {(cheques || []).length > 0 && (
        <section>
          <h2 className="mb-2 font-bold text-ink">Cheques not yet cleared</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {cheques.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{c.bank_name || 'Cheque'} {c.cheque_no}</p>
                  <p className="text-sm text-ink-3">
                    dated {new Date(c.cheque_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric' })} · {c.receipt_no}
                  </p>
                </div>
                <span className="font-bold tabular-nums text-ink">{rupee(c.amount)}</span>
              </li>
            ))}
          </ul>
          <Link href="/office/cheques" className="mt-2 inline-block text-sm font-semibold text-brand">
            Clear or bounce these
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold text-ink">Statement</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-4 py-6 text-center text-ink-3">
            Nothing on this account yet.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {rows.map((r, i) => (
              <li key={`${r.kind}-${r.ref || i}`} className="flex justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {KIND[r.kind] || r.kind}
                    {r.ref && <span className="ml-1.5 font-mono text-sm font-normal text-ink-3">{r.ref}</span>}
                  </p>
                  <p className="truncate text-sm text-ink-2">{r.description}</p>
                  <p className="text-sm text-ink-3">
                    {new Date(r.at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric' })}
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
    </main>
  );
}
