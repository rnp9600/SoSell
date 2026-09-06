import { redirect } from 'next/navigation';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { supabaseServer, currentUser, isDealer } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { Empty } from '@/components/pm/empty';
import { rupee } from '@/lib/money';

export const metadata = { title: 'Your bills' };
export const dynamic = 'force-dynamic';

export default async function BillsPage() {
  const me = await currentUser();
  if (!me?.row) redirect('/signin?next=/account/bills');
  if (!isDealer(me)) redirect('/account');

  const sb = await supabaseServer();
  const { data } = await sb.from('my_bills').select('*');
  const bills = data || [];
  const total = bills.reduce((s, b) => s + Number(b.amount || 0), 0);

  return (
    <main className="pb-8">
      <Header title="Your bills" back="/account/ledger" />

      {bills.length === 0 ? (
        <Empty icon={FileText} title="No bills yet"
               body="Every bill raised against your account will be listed here." />
      ) : (
        <>
          <div className="flex items-baseline justify-between px-5 py-4">
            <span className="text-ink-2">
              {bills.length} {bills.length === 1 ? 'bill' : 'bills'}
            </span>
            <span className="text-xl font-extrabold tabular-nums text-ink">{rupee(total)}</span>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {bills.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {b.invoice_no || 'Bill'}
                    {/* A bill that came from the accounting package is
                        read-only everywhere, including in the office. */}
                    {b.source === 'busy' && (
                      <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-ink-3">
                        from accounts
                      </span>
                    )}
                  </p>
                  {b.description && <p className="truncate text-sm text-ink-2">{b.description}</p>}
                  <p className="text-sm text-ink-3">
                    {new Date(b.date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {b.order_ref && (
                      <>
                        {' · '}
                        <Link href={`/orders/${b.order_ref}`} className="text-brand">
                          {b.order_ref}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <span className="shrink-0 font-bold tabular-nums text-ink">{rupee(b.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
