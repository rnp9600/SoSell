import { supabaseServer } from '@/lib/supabase/server';
import ChequesClient from './cheques-client';

export const metadata = { title: 'Cheques to bank' };
export const dynamic = 'force-dynamic';

export default async function ChequesPage() {
  const sb = await supabaseServer();
  const { data } = await sb
    .from('payments')
    .select('id,receipt_no,customer_phone,amount,bank_name,cheque_no,cheque_date,cheque_status,bounced_on,bounce_reason')
    .eq('mode', 'cheque')
    .order('cheque_date');

  const all = data || [];
  const names = new Map();
  const { data: people } = await sb
    .from('customer_balances').select('customer_phone,display');
  for (const p of people || []) names.set(p.customer_phone, p.display);

  return <ChequesClient cheques={all.map((c) => ({ ...c, display: names.get(c.customer_phone) }))} />;
}
