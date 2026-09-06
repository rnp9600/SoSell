'use client';

import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { useCanOrder } from '@/lib/session';
import { Header } from '@/components/pm/header';
import { Empty } from '@/components/pm/empty';
import { Stepper } from '@/components/pm/stepper';
import { ProductImage } from '@/components/pm/product-image';
import { Button } from '@/components/ui/button';
import { rupee } from '@/lib/money';

/** The order in progress.
 *
 *  Two things here are about honesty rather than layout:
 *
 *  · A line whose product or size has been withdrawn cannot be shown, so it is
 *    COUNTED and reported. Silently dropping it would mean an order that is
 *    quietly smaller than the one someone built.
 *
 *  · A line with no rate on file is included, marked, and excluded from the
 *    total — and the total says it is partial. Pricing it at zero would make
 *    the figure look complete when it is not.
 */
export default function CartClient({ products }) {
  const { items, dropped, count, total, hasAsk, setQty, clear, loaded } = useCart();
  const canOrder = useCanOrder();

  if (!loaded) {
    return (
      <main>
        <Header title="Your order" />
        <p className="p-5 text-ink-3">Loading…</p>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main>
        <Header title="Your order" />
        <Empty
          icon={ShoppingBag}
          title="Nothing in the order yet"
          body={
            dropped > 0
              ? `${dropped} ${dropped === 1 ? 'line was' : 'lines were'} removed because those products are no longer listed.`
              : 'Add something from the shop and it will collect here.'
          }
          action={
            <Button asChild>
              <Link href="/shop">Browse the shop</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main>
      <Header
        title="Your order"
        actions={
          <button
            type="button"
            onClick={clear}
            aria-label="Empty the order"
            className="grid size-11 place-items-center rounded-full text-ink-3 hover:text-bad"
          >
            <Trash2 className="size-5" />
          </button>
        }
      />

      {dropped > 0 && (
        <p className="mx-5 mt-4 rounded-lg bg-warn-wash px-4 py-3 text-sm text-warn">
          {dropped} {dropped === 1 ? 'line is' : 'lines are'} no longer listed and{' '}
          {dropped === 1 ? 'has' : 'have'} been left out.
        </p>
      )}

      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={`${it.slug}-${it.size}`} className="flex gap-3 px-5 py-4">
            <div className="size-16 shrink-0 rounded bg-surface-2 p-1">
              <ProductImage name={it.img} alt="" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-3">{it.brand}</p>
              <Link href={`/product/${it.slug}`} className="line-clamp-2 font-semibold text-ink">
                {it.name}
              </Link>
              <p className="mt-0.5 text-sm text-ink-2">
                {it.size}
                {it.unit ? ` · ${it.unit.toLowerCase()}` : ''}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Stepper slug={it.slug} size={it.size} moq={it.moq} />
                <span className="text-right">
                  {it.ask ? (
                    <span className="text-sm font-semibold text-ink-2">Rate on request</span>
                  ) : (
                    <span className="font-bold tabular-nums text-ink">
                      {rupee(it.price * it.qty)}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Remove ${it.name}`}
              onClick={() => setQty(it.slug, it.size, 0)}
              className="grid size-11 shrink-0 place-items-center self-start rounded-full text-ink-3 hover:text-bad"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-line px-5 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-2">
            {count} {count === 1 ? 'piece' : 'pieces'}
          </span>
          <span className="text-2xl font-extrabold tabular-nums text-ink">{rupee(total)}</span>
        </div>
        {hasAsk && (
          <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Some lines have no rate on file, so this total is partial. They go on
            the order with the rate left open and we will confirm it.
          </p>
        )}
        {canOrder ? (
          <Button asChild size="lg" block>
            <Link href="/checkout">Place this order</Link>
          </Button>
        ) : (
          <p className="rounded-lg bg-warn-wash px-4 py-3 text-sm text-warn">
            Your account is not set up to place orders. Ask the office if that is
            unexpected.
          </p>
        )}
      </div>
    </main>
  );
}
