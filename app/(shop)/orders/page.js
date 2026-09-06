import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { supabaseServer, currentUser } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { Empty } from '@/components/pm/empty';
import { Button } from '@/components/ui/button';
import { rupee } from '@/lib/money';

export const metadata = { title: 'Your orders' };
export const dynamic = 'force-dynamic';

/** How far along an order is. The database enforces the transitions; this is
 *  only how they read. */
export const STATUS = {
  new: { label: 'Received', cls: 'bg-brand-wash text-brand-ink' },
  confirmed: { label: 'Confirmed', cls: 'bg-brand-wash text-brand-ink' },
  packed: { label: 'Packed', cls: 'bg-gold-wash text-gold' },
  sent: { label: 'On its way', cls: 'bg-gold-wash text-gold' },
  completed: { label: 'Completed', cls: 'bg-ok-wash text-ok' },
  cancelled: { label: 'Cancelled', cls: 'bg-bad-wash text-bad' },
};

export default async function OrdersPage() {
  const me = await currentUser();
  if (!me?.row) {
    return (
      <main>
        <Header title="Your orders" />
        <Empty
          icon={Receipt}
          title="Sign in to see your orders"
          body="Your order history is tied to your number."
          action={<Button asChild><Link href="/signin?next=/orders">Sign in</Link></Button>}
        />
      </main>
    );
  }

  // RLS returns only this person's orders — the query does no filtering of
  // its own, and could not usefully lie if it tried.
  const sb = await supabaseServer();
  const { data: orders } = await sb
    .from('order_summary')
    .select('ref,status,total,created_at,lines,pieces,needs_approval,approved_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const list = orders || [];

  return (
    <main>
      <Header title="Your orders" />
      {list.length === 0 ? (
        <Empty
          icon={Receipt}
          title="No orders yet"
          body="When you place one it will be here, with where it has got to."
          action={<Button asChild><Link href="/shop">Browse the shop</Link></Button>}
        />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((o) => {
            const s = STATUS[o.status] || STATUS.new;
            const held = o.needs_approval && !o.approved_at;
            return (
              <li key={o.ref}>
                <Link href={`/orders/${o.ref}`} className="block px-5 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono font-bold text-ink">{o.ref}</span>
                    <span className="font-bold tabular-nums text-ink">{rupee(o.total)}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                    {held && (
                      <span className="rounded-full bg-warn-wash px-2 py-0.5 text-xs font-semibold text-warn">
                        Waiting for approval
                      </span>
                    )}
                    <span className="text-sm text-ink-3">
                      {o.lines} {o.lines === 1 ? 'line' : 'lines'} · {o.pieces} pieces
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-3">
                    {new Date(o.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
