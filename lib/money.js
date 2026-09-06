/** Rupees, and the rules about showing them.
 *
 *  Two things here are not style preferences:
 *
 *  1. Indian grouping. ₹1,00,000 — not ₹100,000. Intl handles it, but the
 *     hand-rolled path is kept as the fallback because it is three lines and
 *     removes a dependency on locale data being present.
 *
 *  2. A missing rate is `—`. Never ₹0, never ₹NaN. 127 products have no rate
 *     on file; each one is a question a dealer wants to ask, so it goes on the
 *     order with the rate left open and the message says so. Printing ₹0 there
 *     tells a customer something untrue about the price.
 */

/** ₹1,00,000. Rounds to whole rupees — paise never appear in this business. */
export function rupee(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return '—';
  try {
    return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  } catch {
    const neg = v < 0;
    const s = String(Math.abs(v));
    if (s.length <= 3) return (neg ? '-₹' : '₹') + s;
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return (neg ? '-₹' : '₹') + rest + ',' + last3;
  }
}

/** A price that may be a single value or a range across sizes.
 *
 *  ⚠ DROP null AND undefined BEFORE COERCING, not after. `Number(null)` is 0
 *  and `Number('')` is 0, and both pass `Number.isFinite` — so converting
 *  first turns "this product has no printed MRP" into "this product costs
 *  nothing", and the screen prints ₹0 about a price we simply do not have.
 *  That is exactly the failure the `—` rule exists to prevent, and it shipped
 *  once here before this comment did.
 *
 *  A non-positive price is treated the same way: there is no such thing as a
 *  ₹0 product, so a 0 in the data is missing data, not a free one.
 */
export function span(values) {
  const nums = (values || [])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0);
  if (!nums.length) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return { lo, hi, one: lo === hi };
}

export function rupeeSpan(s) {
  if (!s) return '—';
  return s.one ? rupee(s.lo) : `${rupee(s.lo)}–${rupee(s.hi).replace('₹', '')}`;
}

/** Payment shortcuts on the collection screen. A collector standing in a shop
 *  wants a round number to suggest, not 7.5% of ₹83,412. Rounds to ₹2,500, or
 *  ₹5,000 once the outstanding is over a lakh. */
export function suggestChip(outstanding, pct) {
  const out = Number(outstanding) || 0;
  if (out <= 0) return 0;
  const base = out > 100000 ? 5000 : 2500;
  const raw = (out * pct) / 100;
  return Math.max(base, Math.round(raw / base) * base);
}

export const CHIPS = [
  { label: 'Suggested', pct: 7.5 },
  { label: 'Recommended', pct: 10 },
];
