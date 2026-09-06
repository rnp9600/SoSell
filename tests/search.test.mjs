/** Search behaviour, against the real catalogue.
 *
 *  Run: node tests/search.test.mjs
 *
 *  These are not unit tests of an algorithm — they are the specific mistakes
 *  the search is meant to survive. Each one was a real query.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { search, softKey } from '../lib/search.js';

const P = JSON.parse(fs.readFileSync(new URL('../lib/catalogue/fallback.json', import.meta.url)));

let pass = 0, fail = 0;
const it = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; }
};

console.log('the phonetic fold');
it('tawaa, tava and tawa collapse together', () => {
  assert.equal(softKey('tawaa'), softKey('tava'));
  assert.equal(softKey('tava'), softKey('tawa'));
});
it('kadhai folds to kadai', () => assert.equal(softKey('kadhai'), softKey('kadai')));
it('copper does NOT fold into chopper', () => {
  // The reason there is no ch->c rule. With one, "coper" returns 33 choppers.
  assert.notEqual(softKey('copper'), softKey('chopper'));
});

console.log('search');
it('a literal hit is not rescued', () => {
  const r = search('tawa', P);
  assert.ok(r.hits.length > 0);
  assert.equal(r.note, null);
});
it('a typo is rescued, and says so', () => {
  const r = search('tawaa', P);
  assert.ok(r.hits.length > 0);
  assert.ok(r.note, 'should report the respelling rather than correcting silently');
  assert.equal(r.note.typed, 'tawaa');
});
it('bottel finds bottles, not hotels', () => {
  // The first-letter penalty in bestWord() is the whole reason this works.
  const r = search('bottel', P);
  assert.ok(r.note && /bottle/.test(r.note.shown), `got "${r.note?.shown}"`);
});
it('exact:true skips the rescue', () => {
  const r = search('tawaa', P, { exact: true });
  assert.equal(r.hits.length, 0);
  assert.equal(r.note, null);
});
it('nonsense returns nothing rather than guessing', () => {
  assert.equal(search('zzqqxx', P).hits.length, 0);
});
it('a trade abbreviation resolves', () => {
  assert.ok(search('ss', P).hits.length > 0, 'ss should reach stainless steel');
});
it('a regional name resolves', () => {
  assert.ok(search('kadai', P).hits.length > 0, 'kadai should reach vadachatti');
});
it('a two-letter token matches on a word boundary', () => {
  // Without the boundary rule "dh" hits every kadhai and the result is noise.
  const r = search('dh', P);
  assert.ok(r.hits.length < P.length);
});
it('an empty query is everything', () => {
  assert.equal(search('', P).hits.length, P.length);
});

console.log('speed');
it('a literal search stays under 5ms', () => {
  const t = Date.now();
  for (let i = 0; i < 20; i++) search('tawa', P);
  const ms = (Date.now() - t) / 20;
  assert.ok(ms < 5, `${ms.toFixed(2)}ms`);
});
it('a rescued search stays under 25ms', () => {
  const t = Date.now();
  for (let i = 0; i < 20; i++) search('tawaa', P);
  const ms = (Date.now() - t) / 20;
  assert.ok(ms < 25, `${ms.toFixed(2)}ms`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
