import Link from 'next/link';
import { Users } from 'lucide-react';
import { supabaseServer } from '@/lib/supabase/server';
import { Empty } from '@/components/pm/empty';
import { AgingBadge } from '@/components/pm/aging-badge';
import { rupee } from '@/lib/money';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

const ORDER = { Critical: 0, Overdue: 1, 'Please Clear': 2, 'Due Soon': 3, 'On Track': 4 };

/** Every customer and where they stand.
 *
 *  ONE query — catalog.customer_balances computes outstanding, PDC and aging
 *  for everyone at once. The prototype ran four separate finds PER CUSTOMER,
 *  which is fine at 15 and falls over at 1,500.
 */
export default async function CustomersPage({ searchParams }) {
  const sp = await searchParams;
  const q = (sp?.q || '').toLowerCase().trim();

  const sb = await supabaseServer();
  const { data } = await sb.from('customer_balances').select('*');
  let rows = data || [];

  if (q) {
    rows = rows.filter(
      (r) =>
        (r.display || '').toLowerCase().includes(q) ||
        (r.customer_phone || '').includes(q) ||
        (r.area || '').toLowerCase().includes(q),
    );
  }
  // Worst first — this list exists to be worked through, not browsed.
  rows.sort((a, b) => {
    const t = (ORDER[a.aging_tier] ?? 9) - (ORDER[b.aging_tier] ?? 9);
    return t !== 0 ? t : Number(b.outstanding) - Number(a.outstanding);
  });

  const total = rows.reduce((s, r) => s + Math.max(0, Number(r.outstanding)), 0);

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Customers</h1>
        <p className="text-ink-2">
          {rows.length} · <span className="font-bold text-ink">{rupee(total)}</span> outstanding
        </p>
      </div>

      <form className="mb-4">
        <input
          name="q" defaultValue={sp?.q || ''} placeholder="Name, area or number"
          aria-label="Search customers"
          className="h-11 w-full rounded-full border border-line bg-surface px-4 text-ink outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {rows.length === 0 ? (
        <Empty icon={Users} title={q ? `Nobody matches "${sp.q}"` : 'No customers yet'}
               body={q ? undefined : 'Import the office list to get started.'} />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.customer_phone}>
              <Link href={`/office/customers/${r.customer_phone}`}
                    className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.display}</p>
                  <p className="text-sm text-ink-3">
                    {r.area ? `${r.area} · ` : ''}+91 {String(r.customer_phone).slice(-10)}
                  </p>
                  <AgingBadge tier={r.aging_tier} days={r.aging_days} className="mt-1.5" />
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums text-ink">{rupee(r.outstanding)}</p>
                  {Number(r.pdc_pending) > 0 && (
                    <p className="text-sm tabular-nums text-ink-3">
                      +{rupee(r.pdc_pending)} in cheques
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
