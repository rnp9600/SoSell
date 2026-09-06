import Link from 'next/link';
import { getCatalogue, visible } from '@/lib/catalogue';
import { Header } from '@/components/pm/header';

export const revalidate = 300;
export const metadata = { title: 'Shop' };

export default async function ShopPage() {
  const { products } = await getCatalogue();
  const shown = visible(products);

  // Count per category, so the reader knows whether a group is worth opening.
  const counts = new Map();
  for (const p of shown) {
    if (!p.cat) continue;
    counts.set(p.cat, (counts.get(p.cat) || 0) + 1);
  }
  const cats = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main>
      <Header title="Shop" />
      <ul className="divide-y divide-line">
        {cats.map(([cat, n]) => (
          <li key={cat}>
            <Link
              href={`/shop/${encodeURIComponent(cat)}`}
              className="flex min-h-tap items-center justify-between px-5 py-4"
            >
              <span className="font-semibold text-ink">{cat}</span>
              <span className="text-sm tabular-nums text-ink-3">{n}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
