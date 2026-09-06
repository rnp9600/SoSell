import { notFound } from 'next/navigation';
import { supabaseServer, currentUser } from '@/lib/supabase/server';
import { getCatalogue, visible } from '@/lib/catalogue';
import RepeatClient from './repeat-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { ref } = await params;
  return { title: `Order ${ref} again` };
}

export default async function RepeatPage({ params }) {
  const { ref } = await params;
  const me = await currentUser();
  if (!me?.row) notFound();

  const sb = await supabaseServer();
  const { data: order } = await sb
    .from('order_summary').select('id,ref').eq('ref', ref).maybeSingle();
  if (!order) notFound();

  const { data: lines } = await sb
    .from('order_items')
    .select('product_slug,name,size,qty,sort')
    .eq('order_id', order.id)
    .order('sort');

  const { products } = await getCatalogue();
  return <RepeatClient ref_={order.ref} lines={lines || []} products={visible(products)} />;
}
