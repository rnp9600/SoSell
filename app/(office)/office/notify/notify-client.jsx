'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Send, MessageCircle } from 'lucide-react';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const AUDIENCES = [
  ['people', 'These people'],
  ['role',   'A role'],
  ['dept',   'A department'],
  ['route',  "A route's shops"],
  ['all',    'Everyone'],
];

const ROLES = ['dealer', 'staff', 'end_customer', 'admin'];

/** Send a message to whoever needs it.
 *
 *  The audience picker resolves to a list of phones in SQL, and the count is
 *  shown before sending — "Everyone" reaching 400 people is something you
 *  should find out before you press the button, not after.
 *
 *  WhatsApp appears only for a single recipient, and it is a deep link: the
 *  message opens in the sender's own WhatsApp and they press send. No API, no
 *  template approval, no per-message cost. Automatic WhatsApp would need a
 *  Business API account and approved templates, which is a different project.
 */
export default function NotifyClient({ people, depts, routes, templates, sent }) {
  const router = useRouter();
  const [audience, setAudience] = useState('people');
  const [phones, setPhones] = useState([]);
  const [role, setRole] = useState('dealer');
  const [dept, setDept] = useState(depts[0]?.id || '');
  const [routeId, setRouteId] = useState(routes[0]?.id || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Counted here rather than fetched, so the number moves as you pick.
  const reach = useMemo(() => {
    if (audience === 'people') return phones.length;
    if (audience === 'role') return people.filter((p) => p.role === role).length;
    if (audience === 'dept') return people.filter((p) => p.dept === dept).length;
    if (audience === 'all') return people.length;
    return null; // a route's members are only known to the database
  }, [audience, phones, people, role, dept]);

  const matches = q.trim()
    ? people.filter((p) =>
        `${p.name || ''} ${p.shop || ''} ${p.phone}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];

  const single = audience === 'people' && phones.length === 1;
  const wa = single
    ? `https://wa.me/${phones[0]}?text=${encodeURIComponent([title, body].filter(Boolean).join('\n\n'))}`
    : null;

  async function send() {
    if (!title.trim() || busy) return;
    setBusy(true); setError(''); setResult(null);
    const payload = { audience, title: title.trim(), body: body.trim() || null };
    if (audience === 'people') payload.phones = phones;
    if (audience === 'role') payload.role = role;
    if (audience === 'dept') payload.dept = dept;
    if (audience === 'route') payload.route_id = routeId;

    const { data, error: err } = await settle(
      () => supabaseBrowser().rpc('send_message', { payload }),
      'Sending the message',
    );
    setBusy(false);
    if (err) return setError(err.message || 'That did not send.');
    setResult(data);
    setTitle(''); setBody(''); setPhones([]);
    router.refresh();
  }

  return (
    <main className="max-w-2xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Send a message</h1>
      <p className="mt-1 text-ink-2">
        It arrives in the app, and on their phone if they have turned on
        notifications.
      </p>

      {result && (
        <p className="mt-4 rounded-lg bg-ok-wash px-4 py-3 text-sm font-semibold text-ok">
          Sent to {result.reached} {result.reached === 1 ? 'person' : 'people'}.
        </p>
      )}

      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <Label>To</Label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setAudience(id)}
                      className={`min-h-tap rounded-full border px-4 text-sm font-semibold ${
                        audience === id ? 'border-brand bg-brand text-on-brand'
                                        : 'border-line bg-surface text-ink-2'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {audience === 'people' && (
          <div className="space-y-2">
            <Label htmlFor="find">Find someone</Label>
            <Input id="find" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Name, shop or number" className="h-11" />
            {matches.length > 0 && (
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {matches.map((p) => (
                  <li key={p.phone}>
                    <button type="button"
                            onClick={() => { setPhones((x) => x.includes(p.phone) ? x : [...x, p.phone]); setQ(''); }}
                            className="flex min-h-tap w-full items-center justify-between px-4 py-2 text-left">
                      <span className="font-semibold text-ink">{p.name || p.shop || p.phone}</span>
                      <span className="text-sm text-ink-3">{p.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {phones.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {phones.map((ph) => {
                  const p = people.find((x) => x.phone === ph);
                  return (
                    <button key={ph} type="button"
                            onClick={() => setPhones((x) => x.filter((y) => y !== ph))}
                            className="inline-flex min-h-tap items-center gap-2 rounded-full bg-brand-wash px-3 text-sm font-semibold text-brand-ink">
                      {p?.name || p?.shop || ph} ✕
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {audience === 'role' && (
          <select value={role} onChange={(e) => setRole(e.target.value)}
                  className="h-11 w-full rounded-md border border-line bg-surface px-3 capitalize text-ink">
            {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
          </select>
        )}
        {audience === 'dept' && (
          <select value={dept} onChange={(e) => setDept(e.target.value)}
                  className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
            {depts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        )}
        {audience === 'route' && (
          <select value={routeId} onChange={(e) => setRouteId(Number(e.target.value))}
                  className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}

        <p className="rounded-lg bg-surface-2 px-4 py-2.5 text-sm text-ink-2">
          {reach === null
            ? 'Everyone on that route.'
            : `This will reach ${reach} ${reach === 1 ? 'person' : 'people'}.`}
        </p>

        {templates.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="tpl">Start from a template</Label>
            <select id="tpl" defaultValue=""
                    onChange={(e) => {
                      const t = templates.find((x) => x.key === e.target.value);
                      if (t) { setTitle(t.title); setBody(t.body); }
                    }}
                    className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
              <option value="">— write it myself —</option>
              {templates.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}
            </select>
            {/* The placeholders are only filled when the ladder sends
                automatically; typed by hand they go out literally. */}
            <p className="text-sm text-ink-3">
              Anything in {'{braces}'} is filled in automatically when the
              reminder ladder sends it — typed by hand it goes out as written.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="ti">Heading</Label>
          <Input id="ti" value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="Shop closed on Friday" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bo">Message</Label>
          <Textarea id="bo" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={busy || !title.trim() || reach === 0} onClick={send}>
            <Send className="size-4" />
            {busy ? 'Sending…' : 'Send now'}
          </Button>
          {wa && (
            <Button asChild size="lg" variant="secondary">
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                Send on WhatsApp instead
              </a>
            </Button>
          )}
        </div>
      </div>

      {sent.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 font-bold text-ink">Recently sent</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {sent.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="font-semibold text-ink">{n.title}</p>
                {n.body && <p className="truncate text-sm text-ink-2">{n.body}</p>}
                <p className="text-sm text-ink-3">
                  {n.audience} · {new Date(n.created_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
