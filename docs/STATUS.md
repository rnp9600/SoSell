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

## Also done

### Phase 2 and 3 — the shop

Fifteen customer-facing routes: home, shop, category, search, product, saved,
cart, checkout, confirmation, orders, order detail, repeat, account, settings,
help, join, and `/p/[slug]` — the WhatsApp share link, at the same address it
has always had.

**Search is a real port**, in `lib/search.js`: three layers that escalate only
when a literal match returns nothing. `tests/search.test.mjs` pins the
behaviours against the real 743 products, including the two that look like
quirks and are not — there is no `ch → c` fold (it turns *copper* into
*chopper*), and the first-letter penalty is what makes "bottel" find *bottles*
rather than *hotels*.

`api/p.js` is gone; a server component with `generateMetadata` emits the OG
tags natively. **Its security rule came with it and is written at the top of
the file: that page is public, so MRP only, never the dealer rate.**

### Phase 4 and 5 — the ledger

Four migrations, applied and verified (see `supabase/SCHEMA.md`). Both bugs
fixed rather than ported — FIFO aging, and one source of truth for a cheque.

Dealer screens: `/account/ledger`, `/bills`, `/cheques`.
Office screens: dashboard, customers, customer detail with a payment pad,
routes, the day sheet, cheques to bank, and one approvals queue.

Every figure comes from a view. No screen does arithmetic.

### Phase 7 — tasks and messages

`catalog.tasks` (a schedule is the shape of the week; a task is what came up),
the office task board, and a notification composer that can address named
people, a role, a department, a route's shops, or everyone — with the reach
shown *before* sending.

**The reminder ladder is built**, in `app/api/cron/reminders`. The prototype
had eighteen editable templates and no scheduler and no code that read one;
`catalog.render_template()` and this cron are what finally make them do
something. `reminder_log` is keyed on (customer, rung, financial year), so a
200-day customer is told once per rung rather than every morning, and only the
*highest* rung crossed is sent so nobody gets six messages on the first run.

Web push: `push_subscriptions`, `push_outbox`, and a drain route. The
permission is asked **on the notifications screen, never on load** — a prompt
that appears the moment somebody opens a shop is the fastest way to be denied
permanently, and a denial is final.

---

## Three bugs found by running it, not reading it

1. **`span()` printed `₹0`.** It converted to `Number` before dropping nulls,
   and `Number(null)` is `0`, which passes `isFinite`. So "this product has no
   printed MRP" rendered as "MRP ₹0" — the exact failure the `—` rule exists to
   prevent, on a product sheet. `tests/money.test.mjs` pins it.
2. **`/v4/` was redirecting.** Next normalises a trailing slash with a 308
   *before* rewrites run. An installed icon pinned to that scope degrades to a
   browser tab the moment it redirects. `skipTrailingSlashRedirect` fixes it.
3. **The image fallback did not work before hydration.** React's `onError`
   only fires once the handler is attached, and on a slow connection the image
   has already failed by then — leaving the browser's broken-image glyph. Fixed
   with a capture-phase listener installed before first paint (`IMG_FALLBACK`
   in `lib/theme.js`); the React handler stays as the post-hydration half.

## What is left

| | |
|---|---|
| **Office catalogue tools** | Port `admin.html`, `orders.html`, `exchange.html` — products, rates, taxonomy, noticeboard, reviews, the order book, the stock exchange. `/office/catalogue` is linked from the dashboard and not yet built. |
| **The Excel import** | `import_customers(rows, dry)` — the riskiest data step, because it merges the office's real ledger into the existing `allowlist` rows on phone. **Dry run, eyeball the diff, then run it.** |
| **Seed the receipt counter** | Going live mid-year means setting `voucher_sequence` from the last number the office actually issued, or the app starts at `Mob/1` beside a paper book at `Mob/812`. A human should read the number aloud. |
| **The four `v3`-only features** | Writing a review, editing your own profile and photo, the consumer shop directory, and retail mode. See `PLAN.md`. |
| **`aging_days_legacy`** | Ship the old and new aging side by side for a week with a one-screen explanation, so the office can see *why* loyal customers moved from Critical to On Track and say whether they agree. |
| **Deploy** | Blocked on one permission. Vercel's GitHub App cannot see `rnp9600/SoSell` — the repo is private and has not been shared with it. Grant it at **vercel.com → Settings → Git → GitHub → Configure**, add SoSell to the allowed repositories, then the project links and deploys from `claude/repo-chandler-integration-7whgjj` (which is this repo's default branch, so no merge is needed). The Supabase URL and publishable key have defaults, so no environment variable is required for a first deploy. |

## Before the cutover

**The session shim is built** (`components/pm/session-shim.jsx`, mounted in the
root layout). It reads `v3_sb_auth` once, hands it to `setSession()` so the
cookie is written, and removes the key. Without it every dealer would be
signed out the morning the domain moves — and signing back in costs a real SMS
each.

`tests/cutover.test.mjs` asserts the code is in place, that V3's localStorage
keys have not been renamed, that `/v4/` is a rewrite rather than a redirect,
and that the service worker caches nothing. **Two things it cannot check, and
which matter most:**

1. **Fill a basket on the live catalogue, deploy SoSell to the same hostname,
   reload.** Basket intact, still signed in. Skip this and you find out from
   the dealers.
2. **Seed `catalog.voucher_sequence`** from the last receipt number the office
   actually issued, or the app starts at `Mob/1` beside a paper book at
   `Mob/812`. A human should read the number aloud.

---

## How to run it

```bash
yarn install
cp .env.example .env.local     # fill in the anon key
yarn dev                       # localhost:3000
yarn build
yarn check:secrets             # where the service-role key may appear
node tests/search.test.mjs     # 14 checks
node tests/money.test.mjs      # 16 checks
node tests/visual.mjs          # a real browser, all 8 themes
```

Locally the catalogue always says "the published file (database unreachable)" —
see environment fact 1. To walk the roles, set
`NEXT_PUBLIC_ENABLE_TEST_NUMBERS=1` and sign in with one of the five test
numbers, PIN `765432`:

| Number | Role |
|---|---|
| 9686754020 | admin |
| 9686754021 | office staff |
| 9686754022 | dealer (retail, Hubli) |
| 9686754023 | end customer, belongs to the test dealer |
| 9686754024 | end customer, no shop yet |

## What to check before calling anything done

- **Roles**: walk every screen as all five test numbers. The same product must
  show a read-only view, a stepper, and a shop price respectively.
- **Access is the database, not the page**: attempt a read and a write as the
  wrong role and confirm *Postgres* refuses — not that the UI hid the button.
  A dealer must not see another dealer's ledger; a collector must lose access
  the moment they come off the route. Both were verified when the migrations
  were applied; re-check after any policy change.
- **On a phone, cold**: open a shared product link, press Back, land on the
  catalogue rather than out of the browser. Network off, and the catalogue
  still opens.
- **Never `₹0`, never `₹NaN`** for the 127 products with no rate.
