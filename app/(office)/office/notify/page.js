import { supabaseServer } from '@/lib/supabase/server';
import NotifyClient from './notify-client';

export const metadata = { title: 'Send a message' };
export const dynamic = 'force-dynamic';

export default async function NotifyPage() {
  const sb = await supabaseServer();
  const [{ data: people }, { data: depts }, { data: routes }, { data: templates }, { data: sent }] =
    await Promise.all([
      sb.from('allowlist').select('phone,name,shop,role,dept'),
      sb.from('departments').select('id,label').order('sort'),
      sb.from('routes').select('id,name').eq('status', 'active').order('name'),
      sb.from('notification_templates').select('*').eq('active', true).order('key'),
      sb.from('notifications').select('id,title,body,audience,created_at,kind')
        .order('created_at', { ascending: false }).limit(15),
    ]);

  return (
    <NotifyClient
      people={people || []}
      depts={depts || []}
      routes={routes || []}
      templates={templates || []}
      sent={sent || []}
    />
  );
}
