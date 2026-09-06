import { Suspense } from 'react';
import { getCatalogue, visible } from '@/lib/catalogue';
import SearchClient from './search-client';

export const revalidate = 300;
export const metadata = { title: 'Search' };

export default async function SearchPage() {
  const { products } = await getCatalogue();
  return (
    <Suspense fallback={<div className="p-5 text-ink-3">Loading…</div>}>
      <SearchClient products={visible(products)} />
    </Suspense>
  );
}
