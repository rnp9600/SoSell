import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import DaySheet from './day-sheet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Day sheet' };

export default async function CollectionPage({ params }) {
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: coll } = await sb
    .from('collections').select('*').eq('id', id).maybeSingle();
  if (!coll) notFound();

  const [{ data: route }, { data: visits }, { data: balances }] = await Promise.all([
    sb.from('routes').select('id,name,kind').eq('id', coll.route_id).maybeSingle(),
    sb.from('collection_visits').select('*').eq('collection_id', id),
    sb.from('customer_balances').select('*'),
  ]);

  const bal = new Map((balances || []).map((b) => [b.customer_phone, b]));
  const rows = (visits || []).map((v) => ({
    ...v,
    balance: bal.get(v.customer_phone) || null,
  }));
  // Most owed first — that is the order somebody actually wants to walk it.
  rows.sort((a, b) => Number(b.balance?.outstanding || 0) - Number(a.balance?.outstanding || 0));

  return <DaySheet collection={coll} route={route} visits={rows} />;
}
