import Link from 'next/link';
import { Route as RouteIcon } from 'lucide-react';
import { supabaseServer, currentUser, isAdmin } from '@/lib/supabase/server';
import { Empty } from '@/components/pm/empty';
import { rupee } from '@/lib/money';
import StartRoute from './start-route';

export const metadata = { title: 'Routes' };
export const dynamic = 'force-dynamic';

/** Routes, and today's day sheets.
 *
 *  A collector sees only their own routes here — not because this page filters
 *  them, but because catalog.routes has a policy saying so. Take somebody off
 *  a route and it disappears from this page and their access to those ledgers
 *  goes with it, in the same instant, with no deploy.
 */
export default async function RoutesPage() {
  const me = await currentUser();
  const sb = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: routes }, { data: today_ }, { data: members }, { data: balances }] =
    await Promise.all([
      sb.from('routes').select('*').neq('status', 'archived').order('name'),
      sb.from('collections').select('id,route_id,status,on_date').eq('on_date', today),
      sb.from('route_members').select('route_id,customer_phone'),
      sb.from('customer_balances').select('customer_phone,outstanding'),
    ]);

  const owed = new Map((balances || []).map((b) => [b.customer_phone, Number(b.outstanding)]));
  const perRoute = new Map();
  for (const m of members || []) {
    const cur = perRoute.get(m.route_id) || { n: 0, due: 0 };
    cur.n += 1;
    cur.due += Math.max(0, owed.get(m.customer_phone) || 0);
    perRoute.set(m.route_id, cur);
  }
  const sheets = new Map((today_ || []).map((c) => [c.route_id, c]));
  const list = routes || [];

  return (
    <main>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Routes</h1>
      <p className="mt-1 text-ink-2">
        {list.length} {list.length === 1 ? 'route' : 'routes'}
      </p>

      {list.length === 0 ? (
        <Empty icon={RouteIcon} title="No routes yet" className="mt-6"
               body={isAdmin(me)
                 ? 'A route is a list of shops one person visits on a day.'
                 : 'Nothing has been assigned to you.'} />
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((r) => {
            const stats = perRoute.get(r.id) || { n: 0, due: 0 };
            const sheet = sheets.get(r.id);
            return (
              <li key={r.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-ink">{r.name}</h2>
                    <p className="text-sm text-ink-2">
                      {stats.n} {stats.n === 1 ? 'shop' : 'shops'} · {rupee(stats.due)} due · {r.kind}
                    </p>
                    {sheet && (
                      <p className="mt-1 text-sm">
                        {sheet.status === 'active'
                          ? <span className="font-semibold text-ok">Running today</span>
                          : <span className="text-ink-3">Ended for today</span>}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {sheet ? (
                      <Link href={`/office/collections/${sheet.id}`}
                            className="inline-flex min-h-tap items-center rounded-full bg-brand px-5 font-semibold text-on-brand">
                        {sheet.status === 'active' ? 'Continue' : 'See sheet'}
                      </Link>
                    ) : (
                      <StartRoute routeId={r.id} disabled={stats.n === 0} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
