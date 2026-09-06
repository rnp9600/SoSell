'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { KEYS, read, write } from '@/lib/storage';
import { sizesOf, moqFor } from '@/lib/catalogue/price';

/** The order in progress.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  A LINE IS {slug, size, qty} AND NOTHING ELSE.
 *
 *  Not the name, not the price, not the unit. Those are re-resolved at render
 *  by resolveLine() against the current catalogue. Three things fall out of
 *  that shape for free, and would each need special-casing without it:
 *
 *    · a repeat order prices at TODAY's rates, not the rates it was placed at;
 *    · a product whose rate changed does not carry a stale price into a new
 *      order;
 *    · a product or size that has been withdrawn resolves to null, and the
 *      screen can say "2 lines dropped" instead of ordering something that no
 *      longer exists.
 *
 *  Stored under V3's key, because dealers have half-filled baskets under it
 *  right now. See lib/storage.js.
 *  ─────────────────────────────────────────────────────────────────────────
 */

const CartContext = createContext(null);

export function CartProvider({ children, products = [] }) {
  const [lines, setLines] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Read after mount, never during render: the server has no localStorage and
  // reading it during render is a hydration mismatch waiting to happen.
  useEffect(() => {
    const raw = read(KEYS.cart, []);
    setLines(Array.isArray(raw) ? raw.filter((l) => l && l.slug && l.qty > 0) : []);
    setLoaded(true);
  }, []);

  const persist = useCallback((next) => {
    setLines(next);
    write(KEYS.cart, next);
  }, []);

  const bySlug = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.slug, p);
    return m;
  }, [products]);

  const qtyFor = useCallback(
    (slug, size) => lines.find((l) => l.slug === slug && l.size === size)?.qty || 0,
    [lines],
  );

  /** Quantities step by the minimum order quantity. Typing 7 where the MOQ is
   *  6 gives 6, not 7 — the supplier will not send 7. */
  const setQty = useCallback(
    (slug, size, qty) => {
      const p = bySlug.get(slug);
      const step = p ? moqFor(p, size) : 1;
      let n = Number(qty) || 0;
      if (step > 1 && n > 0) n = Math.max(step, Math.round(n / step) * step);

      const next = lines.filter((l) => !(l.slug === slug && l.size === size));
      if (n > 0) next.push({ slug, size, qty: n });
      persist(next);
    },
    [lines, bySlug, persist],
  );

  const add = useCallback(
    (slug, size) => {
      const p = bySlug.get(slug);
      setQty(slug, size, qtyFor(slug, size) + (p ? moqFor(p, size) : 1));
    },
    [bySlug, qtyFor, setQty],
  );

  const clear = useCallback(() => persist([]), [persist]);

  /** Resolve a stored line against the catalogue as it is NOW. Returns null
   *  when the product or the size has gone, so the caller can count them. */
  const resolveLine = useCallback(
    (l) => {
      const p = bySlug.get(l.slug);
      if (!p) return null;
      const row = sizesOf(p).find((s) => s.size === l.size);
      if (!row) return null;
      return {
        slug: p.slug,
        name: p.name,
        brand: p.brand,
        code: p.code,
        img: p.img,
        size: row.size,
        unit: row.unit,
        price: row.price,
        mrp: row.mrp,
        moq: row.moq,
        qty: l.qty,
        // A product with no rate on file still goes on the order — with the
        // rate left open, and the message says so.
        ask: row.price == null,
      };
    },
    [bySlug],
  );

  const items = useMemo(
    () => lines.map(resolveLine).filter(Boolean),
    [lines, resolveLine],
  );

  const dropped = lines.length - items.length;
  const count = items.reduce((n, i) => n + i.qty, 0);
  const total = items.reduce((s, i) => s + (i.price != null ? i.price * i.qty : 0), 0);
  const hasAsk = items.some((i) => i.ask);

  const value = useMemo(
    () => ({ lines, items, dropped, count, total, hasAsk, loaded,
             qtyFor, setQty, add, clear }),
    [lines, items, dropped, count, total, hasAsk, loaded, qtyFor, setQty, add, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
