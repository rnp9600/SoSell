'use client';

import { useState } from 'react';
import { Icon } from '@/components/pm/icon';
import { ProductImage } from '@/components/pm/product-image';
import { Price } from '@/components/pm/price';
import { Stepper } from '@/components/pm/stepper';
import { Button } from '@/components/ui/button';
import { priceView, sizesOf } from '@/lib/catalogue/price';
import { rupee } from '@/lib/money';
import { useSaved } from '@/lib/saved';
import { FIRM } from '@/lib/config';
import { cn } from '@/lib/utils';

/** The product sheet.
 *
 *  The action row depends on who is signed in, and the role comes from the
 *  database. Getting this wrong once showed an admin "Enquire on WhatsApp" —
 *  an order pad they are deliberately not supposed to have, on their own
 *  product — and gave a dealer opening a shared link no steppers at all.
 */
export default function ProductDetail({ product: p, role, offer }) {
  const rows = sizesOf(p);
  const view = priceView(p, { role, offer });
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(p.slug);
  const canOrder = ['dealer', 'shop_owner'].includes(role);
  const [photo, setPhoto] = useState(0);
  const gallery = (p.imgs && p.imgs.length ? p.imgs : [p.img]).filter(Boolean);

  const share = async () => {
    const url = `${window.location.origin}/p/${p.slug}`;
    const text = `${p.name}${p.code ? ` (${p.code})` : ''} — ${FIRM.legalName}`;
    if (navigator.share) {
      try { await navigator.share({ title: p.name, text, url }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(url); } catch { /* nothing to offer */ }
  };

  const spec = [
    p.code && ['Code', p.code],
    p.brand && ['Brand', p.brand],
    p.cat && ['Category', p.cat],
    p.sub && ['Type', p.sub],
    p.hsn && ['HSN', p.hsn],
    p.gst != null && ['GST', `${p.gst}%`],
    p.alias && ['Also called', p.alias],
  ].filter(Boolean);

  return (
    <div>
      <div className="relative aspect-square bg-surface-2">
        <ProductImage name={gallery[photo]} alt={p.name} full className="p-6" />
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            aria-label={saved ? 'Remove from saved' : 'Save'}
            aria-pressed={saved}
            onClick={() => toggle(p.slug)}
            className="grid size-11 place-items-center rounded-full bg-surface/85 backdrop-blur"
          >
            <Icon name="heart" fill={saved ? 'currentColor' : 'none'}
                  className={cn('size-5', saved ? 'text-bad' : 'text-ink-3')} />
          </button>
          <button
            type="button"
            aria-label="Share"
            onClick={share}
            className="grid size-11 place-items-center rounded-full bg-surface/85 text-ink-3 backdrop-blur"
          >
            <Icon name="share" className="size-5" />
          </button>
        </div>
      </div>

      {gallery.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 py-3">
          {gallery.map((g, i) => (
            <button
              key={g}
              type="button"
              onClick={() => setPhoto(i)}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === photo}
              className={cn(
                'size-16 shrink-0 overflow-hidden rounded border bg-surface-2 p-1',
                i === photo ? 'border-brand' : 'border-line',
              )}
            >
              <ProductImage name={g} alt="" />
            </button>
          ))}
        </div>
      )}

      <div className="space-y-5 px-5 py-4">
        <div>
          <p className="text-sm text-ink-3">{p.brand}</p>
          <h1 className="text-xl font-extrabold leading-tight text-ink">{p.name}</h1>
          {p.desc && <p className="mt-2 text-ink-2">{p.desc}</p>}
          {p.note && (
            <p className="mt-2 rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">{p.note}</p>
          )}
        </div>

        <Price view={view} size="lg" />

        {p.stock === 'out' && (
          <p className="rounded-lg bg-bad-wash px-4 py-3 text-sm font-semibold text-bad">
            Out of stock
          </p>
        )}

        <section>
          <h2 className="mb-2 font-bold text-ink">
            {rows.length > 1 ? `${rows.length} sizes` : 'Size'}
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {rows.map((r) => (
              <li key={r.size} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.size}</p>
                  <p className="text-sm text-ink-3">
                    {/* Never ₹0, never ₹NaN — a rate we do not have is a
                        question, and it goes on the order left open. */}
                    {role === 'guest'
                      ? 'Sign in for rates'
                      : r.price != null
                        ? `${rupee(r.price)} per ${r.unit.toLowerCase()}`
                        : 'Rate on request'}
                    {r.moq > 1 && ` · min ${r.moq}`}
                  </p>
                </div>
                {canOrder && p.stock !== 'out' && (
                  <Stepper slug={p.slug} size={r.size} moq={r.moq} />
                )}
              </li>
            ))}
          </ul>
        </section>

        {!canOrder && role !== 'guest' && role !== 'end_customer' && (
          <p className="text-sm text-ink-3">
            {/* Office staff see no order pad: an order they placed would be
                addressed to themselves. */}
            You are signed in as office staff, so there is no order pad here.
          </p>
        )}

        {role === 'guest' && (
          <Button asChild block size="lg">
            <a href={`/signin?next=/product/${p.slug}`}>Sign in to see rates and order</a>
          </Button>
        )}

        {spec.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold text-ink">Details</h2>
            <dl className="divide-y divide-line rounded-lg border border-line text-sm">
              {spec.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {p.spec && <p className="mt-2 text-sm text-ink-2">{p.spec}</p>}
          </section>
        )}
      </div>
    </div>
  );
}
