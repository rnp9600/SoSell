import { supabaseServer } from '@/lib/supabase/server';
import ApprovalsClient from './approvals-client';

export const metadata = { title: 'Approvals' };
export const dynamic = 'force-dynamic';

/** One queue, not four.
 *
 *  The prototype had payments, credit notes, discount notes and sign-ups on
 *  separate screens, so "is there anything waiting for me?" needed four
 *  answers. Everything that needs a decision is here.
 */
export default async function ApprovalsPage() {
  const sb = await supabaseServer();

  const [pay, adj, signups, issues, reopen, balances] = await Promise.all([
    sb.from('payments')
      .select('id,receipt_no,customer_phone,amount,mode,utr,created_at')
      .eq('status', 'under_verification').order('created_at'),
    sb.from('adjustments')
      .select('id,customer_phone,kind,amount,reason,receipt_no,created_by,created_at')
      .eq('status', 'pending').order('created_at'),
    sb.from('approval_queue').select('*').eq('status', 'pending'),
    sb.from('issues').select('*').eq('status', 'open').order('created_at'),
    sb.from('collections').select('id,route_id,on_date,reopen_requested_at')
      .not('reopen_requested_at', 'is', null).eq('status', 'ended'),
    sb.from('customer_balances').select('customer_phone,display'),
  ]);

  const names = new Map((balances.data || []).map((b) => [b.customer_phone, b.display]));
  const name = (p) => names.get(p) || `+91 ${String(p || '').slice(-10)}`;

  return (
    <ApprovalsClient
      payments={(pay.data || []).map((p) => ({ ...p, display: name(p.customer_phone) }))}
      adjustments={(adj.data || []).map((a) => ({ ...a, display: name(a.customer_phone) }))}
      signups={signups.data || []}
      issues={(issues.data || []).map((i) => ({ ...i, display: name(i.customer_phone) }))}
      reopens={reopen.data || []}
    />
  );
}
