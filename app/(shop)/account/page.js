import Link from 'next/link';
import { Icon } from '@/components/pm/icon';
import { currentUser, roleOf, isAdmin, isOffice, isDealer } from '@/lib/supabase/server';
import { supabaseServer } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { APP, FIRM } from '@/lib/config';
import SignOutButton from './sign-out-button';

export const metadata = { title: 'Your account' };
export const dynamic = 'force-dynamic';

const ROLE_LABEL = {
  admin: 'Admin', staff: 'Office', dealer: 'Dealer',
  shop_owner: 'Dealer', end_customer: 'Customer', guest: 'Browsing',
};

function Row({ href, icon, label, sub, badge }) {
  return (
    <Link href={href} className="flex min-h-tap items-center gap-3 px-5 py-3.5">
      <Icon name={icon} className="size-5 shrink-0 text-ink-3" />
      <span className="flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        {sub && <span className="block text-sm text-ink-3">{sub}</span>}
      </span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand">
          {badge}
        </span>
      )}
    </Link>
  );
}

/** One place a person manages their account — and the ONLY place in the whole
 *  app with a Sign out. Every other screen shows their initial in the header
 *  and links back here. Leaving is not the main thing anyone came to do. */
export default async function AccountPage() {
  const me = await currentUser();
  const role = roleOf(me);
  const row = me?.row;

  let pending = 0;
  let canApprove = false;
  if (row) {
    try {
      const sb = await supabaseServer();
      const { data } = await sb.rpc('can_approve_any');
      canApprove = !!data;
      if (canApprove) {
        const { data: q } = await sb
          .from('approval_queue').select('id').eq('status', 'pending').limit(50);
        pending = (q || []).length;
      }
    } catch { /* the queue is a nicety; the page still works without it */ }
  }

  if (!row) {
    return (
      <main>
        <header className="px-5 pb-4 pt-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-t))' }}>
          <h1 className="text-2xl font-extrabold text-ink">Your account</h1>
          <p className="mt-1 text-ink-2">
            {me?.authed ? 'Signed in, but not on our list yet.' : 'Not signed in'}
          </p>
        </header>
        <div className="px-5">
          <Button asChild size="lg" block>
            <Link href={me?.authed ? '/join' : '/signin?next=/account'}>
              {me?.authed ? 'Tell us who you are' : 'Sign in'}
            </Link>
          </Button>
        </div>
        <nav className="mt-6 divide-y divide-line border-y border-line">
          <Row href="/saved" icon="heart" label="Saved" />
          <Row href="/help" icon="info" label="Help" />
        </nav>
      </main>
    );
  }

  const initials = (row.name || row.shop || '?')
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <main className="pb-8">
      <header className="px-5 pb-5 pt-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-t))' }}>
        <div className="flex items-center gap-3">
          {row.photo_url ? (
            <img src={row.photo_url} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <span className="grid size-14 place-items-center rounded-full bg-brand text-lg font-bold text-on-brand">
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold text-ink">
              {row.name || row.shop || 'Your account'}
            </h1>
            <p className="truncate text-ink-2">{row.shop || row.city || ''}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-wash px-3 py-1 text-sm font-semibold text-brand-ink">
            {ROLE_LABEL[role] || role}
          </span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink-2">
            +91 {String(row.phone).slice(-10)}
          </span>
          {row.gst && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-ink-2">
              {row.gst}
            </span>
          )}
        </div>
      </header>

      <nav className="divide-y divide-line border-y border-line">
        <Row href="/orders" icon="receipt" label="Your orders" />
        {isDealer(me) && (
          <>
            <Row href="/cart" icon="bag" label="Your current order" />
            <Row href="/account/ledger" icon="wallet" label="Your account with us"
                 sub="What you owe, bills, receipts and cheques" />
          </>
        )}
        <Row href="/saved" icon="heart" label="Saved" />
      </nav>

      {canApprove && (
        <>
          <h2 className="px-5 pb-2 pt-6 text-sm font-bold text-ink-2">Office queue</h2>
          <nav className="divide-y divide-line border-y border-line">
            <Row href="/approvals" icon="shield" label="Approvals" badge={pending} />
            <Row href="/notifications" icon="bell" label="Notifications" />
          </nav>
        </>
      )}

      {isOffice(me) && (
        <>
          <h2 className="px-5 pb-2 pt-6 text-sm font-bold text-ink-2">{FIRM.legalName}</h2>
          <nav className="divide-y divide-line border-y border-line">
            <Row href="/office" icon="grid" label="Office" sub="Products, routes, collections, tasks" />
          </nav>
        </>
      )}

      <nav className="mt-6 divide-y divide-line border-y border-line">
        <Row href="/settings" icon="cog" label="Settings" />
        <Row href="/help" icon="info" label="Help" />
        <a
          href={`https://wa.me/${FIRM.whatsapp}`}
          className="flex min-h-tap items-center gap-3 px-5 py-3.5"
        >
          <Icon name="wa" className="size-5 shrink-0 text-ink-3" />
          <span className="flex-1 font-semibold text-ink">Message us</span>
        </a>
      </nav>

      <div className="px-5 pt-8">
        <SignOutButton />
      </div>

      <p className="px-5 pt-6 text-center text-xs text-ink-3">
        {FIRM.legalName} · {APP.name} · build {APP.build}
      </p>
    </main>
  );
}
