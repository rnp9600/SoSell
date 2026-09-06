import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { APP, FIRM } from '@/lib/config';
import SignInForm from './sign-in-form';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' && params.next.startsWith('/') ? params.next : '/';

  // Already signed in and already on the list — nothing to do here.
  const me = await currentUser();
  if (me?.row) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{APP.name}</h1>
        <p className="mt-1 text-ink-2">
          {FIRM.legalName} · {FIRM.trade}
        </p>
      </header>

      <SignInForm next={next} />
    </main>
  );
}
