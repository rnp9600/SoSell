import Link from 'next/link';
import { Search } from 'lucide-react';
import { getCatalogue, visible } from '@/lib/catalogue';
import { currentUser, roleOf } from '@/lib/supabase/server';
import { supabaseServer } from '@/lib/supabase/server';
import { ProductGrid, ProductRail } from '@/components/pm/product-card';
import { APP, FIRM } from '@/lib/config';

export const revalidate = 300;

async function getNotices() {
  // RLS decides which notices this reader may see — live, in-window, and
  // addressed to their role. The page does no filtering of its own.
  try {
    const sb = await supabaseServer();
    const { data } = await sb
      .from('notices')
      .select('id,title,body,tone,product_slug')
      .order('created_at', { ascending: false })
      .limit(3);
    return data || [];
  } catch {
    return [];
  }
}

const TONE = {
  festive: 'bg-gold-wash text-gold',
  offer: 'bg-warn-wash text-warn',
  new: 'bg-brand-wash text-brand-ink',
  top: 'bg-ok-wash text-ok',
};

export default async function HomePage() {
  const [me, { products }, notices] = await Promise.all([
    currentUser(),
    getCatalogue(),
    getNotices(),
  ]);

  const shown = visible(products);
  const role = roleOf(me);
  const featured = shown.filter((p) => p.feat).slice(0, 12);
  const cats = [...new Set(shown.map((p) => p.cat).filter(Boolean))].sort();

  return (
    <main>
      <header className="px-5 pb-4 pt-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-t))' }}>
        <p className="text-sm text-ink-2">{FIRM.legalName}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {role === 'guest' ? APP.name : 'What do you need?'}
        </h1>
      </header>

      <div className="px-5">
        <Link
          href="/search"
          className="flex min-h-tap items-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-ink-3"
        >
          <Search className="size-5" />
          Search {shown.length} products
        </Link>
      </div>

      {notices.length > 0 && (
        <section className="mt-5 space-y-2 px-5">
          {notices.map((n) => (
            <article key={n.id} className={`rounded-lg px-4 py-3 ${TONE[n.tone] || TONE.new}`}>
              <h2 className="font-bold">{n.title}</h2>
              {n.body && <p className="mt-0.5 text-sm opacity-90">{n.body}</p>}
            </article>
          ))}
        </section>
      )}

      <section className="mt-7 px-5">
        <h2 className="mb-3 font-bold text-ink">Browse</h2>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <Link
              key={c}
              href={`/shop/${encodeURIComponent(c)}`}
              className="inline-flex min-h-tap items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 px-5 font-bold text-ink">Featured</h2>
          <ProductRail products={featured} />
        </section>
      )}

      <section className="mt-7 px-5">
        <h2 className="mb-3 font-bold text-ink">Everything</h2>
        <ProductGrid products={shown.slice(0, 24)} />
        {shown.length > 24 && (
          <Link
            href="/shop"
            className="mt-4 flex min-h-tap items-center justify-center rounded-full border border-line font-semibold text-brand"
          >
            See all {shown.length}
          </Link>
        )}
      </section>
    </main>
  );
}
