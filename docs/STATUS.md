# Where things stand

Last updated **2026-09-06**. Read `PLAN.md` first if you have not — this file
assumes it. Phases 0 and 1 are done; **Phase 2 is next.**

---

## Done

### Phase 0 — record what exists

The live `catalog` schema is dumped and committed at
`supabase/00_live_schema_2026-09-05.sql`: **19 tables, 32 functions, 10 views,
39 RLS policies**, plus grants, verified column-by-column against
`information_schema`.

This mattered more than it looks. The policies *are* the access control, and
there was no copy of them outside the Supabase project — losing the project
would have meant reconstructing the security model by inference. The table DDL
in that file is hand-written rather than generated, because a generated
`create table` carries no comments and the comments are half the value;
`supabase/SCHEMA.md` carries the query that checks it still matches.

`lib/catalogue/fallback.json` is a snapshot of the published `data.json` — 743
products, 127 with no rate on file, 5 hidden.

The `send-sms` edge function came across unchanged.

**The image bucket was filled** on 2026-09-06 and now holds 1,808 objects — 904
photos and 904 thumbnails, byte-for-byte identical filenames to the catalog
repo. It had been carrying 897 photos and zero thumbnails; the sync Action
existed but had never run, because its `SUPABASE_SERVICE_KEY` secret was unset
and it warned and skipped exactly as designed. `NEXT_PUBLIC_IMAGE_SOURCE` now
defaults to `bucket`.

### Phase 1 — shell and identity

- **Next 15 App Router**, JS not TypeScript, the 48 shadcn components carried
  over. `mongodb`, `bcryptjs`, `jsonwebtoken` and `axios` are gone — the whole
  Node backend goes, because nothing in it is portable except the arithmetic
  and that belongs in SQL.
- **Cookie sessions** (`@supabase/ssr`). This is the one structural change from
  the catalogue and it is what made moving to Next worth doing: the session
  lived in `localStorage`, which a server component and middleware cannot see.
- **Three clients** — `lib/supabase/{server,browser,admin}.js` — all setting
  `db: { schema: 'catalog' }`, with `inPageLock` and `settle()` carried over.
- **`middleware.js`** refreshes the session and performs no authorisation.
- **`scripts/check-secrets.mjs`** (`yarn check:secrets`) fails the build if the
  service-role key appears outside its three allowed paths.
- **One design system.** The catalogue's eight palette blocks are in
  `app/globals.css` with the values converted hex→HSL *mechanically*, and
  shadcn's variables are derived from them in a single mapping block rather
  than given colours of their own — so all 48 components repaint correctly in
  all eight theme/mode combinations with zero per-theme overrides.
  `tailwind.config.js` exposes both vocabularies; `text-ink-2` and
  `text-muted-foreground` produce identical pixels.
- **`components/ui/button.jsx`** rewritten to four intents and three sizes.
  The six call sites in `calendar`, `carousel`, `pagination` and `alert-dialog`
  were updated to match.
- **The catalogue reads live** from `catalog.catalogue` with a five-minute
  revalidate and a `catalogue` cache tag, falling back to the file.
- **Screens**: `/signin` (phone → code, or PIN for test numbers) and a
  placeholder `/`.

**Verified**: `yarn build` passes, the server serves, `/signin` renders, and
the catalogue falls back correctly to 743 products.

---

## Two environment facts that will confuse you

**1. This sandbox cannot reach `*.supabase.co`.** A direct REST call returns
HTTP 000 — the connection never opens. So a local run *always* takes the
fallback path and reports "database unreachable", and that is correct
behaviour, not a bug. **The live read can only be confirmed from a deploy.**
The Supabase MCP tools reach the project by another route and do work — that is
how the schema was dumped and the bucket verified.

**2. Everything is in the `catalog` schema, not `public`.** Every client must
set `db: { schema: 'catalog' }`, and PostgREST must keep `catalog` in its
`db-schemas`. A dashboard API-settings change can silently drop it and bring
back 404s on every call. `PGRST106` = schema not exposed; `PGRST205` = stale
table cache, needs `notify pgrst, 'reload schema'`.

---

## Next: Phase 2 — the shop, live from the database

Build these routes, in roughly this order. Everything reads
`getCatalogue()` from `lib/catalogue/index.js`; nothing needs new schema.

| Route | What it is |
|---|---|
| `app/(shop)/page.js` | home: search, notices, promo hero, categories, buy-again, featured, recently viewed |
| `app/(shop)/shop/page.js` · `shop/[cat]/page.js` | categories → sub-groups → grid, with sort |
| `app/(shop)/search/page.js` | typo-tolerant search, live suggestions, recent searches |
| `app/(shop)/product/[slug]/page.js` | swipe gallery, role-aware price, size rows with steppers, specs, ratings, share, related |
| `app/(shop)/saved/page.js` | per-account, on the phone, works offline |
| `app/(shop)/promo/[id]/page.js` | one config-driven strip |
| `app/p/[slug]/page.js` | the WhatsApp preview URL — **address preserved exactly** |

### What to build first, and why

`components/pm/` is empty and Phase 2 cannot start without it. Build in this
order, because each depends on the last:

1. **`Price`** — renders the four shapes `priceView()` returns
   (`{locked,was}` · `{ask}` · `{now,was,tag}`). Get the `—` rule right here
   and it is right everywhere.
2. **`ProductCard`** — the one tile used in every view. Badge chips
   (Featured / Offer / Out of stock) go in a **row under the photo**, not
   overlaid. Action row is `margin-top:auto` so cards in a row line up.
3. **`Stepper`** — the only quantity control in the app; steps by MOQ.
4. **`Sheet`** — bottom sheet for decisions. A sheet is not a route.
5. **`TabBar`** and **`CartBar`** — the cart bar raises `--dock` so nothing
   lands under the tab bar.

### Search is not a `LIKE` query

Port it from `catalog/core.js` §4 — three layers, escalating **only** when a
literal match returns zero hits:

1. ~25 curated trade synonyms (`ss` → stainless steel, `kadai`, `appam`,
   `tadka`…).
2. A phonetic fold — `ph→f`, `sh→s`, `Xh→X`, `w→v`, `ee→i`, `oo→u`, doubled
   letters collapsed. **There is deliberately no `ch→c` rule**: it folds
   *copper* into *chopper* and "coper" then returns 33 choppers.
3. Bounded Damerau-Levenshtein, ranked rather than nearest-wins — the
   first-letter penalty is what makes "bottel" find *bottles* rather than
   *hotels*.

It **never corrects silently**: it says "Showing results for **tawa**" and
offers the literal search back. Zero-result searches are logged to
`catalog.events`, and that log is the input to "what should we stock".

### The one that is easy to get wrong

`app/p/[slug]/page.js` replaces the catalog repo's `api/p.js`. A Next server
component with `generateMetadata` emits real OG tags natively, so the whole
workaround disappears — but **its security rule comes with it: that page is
public and has no sign-in, so MRP only, never the dealer rate.** It once
printed the DP column, which meant forwarding a product to a customer forwarded
your buying price. Same rule for the WhatsApp text it composes.

### Do not ship a service worker yet

Not before Phase 3. A cache-first shell worker written for a no-build site is
actively wrong for Next, whose asset names are content-hashed. See risk 3 in
`PLAN.md`.

---

## How to run it

```bash
yarn install
cp .env.example .env.local     # fill in the anon key
yarn dev                       # localhost:3000
yarn build
yarn check:secrets
```

Locally the catalogue will always say "the published file (database
unreachable)" — see environment fact 1 above. To exercise the roles, set
`NEXT_PUBLIC_ENABLE_TEST_NUMBERS=1` and sign in with one of the five test
numbers, PIN `765432`:

| Number | Role |
|---|---|
| 9686754020 | admin |
| 9686754021 | office staff |
| 9686754022 | dealer (retail, Hubli) |
| 9686754023 | end customer, belongs to the test dealer |
| 9686754024 | end customer, no shop yet |

## What to check before calling any phase done

- **Roles**: walk every screen as all five test numbers. The same product must
  show a read-only view, a stepper, and a shop price respectively.
- **Access is the database, not the page**: for each new table, attempt a read
  and a write as the wrong role and confirm Postgres refuses — not that the UI
  hid the button.
- **On a phone, cold**: open a shared product link, press Back, and land on the
  catalogue rather than out of the browser. Product → product → cart → Back ×3
  retraces to home. Network off, and the catalogue still opens.
- **Never `₹0`, never `₹NaN`** for the 127 products with no rate.
- **The money** (from Phase 4): reproduce ₹125,000 opening + ₹25,000 invoice −
  ₹26,000 payments = ₹124,000, and confirm a PDC cheque is excluded until
  marked cleared and that a bounced one puts the money back.
