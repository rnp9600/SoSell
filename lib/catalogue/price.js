import { span, rupeeSpan, rupee } from '@/lib/money';

/** Prices, sizes, and who is allowed to see which.
 *
 *  Ported from the catalogue's core.js. Two rules here are load-bearing and
 *  were each learned the hard way:
 *
 *  1. THE ROLE DECIDES THE PRICE, AND THE ROLE COMES FROM THE DATABASE.
 *     Never from a number typed into the page. A dealer sees trade rates and a
 *     stepper; a consumer sees their shop's offer or the printed MRP; the
 *     office sees neither, because an order they placed would be addressed to
 *     themselves.
 *
 *  2. A MISSING RATE IS `—`. Never ₹0, never ₹NaN. 127 products have no rate
 *     on file. Each is a question a dealer wants to ask, so it goes on the
 *     order with the rate left open and the message says so.
 *
 *  And one that is not about money: MRP is a PRINTED price. If the supplier
 *  did not give one, we do not show one. An earlier build estimated MRP at
 *  2.25x the dealer rate and struck it through, which put an invented number
 *  in a customer's hands.
 */

const rows = (p) => (p?.variants && p.variants.length ? p.variants : null);

export const dealerPrice = (p) => span(rows(p) ? rows(p).map((v) => v.price) : [p?.price]);
export const printedMrp = (p) => span(rows(p) ? rows(p).map((v) => v.mrp) : [p?.mrp]);

/** Collapses three product shapes into one, so nothing downstream branches:
 *    1. real variant rows
 *    2. a plain text size list, each row borrowing the product's own price
 *    3. neither — one synthetic "Standard" row
 */
export function sizesOf(p) {
  if (!p) return [];
  const vs = rows(p);
  if (vs) {
    return vs.map((v) => ({
      size: v.size,
      price: v.price ?? null,
      mrp: v.mrp ?? null,
      unit: v.unit || p.unit || 'Piece',
      moq: v.moq > 0 ? v.moq : 1,
    }));
  }
  if (Array.isArray(p.sizes) && p.sizes.length) {
    return p.sizes.map((s) => ({
      size: s,
      price: p.price ?? null,
      mrp: p.mrp ?? null,
      unit: p.unit || 'Piece',
      moq: p.moq > 0 ? p.moq : 1,
    }));
  }
  return [
    {
      size: 'Standard',
      price: p.price ?? null,
      mrp: p.mrp ?? null,
      unit: p.unit || 'Piece',
      moq: p.moq > 0 ? p.moq : 1,
    },
  ];
}

export const moqFor = (p, size) =>
  sizesOf(p).find((s) => s.size === size)?.moq || 1;

/** A dealer sets a PERCENTAGE off MRP, not a price of their own, so two shops
 *  can never advertise different prices for the same named product. */
export function offerPrice(offer, mrpValue) {
  if (!offer) return null;
  if (offer.discount_pct != null && mrpValue != null) {
    return Math.round(mrpValue * (1 - offer.discount_pct / 100));
  }
  return offer.price_offer != null ? offer.price_offer : null; // legacy column
}

/** THE single place a price is decided. Returns exactly one of four shapes;
 *  callers switch on which key is present.
 *
 *    { locked, was }     signed out — there is a price, but not for you yet
 *    { ask }             no rate on file, or a consumer with no offer
 *    { now, was, tag }   an actual price to show
 */
export function priceView(p, { role = 'guest', offer = null } = {}) {
  const dp = dealerPrice(p);
  const mrp = printedMrp(p);

  if (role === 'end_customer') {
    const off = offerPrice(offer, mrp ? mrp.lo : null);
    if (off != null) {
      return { now: rupee(off), was: mrp ? rupeeSpan(mrp) : null, tag: 'Shop offer' };
    }
    if (mrp) return { now: rupeeSpan(mrp), was: null, tag: 'MRP' };
    return { ask: 'Ask the shop' };
  }

  if (role === 'guest') return { locked: true, was: mrp ? rupeeSpan(mrp) : null };
  if (!dp) return { ask: 'Rate on request' };

  return {
    now: rupeeSpan(dp),
    // Only strike through an MRP that is genuinely higher than what they pay.
    was: mrp && mrp.lo > dp.lo ? rupeeSpan(mrp) : null,
    tag: null,
  };
}
