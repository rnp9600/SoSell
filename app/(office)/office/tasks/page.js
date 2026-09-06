import { supabaseServer, currentUser } from '@/lib/supabase/server';
import TasksClient from './tasks-client';

export const metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const me = await currentUser();
  const sb = await supabaseServer();

  const [{ data: tasks }, { data: team }, { data: depts }] = await Promise.all([
    sb.from('tasks').select('*').neq('status', 'cancelled').order('due_on', { nullsFirst: false }),
    // Work is assigned to people who work here, so the picker only offers them.
    sb.from('allowlist').select('phone,name,dept,role,is_admin')
      .or('role.eq.staff,is_admin.eq.true'),
    sb.from('departments').select('id,label').order('sort'),
  ]);

  return (
    <TasksClient
      tasks={tasks || []}
      team={team || []}
      depts={depts || []}
      me={me.phone}
      isAdmin={!!me.row?.is_admin}
    />
  );
}
