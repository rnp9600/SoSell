'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ListTodo, Check, Play } from 'lucide-react';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet } from '@/components/pm/sheet';
import { Empty } from '@/components/pm/empty';

const PRIORITY = { 1: 'High', 2: 'Normal', 3: 'Low' };
const KINDS = ['todo', 'call', 'visit', 'collect', 'deliver', 'purchase', 'fix'];

/** Who is doing what.
 *
 *  Grouped by WHEN rather than by person, because the question somebody opens
 *  this to answer is "what has to happen today", not "what is Ravi's list".
 *  Overdue sits at the top and says so.
 */
export default function TasksClient({ tasks, team, depts, me, isAdmin }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', detail: '', kind: 'todo', assigned_to: '', assigned_dept: '',
    due_on: '', priority: 2,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mine, setMine] = useState(false);

  const names = useMemo(
    () => new Map(team.map((t) => [t.phone, t.name || `+91 ${t.phone.slice(-10)}`])),
    [team],
  );
  const deptLabel = useMemo(() => new Map(depts.map((d) => [d.id, d.label])), [depts]);

  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);

  const shown = mine ? tasks.filter((t) => t.assigned_to === me) : tasks;
  const live = shown.filter((t) => t.status !== 'done');

  const groups = [
    ['Overdue',   live.filter((t) => t.due_on && t.due_on < today)],
    ['Today',     live.filter((t) => t.due_on === today)],
    ['This week', live.filter((t) => t.due_on && t.due_on > today && t.due_on <= weekEnd)],
    ['Later',     live.filter((t) => !t.due_on || t.due_on > weekEnd)],
    ['Done',      shown.filter((t) => t.status === 'done').slice(0, 20)],
  ].filter(([, list]) => list.length);

  async function create() {
    if (!form.title.trim() || busy) return;
    setBusy(true); setError('');
    const { error: err } = await settle(
      () => supabaseBrowser().rpc('assign_task', { payload: {
        ...form,
        assigned_to: form.assigned_to || null,
        assigned_dept: form.assigned_dept || null,
        due_on: form.due_on || null,
      } }),
      'Creating the task',
    );
    setBusy(false);
    if (err) return setError(err.message || 'Could not create that.');
    setOpen(false);
    setForm({ title: '', detail: '', kind: 'todo', assigned_to: '', assigned_dept: '', due_on: '', priority: 2 });
    router.refresh();
  }

  async function setStatus(id, status) {
    await settle(
      () => supabaseBrowser().rpc('set_task_status', { p_id: id, p_status: status }),
      'Updating the task',
    );
    router.refresh();
  }

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Tasks</h1>
        <div className="flex gap-2">
          <Button variant={mine ? 'primary' : 'quiet'} size="sm" onClick={() => setMine(!mine)}>
            {mine ? 'Mine' : 'Everyone'}
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>Assign work</Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Empty icon={ListTodo} title={mine ? 'Nothing assigned to you' : 'No tasks yet'}
               body="A schedule is the shape of the week; a task is what came up."
               action={<Button onClick={() => setOpen(true)}>Assign work</Button>} />
      ) : (
        groups.map(([label, list]) => (
          <section key={label} className="mb-6">
            <h2 className={`mb-2 font-bold ${label === 'Overdue' ? 'text-bad' : 'text-ink'}`}>
              {label} <span className="font-normal text-ink-3">· {list.length}</span>
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {list.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${t.status === 'done' ? 'text-ink-3 line-through' : 'text-ink'}`}>
                      {t.title}
                    </p>
                    {t.detail && <p className="text-sm text-ink-2">{t.detail}</p>}
                    <p className="mt-0.5 text-sm text-ink-3">
                      {t.assigned_to ? names.get(t.assigned_to) || 'someone'
                                     : deptLabel.get(t.assigned_dept) || t.assigned_dept}
                      {t.due_on && ` · due ${new Date(t.due_on).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short' })}`}
                      {t.priority !== 2 && ` · ${PRIORITY[t.priority]}`}
                      {t.kind !== 'todo' && ` · ${t.kind}`}
                    </p>
                  </div>
                  {t.status !== 'done' && (
                    <div className="flex shrink-0 gap-1">
                      {t.status === 'open' && (
                        <button type="button" aria-label="Start"
                                onClick={() => setStatus(t.id, 'doing')}
                                className="grid size-11 place-items-center rounded-full text-ink-3 hover:text-brand">
                          <Play className="size-4" />
                        </button>
                      )}
                      <button type="button" aria-label="Done"
                              onClick={() => setStatus(t.id, 'done')}
                              className="grid size-11 place-items-center rounded-full text-ink-3 hover:text-ok">
                        <Check className="size-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {/* Assigning is a DECISION, so it is a sheet — dismissing it should not
          consume a Back press. The task itself would be a route. */}
      <Sheet
        open={open} onOpenChange={setOpen} title="Assign work"
        footer={
          <Button block size="lg" disabled={busy || !form.title.trim()} onClick={create}>
            {busy ? 'Assigning…' : 'Assign it'}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t">What needs doing</Label>
            <Input id="t" value={form.title} autoFocus
                   onChange={(e) => setForm({ ...form, title: e.target.value })}
                   placeholder="Call Sharma Traders about the overdue bill"
                   className="h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d">Notes (optional)</Label>
            <Textarea id="d" rows={2} value={form.detail}
                      onChange={(e) => setForm({ ...form, detail: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="who">Who</Label>
            <select id="who" value={form.assigned_to}
                    onChange={(e) => setForm({ ...form, assigned_to: e.target.value, assigned_dept: '' })}
                    className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
              <option value="">— a whole department —</option>
              {team.map((p) => (
                <option key={p.phone} value={p.phone}>
                  {p.name || `+91 ${p.phone.slice(-10)}`}
                </option>
              ))}
            </select>
            {!form.assigned_to && (
              <select value={form.assigned_dept}
                      onChange={(e) => setForm({ ...form, assigned_dept: e.target.value })}
                      className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
                <option value="">Pick a department</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="due">Due</Label>
              <Input id="due" type="date" value={form.due_on}
                     onChange={(e) => setForm({ ...form, due_on: e.target.value })}
                     className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pri">Priority</Label>
              <select id="pri" value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                      className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
                <option value={1}>High</option>
                <option value={2}>Normal</option>
                <option value={3}>Low</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <select id="kind" value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                    className="h-11 w-full rounded-md border border-line bg-surface px-3 capitalize text-ink">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      </Sheet>
    </main>
  );
}
