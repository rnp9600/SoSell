'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useSaved } from '@/lib/saved';
import { Header } from '@/components/pm/header';
import { ProductGrid } from '@/components/pm/product-card';
import { Empty } from '@/components/pm/empty';
import { Button } from '@/components/ui/button';

export default function SavedClient({ products }) {
  const { slugs } = useSaved();
  // Keep the reader's own order — most recently saved first.
  const list = slugs.map((s) => products.find((p) => p.slug === s)).filter(Boolean);

  return (
    <main>
      <Header title="Saved" />
      <div className="px-5 py-4">
        {list.length ? (
          <ProductGrid products={list} />
        ) : (
          <Empty
            icon={Heart}
            title="Nothing saved yet"
            body="Tap the heart on any product and it will be here — on this phone, and it works without a signal."
            action={
              <Button asChild>
                <Link href="/shop">Browse the shop</Link>
              </Button>
            }
          />
        )}
      </div>
    </main>
  );
}
