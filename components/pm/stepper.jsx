'use client';

import { Icon } from './icon';
import { useCart } from '@/lib/cart';
import { cn } from '@/lib/utils';

/** The only quantity control in the app.
 *
 *  Steps by the product's minimum order quantity, so a dealer cannot build an
 *  order the supplier will refuse. Both buttons clear 44px — this is pressed
 *  with a thumb, often one-handed, in a shop.
 */
export function Stepper({ slug, size, moq = 1, className }) {
  const { qtyFor, setQty, add } = useCart();
  const qty = qtyFor(slug, size);

  if (!qty) {
    return (
      <button
        type="button"
        onClick={() => add(slug, size)}
        className={cn(
          'inline-flex min-h-tap items-center justify-center gap-1.5 rounded-full',
          'bg-brand px-4 text-sm font-semibold text-on-brand',
          'transition-colors hover:bg-brand-ink active:bg-brand-ink',
          className,
        )}
      >
        <Icon name="plus" className="size-4" />
        Add
        {moq > 1 && <span className="opacity-70">· {moq}</span>}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex min-h-tap items-center rounded-full border border-line bg-surface',
        className,
      )}
    >
      <button
        type="button"
        aria-label={qty <= moq ? 'Remove' : `Fewer, by ${moq}`}
        onClick={() => setQty(slug, size, qty - moq)}
        className="grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink"
      >
        <Icon name="minus" className="size-4" />
      </button>
      <span className="min-w-9 text-center font-bold tabular-nums text-ink">{qty}</span>
      <button
        type="button"
        aria-label={`More, by ${moq}`}
        onClick={() => setQty(slug, size, qty + moq)}
        className="grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink"
      >
        <Icon name="plus" className="size-4" />
      </button>
    </div>
  );
}
