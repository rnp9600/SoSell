/** Search, ported from the catalogue's core.js §4.
 *
 *  Three layers, and the two expensive ones run ONLY when a literal match
 *  would come back empty. Measured on the real catalogue: 0.29 ms for a
 *  working search, 3 ms for a rescued one, and 8.5 ms once to build the index
 *  — which is lazy, so a reader who never searches never pays it.
 *
 *  It never corrects silently. A rescued search returns a `note`, so the
 *  screen can say "Showing results for **tawa**" and offer the literal search
 *  back. Guessing quietly at what someone meant is how you lose their trust in
 *  the results.
 *
 *  Zero-result searches are the most useful thing this business can know: each
 *  is a product a dealer wanted that we either do not stock, or stock under a
 *  name nobody types. Callers should log them to catalog.events.
 */

/** Trade abbreviations and Indian-English names for the same object. Hand
 *  curated — every entry is a search somebody actually typed. */
const SYN = {
  wh: ['white'], bk: ['black'], ss: ['stainless steel'], rd: ['round'], sq: ['square'],
  sp: ['salt pepper', 'salt & pepper'], pm: ['potato masher'], fp: ['frying pan'],
  ltr: ['litre'], pcs: ['pieces'], pc: ['piece'], cera: ['cera', 'ceramic'],
  tadka: ['ogarala', 'vagaria', 'tadka'],
  kiwi: ['addakal'], 'kiwi tawa': ['addakal'], addakal: ['kiwi tawa'],
  adakal: ['addakal', 'kiwi tawa'],
  appam: ['paniyarakal', 'appakal'], paniyarakal: ['appam'],
  paniyaram: ['paniyarakal', 'appam'],
  appacity: ['appakal'], appakal: ['appacity', 'appam'],
  dh: ['double handle'], kadhai: ['vadachatti'], kadai: ['vadachatti', 'kadai'],
  vadachatti: ['kadhai', 'kadai'], kuzhi: ['bump base', 'kuzhi'],
  uttapam: ['uttapakal'], uttapakal: ['uttapam'], soppu: ['miniature toys'],
};

/** Everything about a product, lowercased, memoised on the product itself. */
const HAY = new WeakMap();
function hay(p) {
  const cached = HAY.get(p);
  if (cached) return cached;
  const sizes = (p.variants || []).map((x) => x.size).join(' ');
  const h = [
    p.name, p.brand, p.cat, p.sub, p.desc, p.spec, p.code, p.alias,
    sizes, (p.sizes || []).join(' '),
    p.hotel ? `${p.hotel.pits} pits ${p.hotel.base} ${p.hotel.dia} ${p.hotel.kg}` : '',
  ].filter(Boolean).join(' ').toLowerCase();
  HAY.set(p, h);
  return h;
}

/** The phonetic fold. "tawaa", "tava" and "tawa" all reduce to the same key.
 *
 *  ⚠ THERE IS DELIBERATELY NO `ch -> c` RULE. It folds *copper* into
 *  *chopper*, and "coper" then returns 33 choppers. Do not add it. */
export function softKey(w) {
  let s = String(w).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s) return '';
  s = s.replace(/ph/g, 'f').replace(/sh/g, 's');   // phulka  -> fulka
  s = s.replace(/([bdgjkpt])h/g, '$1');            // kadhai  -> kadai
  s = s.replace(/w/g, 'v');                        // tawa    -> tava
  s = s.replace(/ee/g, 'i').replace(/oo/g, 'u');   // steel   -> stil
  s = s.replace(/(.)\1+/g, '$1');                  // tawaa   -> tawa
  return s;
}

/** Damerau-Levenshtein, bounded — gives up as soon as every path exceeds max,
 *  which is what keeps a whole-vocabulary walk under a few milliseconds. */
export function editDist(a, b, max) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let cur = new Array(lb + 1);
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let best = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // A transposition costs 1, not 2 — "tawa"/"tawa" typos are usually this.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prev[j - 1]);
      }
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return prev[lb];
}

/** Map<softKey, Map<word, frequency>> over the catalogue's own vocabulary.
 *  Built lazily and cached against the product list it was built from, so a
 *  catalogue revalidation rebuilds it and nothing else does. */
let IDX = null;
let IDX_FOR = null;

function searchIndex(products) {
  if (IDX && IDX_FOR === products) return IDX;
  const idx = new Map();
  const add = (w, n) => {
    if (w.length < 3) return;
    const k = softKey(w);
    if (!k) return;
    if (!idx.has(k)) idx.set(k, new Map());
    const m = idx.get(k);
    m.set(w, (m.get(w) || 0) + (n || 1));
  };

  for (const p of products) {
    [p.name, p.brand, p.cat, p.sub, p.alias, p.desc]
      .filter(Boolean).join(' ').toLowerCase()
      .split(/[^a-z0-9]+/).forEach((w) => add(w, 1));
  }

  // The synonym table is vocabulary too: "vadachatti" should be reachable from
  // a misspelling even though no product name contains it.
  for (const key of Object.keys(SYN)) {
    for (const w of SYN[key].concat([key])) {
      String(w).toLowerCase().split(/[^a-z0-9]+/).forEach((t) => {
        if (t.length < 3) return;
        const k = softKey(t);
        if (!k) return;
        if (!idx.has(k)) idx.set(k, new Map());
        const m = idx.get(k);
        if (!m.has(t)) m.set(t, 1);
      });
    }
  }

  IDX = idx;
  IDX_FOR = products;
  return idx;
}

const commonest = (m) => {
  let top = null, f = 0;
  m.forEach((n, w) => { if (n > f) { top = w; f = n; } });
  return { word: top, freq: f };
};

// A short word has no room to be wrong in an interesting way.
const distAllowed = (k) => (k.length <= 3 ? 0 : k.length <= 5 ? 1 : 2);

function bestWord(word, products) {
  const idx = searchIndex(products);
  const k = softKey(word);
  if (!k) return null;
  if (idx.has(k)) return commonest(idx.get(k)).word;

  const max = distAllowed(k);
  if (!max) return null;

  let best = null;
  let bestScore = Infinity;
  idx.forEach((words, key) => {
    const d = editDist(k, key, max);
    if (d > max) return;
    const c = commonest(words);
    // Ranked, not nearest-wins. A wrong FIRST letter is a much weaker guess
    // than a middle transposition — without that penalty "bottel" corrects to
    // "hotel" rather than "bottles".
    const score =
      d * 100 +
      (key[0] === k[0] ? 0 : 40) +
      Math.abs(key.length - k.length) * 3 -
      Math.min(c.freq, 9);
    if (score < bestScore) { bestScore = score; best = c.word; }
  });
  return best;
}

function rewriteQuery(ql, products) {
  const parts = String(ql || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  let changed = false;
  const out = parts.map((w) => {
    if (SYN[w]) return w;               // a known abbreviation is not a typo
    const b = bestWord(w, products);
    if (b && b !== w) { changed = true; return b; }
    return w;
  });
  return changed ? out.join(' ') : null;
}

export function matches(p, q) {
  if (!q) return true;
  const h = hay(p);
  const ql = String(q).toLowerCase().trim();

  // One- and two-letter tokens match on a word boundary, or "dh" hits every
  // kadhai and the result is noise.
  const has = (t) =>
    t.length <= 2
      ? new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(h)
      : h.includes(t);

  const hit = (t) => has(t) || (SYN[t] || []).some(has);

  if (SYN[ql] && SYN[ql].some(has)) return true;
  return ql.split(/\s+/).filter(Boolean).every(hit);
}

/** One search, one answer.
 *
 *  Returns { q, hits, note }. `note` is set only when the query was quietly
 *  respelt — `{ shown, typed }` — so the screen can say so and offer the
 *  literal search back. `exact: true` skips the rescue entirely, which is what
 *  that offer links to.
 */
export function search(q, products, { exact = false } = {}) {
  const list = products || [];
  const raw = String(q || '').trim();
  if (!raw) return { q: raw, hits: list, note: null };

  const hits = list.filter((p) => matches(p, raw));
  if (hits.length || exact) return { q: raw, hits, note: null };

  const fixed = rewriteQuery(raw, list);
  if (fixed) {
    const second = list.filter((p) => matches(p, fixed));
    if (second.length) {
      return { q: fixed, hits: second, note: { shown: fixed, typed: raw } };
    }
  }
  return { q: raw, hits: [], note: null };
}

/** Live suggestions while typing — product names and groups, not results. */
export function suggest(q, products, limit = 8) {
  const raw = String(q || '').toLowerCase().trim();
  if (raw.length < 2) return [];
  const seen = new Set();
  const out = [];
  for (const p of products) {
    for (const cand of [p.name, p.sub, p.brand].filter(Boolean)) {
      const key = cand.toLowerCase();
      if (seen.has(key) || !key.includes(raw)) continue;
      seen.add(key);
      out.push(cand);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
