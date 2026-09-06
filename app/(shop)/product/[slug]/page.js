import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCatalogue, visible } from '@/lib/catalogue';
import { currentUser, roleOf } from '@/lib/supabase/server';
import { supabaseServer } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { ProductRail } from '@/components/pm/product-card';
import ProductDetail from './product-detail';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { products } = await getCatalogue();
  const p = products.find((x) => x.slug === slug);
  if (!p) return { title: 'Product not found' };
  return {
    title: p.name,
    description: [p.brand, p.cat, p.desc].filter(Boolean).join(' · ').slice(0, 200),
  };
}

async function getOffer(slug, role) {
  // Only a consumer sees a shop's offer, and RLS limits it to the shops they
  // actually follow. A dealer asking for this gets nothing back, correctly.
  if (role !== 'end_customer') return null;
  try {
    const sb = await supabaseServer();
    const { data } = await sb
      .from('shop_offers')
      .select('discount_pct,price_offer,status,note')
      .eq('product_slug', slug)
      .limit(1)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

export default async function ProductPage({ params }) {
  const { slug } = await params;
  const [me, { products }] = await Promise.all([currentUser(), getCatalogue()]);
  const p = products.find((x) => x.slug === slug);
  if (!p || p.hidden) notFound();

  const role = roleOf(me);
  const offer = await getOffer(slug, role);

  // Same sub-group first, then same brand — the two things a dealer comparing
  // options actually wants next.
  const shown = visible(products).filter((x) => x.slug !== p.slug);
  const related = [
    ...shown.filter((x) => x.sub && x.sub === p.sub),
    ...shown.filter((x) => x.brand === p.brand && x.sub !== p.sub),
  ].slice(0, 12);

  return (
    <main>
      <Header title={p.name} back={p.cat ? `/shop/${encodeURIComponent(p.cat)}` : '/shop'} />
      <ProductDetail product={p} role={role} offer={offer} />
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 px-5 font-bold text-ink">Related</h2>
          <ProductRail products={related} />
        </section>
      )}
      <div className="px-5 py-8">
        <Link href="/shop" className="text-sm font-semibold text-brand">
          Back to the shop
        </Link>
      </div>
    </main>
  );
}
