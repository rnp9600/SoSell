import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer, currentUser } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { Button } from '@/components/ui/button';
import { rupee } from '@/lib/money';
import { STATUS } from '../page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { ref } = await params;
  return { title: `Order ${ref}` };
}

export default async function OrderDetailPage({ params }) {
  const { ref } = await params;
  const me = await currentUser();
  if (!me?.row) notFound();

  const sb = await supabaseServer();
  const { data: order } = await sb
    .from('order_summary')
    .select('*')
    .eq('ref', ref)
    .maybeSingle();

  // Not found and not yours are the same answer here, on purpose — an order
  // reference should not be a way to learn that someone else's order exists.
  if (!order) notFound();

  const { data: lines } = await sb
    .from('order_items')
    .select('product_slug,name,size,unit,qty,price,mrp,sort')
    .eq('order_id', order.id)
    .order('sort');

  const items = lines || [];
  const s = STATUS[order.status] || STATUS.new;
  const held = order.needs_approval && !order.approved_at;
  const anyAsk = items.some((i) => i.price == null);

  return (
    <main>
      <Header title={order.ref} back="/orders" />

      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.cls}`}>{s.label}</span>
          {held && (
            <span className="rounded-full bg-warn-wash px-3 py-1 text-sm font-semibold text-warn">
              Waiting for approval
            </span>
          )}
        </div>

        {held && order.approval_reason && (
          <p className="rounded-lg bg-warn-wash px-4 py-3 text-sm text-warn">
            {order.approval_reason}
          </p>
        )}

        <p className="text-sm text-ink-3">
          Placed {new Date(order.created_at).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
          })}
        </p>

        <section>
          <h2 className="mb-2 font-bold text-ink">
            {items.length} {items.length === 1 ? 'line' : 'lines'}
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {items.map((i) => (
              <li key={`${i.product_slug}-${i.size}-${i.sort}`} className="px-4 py-3">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/product/${i.product_slug}`} className="font-semibold text-ink">
                      {i.name}
                    </Link>
                    <p className="text-sm text-ink-2">
                      {i.size}
                      {i.unit ? ` · ${i.unit.toLowerCase()}` : ''} · {i.qty}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {i.price == null ? (
                      <span className="text-sm text-ink-2">Rate to confirm</span>
                    ) : (
                      <span className="font-bold tabular-nums text-ink">
                        {rupee(i.price * i.qty)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-ink-2">{order.pieces} pieces</span>
          <span className="text-2xl font-extrabold tabular-nums text-ink">
            {rupee(order.total)}
          </span>
        </div>
        {anyAsk && (
          <p className="text-sm text-ink-3">
            Some lines went out with the rate open; this total is partial until
            we confirm them.
          </p>
        )}

        {order.note && (
          <section>
            <h2 className="mb-1 font-bold text-ink">Note</h2>
            <p className="text-ink-2">{order.note}</p>
          </section>
        )}

        <Button asChild variant="secondary" size="lg" block>
          <Link href={`/repeat/${order.ref}`}>Order these again</Link>
        </Button>
      </div>
    </main>
  );
}
