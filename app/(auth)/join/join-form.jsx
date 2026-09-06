'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const KINDS = [
  ['dealer', 'I run a shop', 'You buy from us to sell on.'],
  ['end_customer', "I'm a customer", 'You buy from a shop, not from us directly.'],
  ['staff', 'I work here', 'Somebody in the office will confirm this.'],
];

export default function JoinForm({ depts, phone }) {
  const router = useRouter();
  const [kind, setKind] = useState('dealer');
  const [f, setF] = useState({
    name: '', business_name: '', nickname: '', area: '', city: '',
    gst: '', gst_status: '', dept: '', note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = f.name.trim() && (kind !== 'staff' || f.dept);

  async function submit(e) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true); setError('');
    const { error: err } = await settle(
      () => supabaseBrowser().rpc('submit_signup', { payload: { ...f, kind } }),
      'Sending your details',
    );
    setBusy(false);
    if (err) return setError(err.message || 'That did not go through.');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label>Which are you?</Label>
        <div className="space-y-2">
          {KINDS.map(([id, label, hint]) => (
            <button key={id} type="button" onClick={() => setKind(id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left ${
                      kind === id ? 'border-brand bg-brand-wash' : 'border-line bg-surface'}`}>
              <span className="block font-semibold text-ink">{label}</span>
              <span className="block text-sm text-ink-2">{hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="n">Your name</Label>
        <Input id="n" value={f.name} required className="h-11"
               onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>

      {kind !== 'staff' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="b">{kind === 'dealer' ? 'Shop or firm' : 'Where you shop (optional)'}</Label>
            <Input id="b" value={f.business_name} className="h-11"
                   onChange={(e) => setF({ ...f, business_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="a">Area</Label>
              <Input id="a" value={f.area} className="h-11"
                     onChange={(e) => setF({ ...f, area: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c">City</Label>
              <Input id="c" value={f.city} className="h-11"
                     onChange={(e) => setF({ ...f, city: e.target.value })} />
            </div>
          </div>
          {/* The nickname rule: optional, and the only blank on an otherwise
              filled form. Where it is set the office sees it; where it is not
              they see "Firm name (Area)" — because two shops called Sharma
              Traders is the normal case, and the area tells them apart. */}
          <div className="space-y-2">
            <Label htmlFor="k">What we should call you (optional)</Label>
            <Input id="k" value={f.nickname} className="h-11"
                   placeholder="A short name the office will recognise"
                   onChange={(e) => setF({ ...f, nickname: e.target.value })} />
          </div>
        </>
      )}

      {kind === 'dealer' && (
        <div className="space-y-2">
          <Label htmlFor="g">GST number (optional)</Label>
          <Input id="g" value={f.gst} className="h-11"
                 onChange={(e) => setF({ ...f, gst: e.target.value.toUpperCase(),
                                         gst_status: e.target.value ? 'registered' : '' })} />
        </div>
      )}

      {kind === 'staff' && (
        <div className="space-y-2">
          <Label htmlFor="d">Which department?</Label>
          <select id="d" value={f.dept} required
                  onChange={(e) => setF({ ...f, dept: e.target.value })}
                  className="h-11 w-full rounded-md border border-line bg-surface px-3 text-ink">
            <option value="">Pick one</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="no">Anything else (optional)</Label>
        <Input id="no" value={f.note} className="h-11"
               onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>

      <p className="text-sm text-ink-3">Signing up as +91 {String(phone).slice(-10)}</p>
      {error && <p className="text-sm text-bad">{error}</p>}

      <Button type="submit" size="lg" block disabled={!ready || busy}>
        {busy ? 'Sending…' : 'Send this to the office'}
      </Button>
    </form>
  );
}
