'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { Header } from '@/components/pm/header';
import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/pm/stepper';
import { sizesOf } from '@/lib/catalogue/price';
import { rupee } from '@/lib/money';

/** Every line back, at TODAY's rates.
 *
 *  That the price is current rather than historical is not a feature anyone
 *  built — it falls out of a cart line storing only {slug, size, qty}. A line
 *  whose product or size is no longer listed simply cannot come back, and is
 *  reported rather than dropped in silence.
 */
export default function RepeatClient({ ref_, lines, products }) {
  const router = useRouter();
  const { setQty } = useCart();
  const [skip, setSkip] = useState(() => new Set());

  const resolved = useMemo(() => {
    const bySlug = new Map(products.map((p) => [p.slug, p]));
    const out = [];
    const gone = [];
    for (const l of lines) {
      const p = bySlug.get(l.product_slug);
      const row = p && sizesOf(p).find((s) => s.size === l.size);
      if (!p || !row) { gone.push(l); continue; }
      out.push({ ...l, product: p, price: row.price, unit: row.unit, moq: row.moq });
    }
    return { out, gone };
  }, [lines, products]);

  const take = resolved.out.filter((l) => !skip.has(`${l.product_slug}-${l.size}`));
  const total = take.reduce((s, l) => s + (l.price != null ? l.price * l.qty : 0), 0);

  function addAll() {
    for (const l of take) setQty(l.product_slug, l.size, l.qty);
    router.push('/cart');
  }

  return (
    <main>
      <Header title="Order again" back={`/orders/${ref_}`} />

      <div className="px-5 py-4">
        <p className="text-ink-2">
          Everything from {ref_}, at today&rsquo;s rates. Remove anything you do
          not need.
        </p>

        {resolved.gone.length > 0 && (
          <p className="mt-3 rounded-lg bg-warn-wash px-4 py-3 text-sm text-warn">
            {resolved.gone.length}{' '}
            {resolved.gone.length === 1 ? 'line is' : 'lines are'} no longer
            listed and cannot be reordered.
          </p>
        )}
      </div>

      <ul className="divide-y divide-line">
        {resolved.out.map((l) => {
          const key = `${l.product_slug}-${l.size}`;
          const off = skip.has(key);
          return (
            <li key={key} className={`flex items-start gap-3 px-5 py-4 ${off ? 'opacity-40' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{l.name}</p>
                <p className="text-sm text-ink-2">
                  {l.size} · {l.qty}
                  {l.price != null ? ` · ${rupee(l.price)} each` : ' · rate on request'}
                </p>
                {!off && (
                  <div className="mt-2">
                    <Stepper slug={l.product_slug} size={l.size} moq={l.moq} />
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label={off ? `Put ${l.name} back` : `Leave out ${l.name}`}
                onClick={() =>
                  setSkip((prev) => {
                    const next = new Set(prev);
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  })
                }
                className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-3 border-t border-line px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-2">{take.length} lines</span>
          <span className="text-xl font-extrabold tabular-nums text-ink">{rupee(total)}</span>
        </div>
        <Button size="lg" block disabled={!take.length} onClick={addAll}>
          Add {take.length} {take.length === 1 ? 'line' : 'lines'} to the order
        </Button>
      </div>
    </main>
  );
}
