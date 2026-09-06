import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { supabaseServer, currentUser } from '@/lib/supabase/server';
import { Header } from '@/components/pm/header';
import { Empty } from '@/components/pm/empty';
import MarkRead from './mark-read';

export const metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const me = await currentUser();
  if (!me?.row) redirect('/signin?next=/notifications');

  const sb = await supabaseServer();
  const { data } = await sb.from('my_notifications').select('*').limit(60);
  const list = data || [];
  const unread = list.filter((n) => !n.is_read).map((n) => n.id);

  return (
    <main>
      <Header title="Notifications" back="/account" />
      {list.length === 0 ? (
        <Empty icon={Bell} title="Nothing yet"
               body="Messages from the office, and anything that needs your attention, will be here." />
      ) : (
        <>
          <MarkRead ids={unread} />
          <ul className="divide-y divide-line">
            {list.map((n) => {
              const inner = (
                <>
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                    <div className="min-w-0">
                      <p className={`font-semibold ${n.is_read ? 'text-ink-2' : 'text-ink'}`}>
                        {n.title}
                      </p>
                      {n.body && <p className="text-sm text-ink-2">{n.body}</p>}
                      <p className="mt-0.5 text-sm text-ink-3">
                        {new Date(n.created_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </>
              );
              return (
                <li key={n.id} className="px-5 py-3.5">
                  {n.url ? <Link href={n.url}>{inner}</Link> : inner}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
