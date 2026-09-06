import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, roleOf, isOffice } from '@/lib/supabase/server';
import { SessionProvider } from '@/lib/session';
import { APP, FIRM } from '@/lib/config';

/** The office shell.
 *
 *  The redirect below is a COURTESY, not the access control — it saves someone
 *  a confusing empty screen. Row-level security is what actually stops a
 *  dealer reading the order book, and it would stop them even if this file
 *  did not exist. Never add a check here and treat it as the rule.
 */
export default async function OfficeLayout({ children }) {
  const me = await currentUser();
  if (!me?.row) redirect('/signin?next=/office');
  if (!isOffice(me)) redirect('/account');

  return (
    <SessionProvider value={{ role: roleOf(me), phone: me.phone, row: me.row }}>
      <div className="min-h-dvh bg-bg">
        <header
          className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-md"
          style={{ paddingTop: 'var(--safe-t)' }}
        >
          <div className="mx-auto flex h-header max-w-page items-center gap-3 px-4">
            <Link href="/office" className="font-extrabold tracking-tight text-ink">
              {APP.name} <span className="font-normal text-ink-3">office</span>
            </Link>
            <span className="ml-auto truncate text-sm text-ink-3">
              {me.row.name || FIRM.legalName}
            </span>
            {/* No Sign out here. There is exactly one in the whole app, on the
                account screen — leaving is not the main thing anyone came to
                do, and four copies of it is how one goes stale. */}
            <Link
              href="/account"
              aria-label="Your account"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-on-brand"
            >
              {(me.row.name || '?').trim()[0]?.toUpperCase()}
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-page px-4 py-5">{children}</div>
      </div>
    </SessionProvider>
  );
}
