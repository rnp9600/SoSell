'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { ProductImage } from './product-image';
import { Price } from './price';
import { Stepper } from './stepper';
import { priceView, sizesOf } from '@/lib/catalogue/price';
import { useSession } from '@/lib/session';
import { useSaved } from '@/lib/saved';
import { cn } from '@/lib/utils';

/** The one product tile, used in every grid and every rail.
 *
 *  Three layout decisions that look arbitrary and are not:
 *
 *  · The link is an absolutely-positioned overlay, not a wrapper. Wrapping the
 *    whole card in an <a> puts the save button and the stepper INSIDE the
 *    link, so pressing either navigates. The overlay sits under them instead.
 *
 *  · Badges are a row UNDER the photo, not floated over it. Overlaid chips
 *    cover the product in exactly the products that need three of them.
 *
 *  · The action row is `mt-auto`, so cards of different name lengths still
 *    line their buttons up across a row. Without it the grid looks broken at
 *    a glance even though every card is correct.
 */
export function ProductCard({ product: p, offer = null }) {
  const { role } = useSession();
  const { isSaved, toggle } = useSaved();
  const view = priceView(p, { role, offer });
  const rows = sizesOf(p);
  const single = rows.length === 1;
  const canOrder = ['dealer', 'shop_owner'].includes(role);
  const saved = isSaved(p.slug);

  const badges = [
    p.feat && { label: 'Featured', cls: 'bg-brand-wash text-brand-ink' },
    offer && { label: 'Shop offer', cls: 'bg-gold-wash text-gold' },
    p.stock === 'out' && { label: 'Out of stock', cls: 'bg-bad-wash text-bad' },
  ].filter(Boolean);

  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-1">
      <div className="relative aspect-square bg-surface-2 p-3">
        <ProductImage name={p.img} alt={p.name} />
        <button
          type="button"
          aria-label={saved ? `Remove ${p.name} from saved` : `Save ${p.name}`}
          aria-pressed={saved}
          onClick={() => toggle(p.slug)}
          className="absolute right-2 top-2 z-20 grid size-11 place-items-center rounded-full bg-surface/85 backdrop-blur transition-colors hover:bg-surface"
        >
          <Heart className={cn('size-5', saved ? 'fill-bad text-bad' : 'text-ink-3')} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span key={b.label} className={cn('rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold', b.cls)}>
                {b.label}
              </span>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs text-ink-3">{p.brand}</p>
          <h3 className="line-clamp-2 font-semibold leading-snug text-ink">{p.name}</h3>
        </div>

        <Price view={view} />

        <div className="mt-auto pt-1">
          {canOrder && p.stock !== 'out' ? (
            single ? (
              <Stepper slug={p.slug} size={rows[0].size} moq={rows[0].moq} className="w-full" />
            ) : (
              // More than one size is a decision, and a decision belongs on
              // the product page rather than guessed at from a grid.
              <span className="inline-flex min-h-tap items-center text-sm font-semibold text-brand">
                {rows.length} sizes
              </span>
            )
          ) : (
            <span className="inline-flex min-h-tap items-center text-sm text-ink-3">
              {p.stock === 'out' ? 'Out of stock' : 'View details'}
            </span>
          )}
        </div>
      </div>

      {/* Under the buttons, over the card. */}
      <Link
        href={`/product/${p.slug}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sr-only">{p.name}</span>
      </Link>
    </article>
  );
}

export function ProductGrid({ products, offers = {} }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} offer={offers[p.slug] || null} />
      ))}
    </div>
  );
}

/** A horizontal rail — "buy again", "recently viewed", a promo strip. */
export function ProductRail({ products, offers = {} }) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
      {products.map((p) => (
        <div key={p.slug} className="w-40 shrink-0 snap-start sm:w-48">
          <ProductCard product={p} offer={offers[p.slug] || null} />
        </div>
      ))}
    </div>
  );
}
