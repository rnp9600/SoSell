'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { supabaseBrowser, settle } from '@/lib/supabase/browser';
import { Header } from '@/components/pm/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rupee } from '@/lib/money';
import { KEYS, write } from '@/lib/storage';

/** Placing the order.
 *
 *  ═══════════════════════════════════════════════════════════════════════
 *  IF THE DATABASE REFUSES, THE ORDER IS NOT DISCARDED.
 *
 *  A customer's order must not be lost because a connection dropped. When
 *  place_order fails we keep a locally generated reference, say plainly that
 *  it was NOT recorded, and offer WhatsApp — which is how these orders reached
 *  the office before there was a database at all.
 *
 *  The temptation is to show an error and clear nothing. That leaves someone
 *  staring at a full basket with no idea whether they have ordered.
 *  ═══════════════════════════════════════════════════════════════════════
 */
function localRef() {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const key = KEYS.orderSeq(day);
  let n = 1;
  try {
    n = (JSON.parse(localStorage.getItem(key) || '0') || 0) + 1;
    localStorage.setItem(key, JSON.stringify(n));
  } catch { /* storage blocked — the ref is still unique enough to quote */ }
  return `PM-${day}-${String(n).padStart(3, '0')}`;
}

export default function CheckoutClient({ prefill }) {
  const router = useRouter();
  const { items, count, total, hasAsk, clear } = useCart();
  const [form, setForm] = useState(prefill);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const phone = String(form.phone || '').replace(/\D/g, '').slice(-10);
  const ready = form.name.trim() && form.shop.trim() && phone.length === 10;

  async function place(e) {
    e.preventDefault();
    if (!ready || busy || !items.length) return;
    setBusy(true);
    setError('');

    const payload = items.map((i) => ({
      slug: i.slug, name: i.name, size: i.size, unit: i.unit,
      qty: i.qty,
      // null means "rate on request" — the line goes on the order open.
      price: i.price ?? null,
      mrp: i.mrp ?? null,
    }));

    const sb = supabaseBrowser();
    const { data, error: err } = await settle(
      () =>
        sb.rpc('place_order', {
          p_customer: null, // null = the caller; only the office may pass someone else
          p_note: [
            `From: ${form.name.trim()}`,
            form.shop.trim(),
            `+91${phone}`,
            note.trim(),
          ].filter(Boolean).join(' · '),
          p_items: payload,
        }),
      'Placing the order',
    );

    setBusy(false);

    if (err || !data) {
      // Not recorded — but not lost either.
      const ref = localRef();
      write(KEYS.lastOrder, { ref, recorded: false, at: Date.now() });
      clear();
      router.replace(`/placed/${ref}?recorded=0`);
      return;
    }

    write(KEYS.lastOrder, { ref: data, recorded: true, at: Date.now() });
    clear();
    router.replace(`/placed/${data}`);
  }

  if (!items.length) {
    return (
      <main>
        <Header title="Checkout" back="/cart" />
        <p className="p-5 text-ink-2">There is nothing to order.</p>
      </main>
    );
  }

  return (
    <main>
      <Header title="Checkout" back="/cart" />
      <form onSubmit={place} className="space-y-5 px-5 py-5">
        <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-2">
              {count} {count === 1 ? 'piece' : 'pieces'}
            </span>
            <span className="text-xl font-extrabold tabular-nums text-ink">{rupee(total)}</span>
          </div>
          {hasAsk && (
            <p className="mt-1 text-sm text-ink-3">
              Partial — some lines have no rate yet.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" value={form.name} required
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 className="h-11" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop">Shop or firm</Label>
          <Input id="shop" value={form.shop} required
                 onChange={(e) => setForm({ ...form, shop: e.target.value })}
                 className="h-11" />
          {/* Ordering for a branch under a different name is normal, so the
              typed name goes on the order rather than being overwritten. */}
          <p className="text-sm text-ink-3">
            Change this if the order is for a different branch.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Contact number</Label>
          <Input id="phone" type="tel" inputMode="numeric" value={form.phone} required
                 onChange={(e) => setForm({ ...form, phone: e.target.value })}
                 className="h-11" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Anything to add (optional)</Label>
          <Textarea id="note" rows={3} value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Delivery instructions, a size to confirm, when you need it" />
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <Button type="submit" size="lg" block disabled={!ready || busy}>
          {busy ? 'Placing…' : 'Place this order'}
        </Button>
      </form>
    </main>
  );
}
