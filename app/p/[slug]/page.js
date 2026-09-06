import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCatalogue } from '@/lib/catalogue';
import { printedMrp, sizesOf } from '@/lib/catalogue/price';
import { rupeeSpan } from '@/lib/money';
import { ProductImage } from '@/components/pm/product-image';
import { IMG } from '@/lib/img';
import { FIRM, APP } from '@/lib/config';

/** The shareable product link — `/p/:slug`.
 *
 *  ═══════════════════════════════════════════════════════════════════════
 *  THIS PAGE IS PUBLIC AND HAS NO SIGN-IN, SO IT SHOWS MRP ONLY.
 *  NEVER THE DEALER RATE.
 *
 *  It used to print the DP column for every size. That meant forwarding a
 *  product to a customer forwarded your buying price along with it. The same
 *  rule applies to the WhatsApp text below: sizes only, no rates.
 *  ═══════════════════════════════════════════════════════════════════════
 *
 *  It exists because WhatsApp, Facebook, Telegram and iMessage fetch a shared
 *  link with a crawler that does not run JavaScript and reads only the raw
 *  <head>. The catalogue's old answer was a separate serverless function
 *  rendering a card no human ever saw; a server component with
 *  generateMetadata does it natively, and this one is also a real page — so
 *  someone with no signal, or no account, still sees the product.
 *
 *  The address is preserved exactly, because these links are already in
 *  customers' chat histories.
 */

export const revalidate = 600;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { products } = await getCatalogue();
  const p = products.find((x) => x.slug === slug);
  if (!p) return { title: 'Product not found' };

  const mrp = printedMrp(p);
  const n = sizesOf(p).length;
  const description = [
    p.brand,
    p.cat,
    mrp && `MRP ${rupeeSpan(mrp)}`,
    n > 1 && `${n} sizes`,
    p.desc,
  ].filter(Boolean).join(' · ').slice(0, 200);

  const image = IMG(p.img);

  return {
    title: `${p.name} — ${p.brand || FIRM.legalName}`,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: {
      type: 'website',
      siteName: FIRM.legalName,
      title: `${p.name} — ${p.brand || FIRM.legalName}`,
      description,
      images: image ? [{ url: image, width: 800, height: 800 }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${p.name} — ${p.brand || FIRM.legalName}`,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function SharedProductPage({ params }) {
  const { slug } = await params;
  const { products } = await getCatalogue();
  const p = products.find((x) => x.slug === slug);
  if (!p || p.hidden) notFound();

  const rows = sizesOf(p);
  const anyMrp = rows.some((r) => r.mrp != null);

  // Sizes only. No rates — see the rule at the top of this file.
  const wa = `https://wa.me/${FIRM.whatsapp}?text=${encodeURIComponent(
    [
      `Enquiry — ${p.name}`,
      p.code && `Code: ${p.code}`,
      p.brand && `Brand: ${p.brand}`,
      rows.length > 1 && `Sizes: ${rows.map((r) => r.size).join(', ')}`,
    ].filter(Boolean).join('\n'),
  )}`;

  const tags = [p.brand, p.cat, p.sub, p.code, p.gst != null && `GST ${p.gst}%`].filter(Boolean);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-6">
      <header className="mb-5">
        <p className="text-sm font-semibold text-ink-2">{FIRM.legalName}</p>
        <p className="text-xs text-ink-3">{FIRM.trade}</p>
      </header>

      <div className="aspect-square rounded-lg bg-surface-2 p-6">
        <ProductImage name={p.img} alt={p.name} full />
      </div>

      <div className="mt-5 space-y-4">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                {t}
              </span>
            ))}
          </div>
        )}

        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-ink">{p.name}</h1>
          {p.desc && <p className="mt-2 text-ink-2">{p.desc}</p>}
          {p.spec && <p className="mt-1 text-sm text-ink-3">{p.spec}</p>}
        </div>

        <section>
          <h2 className="mb-2 font-bold text-ink">{rows.length > 1 ? 'Sizes' : 'Size'}</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {rows.map((r) => (
              <li key={r.size} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="font-medium text-ink">{r.size}</span>
                <span className="text-sm tabular-nums text-ink-2">
                  {/* MRP only. Never the dealer rate. */}
                  {r.mrp != null ? `MRP ${rupeeSpan({ lo: r.mrp, hi: r.mrp, one: true })}` : ''}
                  {r.moq > 1 && <span className="ml-2 text-ink-3">min {r.moq}</span>}
                </span>
              </li>
            ))}
          </ul>
          {!anyMrp && (
            <p className="mt-2 text-sm text-ink-3">
              Ask us for the rate — it depends on the finish and the quantity.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-2 pt-2">
          <Link
            href={`/product/${p.slug}`}
            className="flex min-h-tap items-center justify-center rounded-full bg-brand px-5 font-semibold text-on-brand"
          >
            Open in {APP.name}
          </Link>
          <a
            href={wa}
            className="flex min-h-tap items-center justify-center rounded-full border border-line px-5 font-semibold text-ink"
          >
            Enquire on WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
