import Link from 'next/link';
import {
  Users, Route as RouteIcon, Landmark, ClipboardCheck, FileText,
  ListTodo, Send, AlertTriangle,
} from 'lucide-react';
import { supabaseServer, currentUser, isAdmin } from '@/lib/supabase/server';
import { rupee } from '@/lib/money';
import { AgingBadge } from '@/components/pm/aging-badge';

export const metadata = { title: 'Office' };
export const dynamic = 'force-dynamic';

/** The office home.
 *
 *  Every number here comes back through RLS, so what a collector sees is
 *  genuinely their own routes and their own customers — the same page tells
 *  the truth to different people without branching on role.
 */
export default async function OfficePage() {
  const me = await currentUser();
  const sb = await supabaseServer();

  const [balances, cheques, routes, pendingPay, openIssues] = await Promise.all([
    sb.from('customer_balances').select('customer_phone,display,outstanding,pdc_pending,aging_days,aging_tier'),
    sb.from('payments').select('id,amount,cheque_date').eq('cheque_status', 'pending').eq('mode', 'cheque'),
    sb.from('routes').select('id,name,status').eq('status', 'active'),
    sb.from('payments').select('id').eq('status', 'under_verification'),
    sb.from('issues').select('id').eq('status', 'open'),
  ]);

  const rows = balances.data || [];
  const owing = rows.filter((r) => Number(r.outstanding) > 0);
  const total = owing.reduce((s, r) => s + Number(r.outstanding), 0);
  const pdcTotal = (cheques.data || []).reduce((s, c) => s + Number(c.amount), 0);
  const today = new Date().toISOString().slice(0, 10);
  const dueToBank = (cheques.data || []).filter((c) => c.cheque_date && c.cheque_date <= today);

  const critical = owing
    .filter((r) => ['Critical', 'Overdue'].includes(r.aging_tier))
    .sort((a, b) => b.aging_days - a.aging_days)
    .slice(0, 8);

  const tiles = [
    { label: 'Outstanding', value: rupee(total), sub: `${owing.length} accounts`, href: '/office/customers' },
    { label: 'Cheques not cleared', value: rupee(pdcTotal),
      sub: dueToBank.length ? `${dueToBank.length} due to bank` : 'none due yet',
      href: '/office/cheques', warn: dueToBank.length > 0 },
    { label: 'Waiting on you', value: String((pendingPay.data || []).length),
      sub: 'payments to verify', href: '/office/approvals' },
    { label: 'Open queries', value: String((openIssues.data || []).length),
      sub: 'raised by customers or staff', href: '/office/approvals' },
  ];

  const nav = [
    { href: '/office/customers', icon: Users, label: 'Customers', sub: 'Balances, bills and ledgers' },
    { href: '/office/routes', icon: RouteIcon, label: 'Routes', sub: `${(routes.data || []).length} active` },
    { href: '/office/cheques', icon: Landmark, label: 'Cheques to bank', sub: 'Clear or bounce' },
    { href: '/office/approvals', icon: ClipboardCheck, label: 'Approvals', sub: 'Payments, notes, sign-ups' },
    { href: '/office/tasks', icon: ListTodo, label: 'Tasks', sub: 'Who is doing what' },
    { href: '/office/notify', icon: Send, label: 'Send a message', sub: 'Team, a customer, or everyone' },
    { href: '/office/catalogue', icon: FileText, label: 'Catalogue', sub: 'Products, rates and notices' },
  ];

  return (
    <main className="space-y-7">
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {isAdmin(me) ? 'Today' : 'Your day'}
        </h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href}
                  className="rounded-lg border border-line bg-surface p-4 shadow-1">
              <p className="text-sm text-ink-2">{t.label}</p>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${t.warn ? 'text-warn' : 'text-ink'}`}>
                {t.value}
              </p>
              <p className="mt-0.5 text-sm text-ink-3">{t.sub}</p>
            </Link>
          ))}
        </div>
      </section>

      {critical.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold text-ink">
            <AlertTriangle className="size-4 text-warn" />
            Needs chasing
          </h2>
          {/* Overdue and Critical only. Since aging was fixed to run from the
              oldest UNPAID bill, this list is short and every name on it is
              genuinely behind — it used to include the best customers. */}
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {critical.map((c) => (
              <li key={c.customer_phone}>
                <Link href={`/office/customers/${c.customer_phone}`}
                      className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{c.display}</p>
                    <AgingBadge tier={c.aging_tier} days={c.aging_days} className="mt-1" />
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-ink">
                    {rupee(c.outstanding)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold text-ink">Everything else</h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {nav.map(({ href, icon: Icon, label, sub }) => (
            <li key={href}>
              <Link href={href} className="flex min-h-tap items-center gap-3 px-4 py-3.5">
                <Icon className="size-5 shrink-0 text-ink-3" />
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{label}</span>
                  <span className="block text-sm text-ink-3">{sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
