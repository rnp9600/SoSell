'use client';

import { useMemo, useState, useEffect, useDeferredValue } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search as SearchIcon, X } from 'lucide-react';
import { search as runSearch, suggest } from '@/lib/search';
import { ProductGrid } from '@/components/pm/product-card';
import { Empty } from '@/components/pm/empty';
import { KEYS, read, write } from '@/lib/storage';

/** Search, with the rescue visible.
 *
 *  When a query comes back empty and the rescue finds something, the screen
 *  SAYS SO and offers the literal search back. Correcting quietly is how you
 *  lose someone's trust in results they cannot check.
 */
export default function SearchClient({ products }) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get('q') || '';
  const exact = params.get('exact') === '1';

  const [q, setQ] = useState(initial);
  const deferred = useDeferredValue(q);
  const [recent, setRecent] = useState([]);

  useEffect(() => { setRecent(read(KEYS.recentSearches, []) || []); }, []);

  const result = useMemo(
    () => runSearch(deferred, products, { exact }),
    [deferred, products, exact],
  );
  const tips = useMemo(
    () => (deferred.trim() && !result.hits.length ? [] : suggest(deferred, products)),
    [deferred, products, result.hits.length],
  );

  // Remember it once they have stopped typing and it actually found something.
  useEffect(() => {
    const t = setTimeout(() => {
      const term = deferred.trim();
      if (term.length < 2 || !result.hits.length) return;
      setRecent((prev) => {
        const next = [term, ...prev.filter((r) => r !== term)].slice(0, 8);
        write(KEYS.recentSearches, next);
        return next;
      });
    }, 900);
    return () => clearTimeout(t);
  }, [deferred, result.hits.length]);

  const typed = q.trim();

  return (
    <main>
      <div
        className="sticky top-0 z-30 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur-md"
        style={{ paddingTop: 'calc(0.5rem + var(--safe-t))' }}
      >
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4">
          <SearchIcon className="size-5 shrink-0 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, brand, code, or what it is called locally"
            aria-label="Search products"
            className="h-11 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setQ('')}
              className="grid size-8 place-items-center rounded-full text-ink-3 hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {!typed && (
          <>
            {recent.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 text-sm font-bold text-ink-2">Recent</h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQ(r)}
                      className="inline-flex min-h-tap items-center rounded-full border border-line bg-surface px-4 text-sm text-ink"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <p className="text-ink-3">
              {products.length} products. Try a brand, a code, or the name you
              would use at the counter.
            </p>
          </>
        )}

        {typed && result.note && (
          // The rescue, said out loud, with the literal search one press away.
          <p className="mb-4 rounded-lg bg-brand-wash px-4 py-3 text-sm text-brand-ink">
            Showing results for <strong>{result.note.shown}</strong>.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => router.push(`/search?q=${encodeURIComponent(result.note.typed)}&exact=1`)}
            >
              Search {result.note.typed} instead
            </button>
          </p>
        )}

        {typed && tips.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {tips.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQ(t)}
                className="inline-flex min-h-tap items-center rounded-full bg-surface-2 px-3 text-sm text-ink-2"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {typed && result.hits.length > 0 && (
          <>
            <p className="mb-3 text-sm text-ink-3">
              {result.hits.length} {result.hits.length === 1 ? 'product' : 'products'}
            </p>
            <ProductGrid products={result.hits.slice(0, 60)} />
          </>
        )}

        {typed && result.hits.length === 0 && (
          <Empty
            icon={SearchIcon}
            title={`Nothing matches "${typed}"`}
            body="We may stock it under another name — try the brand, the code, or what you would call it at the counter. Either way we have noted the search."
          />
        )}
      </div>
    </main>
  );
}
