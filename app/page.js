import Link from 'next/link';
import { currentUser, roleOf } from '@/lib/supabase/server';
import { getCatalogue, sourceLabel } from '@/lib/catalogue';
import { Button } from '@/components/ui/button';
import { APP, FIRM } from '@/lib/config';

export default async function Home() {
  const me = await currentUser();
  const { products, source, error } = await getCatalogue();

  return (
    <main className="mx-auto max-w-page px-5 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{APP.name}</h1>
      <p className="mt-1 text-ink-2">
        {FIRM.legalName} · {FIRM.trade}
      </p>

      <dl className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-ink-2">Products</dt>
          <dd className="mt-1 text-2xl font-bold text-ink">{products.length}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-ink-2">Catalogue read from</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">{sourceLabel(source, error)}</dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <dt className="text-sm text-ink-2">You are</dt>
          <dd className="mt-1 text-lg font-semibold text-ink">
            {me?.row ? roleOf(me) : me?.authed ? 'signed in, not on the list' : 'browsing'}
          </dd>
        </div>
      </dl>

      {!me?.authed && (
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
