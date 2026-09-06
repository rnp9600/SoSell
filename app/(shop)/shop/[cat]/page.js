import { notFound } from 'next/navigation';
import { getCatalogue, visible } from '@/lib/catalogue';
import { Header } from '@/components/pm/header';
import { ProductGrid } from '@/components/pm/product-card';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { cat } = await params;
  return { title: decodeURIComponent(cat) };
}

export default async function CategoryPage({ params }) {
  const { cat } = await params;
  const name = decodeURIComponent(cat);
  const { products } = await getCatalogue();
  const inCat = visible(products).filter((p) => p.cat === name);
  if (!inCat.length) notFound();

  // Sub-groups within a category, because "Cast Iron" alone is 60 products and
  // a dealer is usually after the tawas.
  const subs = new Map();
  for (const p of inCat) {
    const k = p.sub || 'Other';
    if (!subs.has(k)) subs.set(k, []);
    subs.get(k).push(p);
  }
  const groups = [...subs.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main>
      <Header title={name} back="/shop" />
      <div className="space-y-8 px-5 py-4">
        {groups.map(([sub, list]) => (
          <section key={sub}>
            <h2 className="mb-3 font-bold text-ink">
              {sub} <span className="font-normal text-ink-3">· {list.length}</span>
            </h2>
            <ProductGrid products={list} />
          </section>
        ))}
      </div>
    </main>
  );
}
