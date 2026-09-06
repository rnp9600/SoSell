/** The `—` rule, and the Indian grouping.
 *
 *  Run: node tests/money.test.mjs
 *
 *  The span() cases are a regression test. Converting to Number before
 *  dropping nulls turned "no printed MRP" into ₹0, and it reached a rendered
 *  page before it was caught.
 */
import assert from 'node:assert/strict';
import { rupee, span, rupeeSpan, suggestChip } from '../lib/money.js';

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
};

console.log('a missing rate is never a number');
it('null is —',                () => assert.equal(rupee(null), '—'));
it('undefined is —',           () => assert.equal(rupee(undefined), '—'));
it('empty string is —',        () => assert.equal(rupee(''), '—'));
it('NaN is —',                 () => assert.equal(rupee(NaN), '—'));
it('span of all nulls is null',() => assert.equal(span([null, null]), null));
it('span drops nulls, keeps real values', () => {
  assert.deepEqual(span([null, 500, undefined]), { lo: 500, hi: 500, one: true });
});
it('span treats 0 as missing, not free', () => {
  // Number(null) === 0 and Number('') === 0, so a 0 here means absent data.
  assert.equal(span([0, null]), null);
  assert.equal(span([0, 250]).lo, 250);
});
it('rupeeSpan of nothing is —', () => assert.equal(rupeeSpan(null), '—'));

console.log('Indian grouping');
it('lakh grouping',    () => assert.equal(rupee(100000), '₹1,00,000'));
it('ten lakh',         () => assert.equal(rupee(1234567), '₹12,34,567'));
it('under a thousand', () => assert.equal(rupee(625), '₹625'));
it('rounds to whole rupees', () => assert.equal(rupee(624.6), '₹625'));
it('a range reads as a range', () => {
  assert.equal(rupeeSpan({ lo: 625, hi: 1200, one: false }), '₹625–1,200');
});

console.log('payment chips');
it('rounds to 2,500 under a lakh', () => assert.equal(suggestChip(83412, 10) % 2500, 0));
it('rounds to 5,000 over a lakh',  () => assert.equal(suggestChip(340000, 10) % 5000, 0));
it('never suggests more than nothing on a zero balance', () => {
  assert.equal(suggestChip(0, 10), 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
