# SoSell — the plan

The durable version: why this exists, what was decided and why, and the shape
of the work. For *where things stand right now*, read `STATUS.md` next door.

---

## Where this came from

Two half-products existed for the same business, and neither was whole.

**`rnp9600/catalog`** — live on Vercel, and the better-built of the two. A
vanilla HTML/JS/CSS PWA with no build step, ~372 KB across eight files, 743
products, 1,237 variants, 904 photos. It has real auth (Supabase phone OTP
delivered by a Fast2SMS edge function), a real Postgres schema where row-level
security *is* the access control, a hash router where every screen is an
address, four palettes × light/dark, an order book, and a signup-approval queue
whose approvers are rows in a table rather than branches in code. Its
`ARCHITECTURE.md` and `README.md` record why each rule exists — most written
after something broke in a customer's hands. **Worth reading before changing
anything here.**

**`rnp9600/chandler-app`** — never deployed. Next.js 15 + shadcn/ui + Tailwind,
MongoDB, the whole frontend in one 1,913-line file and the whole backend in one
1,170-line file behind an order-dependent `if` chain. Its auth returned the OTP
in the login response. But it was the only place the collection domain existed:
credit customers, areas, routes, day sheets, `Mob/N` receipts, PDC cheques,
aging, deposit slips, approvals, issues, a bin.

They already shared a database — the Supabase project is still *named*
"Chandler" in the dashboard — but it held only the catalogue tables. The
collection domain lived in Mongo, unshipped, seeded with demo data and nothing
else.

**Both repos stay as read-only references. Nothing is committed to either.**

## What SoSell is for

One app, two halves.

**For customers** — the catalogue and ordering, plus their own money: what they
owe and how overdue it is, every bill, every receipt, the orders currently in
process, and the cheques they have given that are coming up for clearance.

**For the office** — products and rates, collection routes and day sheets,
payment approvals, deposit slips, tasks assigned to teammates, and
notifications sent to whoever needs them.

## The decisions, and why

| | |
|---|---|
| **Shell** | Next.js 15 App Router, from chandler-app. The catalogue's screens get ported to React. Chosen for server rendering (product SEO), real push notifications, and an office panel that can grow without becoming another 73 KB HTML file. |
| **Database** | Supabase Postgres only. MongoDB dropped. **There was no data migration** — chandler-app's only rows came from a seeder that is deleted. Real ledger data comes from the office's Excel through an import with a dry run. |
| **Auth** | Supabase phone OTP only, moved to cookie sessions. chandler-app's stub auth is deleted, not ported. |
| **Identity** | The catalogue's `dealer` **is** chandler-app's "customer" — the shops sold to on credit are the ones the routes visit. One row per person in `catalog.allowlist`, keyed on the **12-character** phone (`91XXXXXXXXXX`) that `catalog.my_phone()` returns. `end_customer` keeps a read-only shop view, no ledger. |
| **Notifications** | In-app + web push, plus WhatsApp deep links. No SMS broadcast, no email. |
| **Naming** | **SoSell** is the software and the project. **Patel Marketing** is the firm, and stays the name on receipts, deposit slips, printed ledgers and the verification SMS — from `lib/config.js`, so an LLP/Pvt Ltd rename later is one line. "Chandler" appears nowhere. |
| **Catalogue data** | Read live from `catalog.catalogue`, so an office edit is on the site immediately and the publish step stops existing. `data.json` is demoted to `lib/catalogue/fallback.json` — a failure gives a slightly stale shop, never an empty one. |
| **Photos** | Served from the `catalog-images` Supabase bucket, not committed here. 36 MB in git is permanent — every clone, every build, forever, unremovable without rewriting history. |
| **Tasks** | Free-form — title, notes, assignee, due date, priority — optionally linked to a customer, order, route or invoice. |
| **Aging** | Fixed with FIFO allocation, so aging is the age of the oldest genuinely *unpaid* bill and "Critical" means something. |

## Facts verified against the live database

Not inferred from either repo — read directly from project `vcrzauuxvgpsbforiszz`:

- `catalog.my_phone()` is `replace(auth.jwt()->>'phone','+','')`, and every
  `allowlist.phone` is **12 characters**. Every new table keys on that same
  string — never 10 digits, never a UUID.
- More helpers already exist than the old docs mention: `my_phone`, `my_role`,
  `is_admin`, `is_dealer`, `can_trade`, `can_edit_catalogue`,
  `can_approve(kind)`, `can_approve_any`, `can_see_order(id)`,
  `my_dealer_phones()`, `my_owner_phone()`, `display_name`,
  `is_listed_dealer`. The ledger's rules should be two more in that same style.
- `http`, `pg_trgm`, `pgcrypto` are installed; `pg_cron`/`pg_net` are available
  but not. Use Vercel Cron for the reminder ladder — it lives in git and is
  reviewable.

---

## Rules the code keeps

Each of these is load-bearing. Changing one quietly breaks something a customer
sees.

**The database is the access control.** Authorisation is row-level security,
never a check in a component. A screen that renders empty for the wrong role is
the correct outcome. `middleware.js` refreshes the session and performs *no*
authorisation, deliberately — the rule would otherwise live in two places and
only the Postgres copy actually holds.

**The service-role key lives in three paths and nowhere else**:
`app/api/cron/**`, `app/api/push/send`, `scripts/**`. Everything else,
*including every office screen*, uses `lib/supabase/server.js`. The review
test: *would this code be wrong if RLS were enforced?* If yes, the code is
wrong, not RLS. `yarn check:secrets` enforces it.

**A screen is a route; a sheet is a decision.** If it has state worth going
Back to, it gets an address. Dismissing a sheet must not consume a Back press.

**One button.** Four intents, three sizes, a 44px floor. shadcn's `ghost`,
`outline`, `link`, `default` and `destructive` are deleted rather than aliased,
so a stray variant throws instead of rendering a fifth kind of button nobody
designed. V3 learned this the hard way: renaming one selector left its entire
checkout unstyled, which a customer reported as "so basic design".

**A missing rate is `—`.** Never `₹0`, never `₹NaN` — 127 products have no rate
on file. Each is a question a dealer wants to ask, so it goes on the order with
the rate left open and the message says so. **MRP is a printed price**: if the
supplier did not give one, we do not show one. An earlier build estimated MRP
at 2.25× the dealer rate and struck it through, putting an invented number in a
customer's hands.

**The role decides the price, and the role comes from the database.** Never
from a number typed into the page. `lib/catalogue/price.js` `priceView()` is
the single place a price is decided.

**The cart stores `{slug, size, qty}` and nothing else.** Name, price, unit and
MOQ are re-resolved at render, which is why a repeat order prices at today's
rates without special-casing. A line whose product or size has vanished
resolves to `null` and the screen reports "N lines dropped".

**localStorage keys say `v3` on purpose.** Dealers have half-filled baskets
under those exact names right now. `lib/storage.js` is the only file that names
one. Renaming a key does not migrate anything — it empties every basket at once.

**`/p/:slug` is public, so MRP only, never the dealer rate.** It once printed
the DP column, which meant forwarding a product to a customer forwarded your
buying price with it.

**Images are plain `<img>` with an `onerror` fallback, never `<picture>`** — a
404'd `<source>` does not fall back, which is how 900 broken thumbnails once
shipped.

**Never cache Supabase responses in the service worker.** That is an explicit
early return, not an omission.

## Traps already paid for once

`supabase-auth.js` in the catalog repo is 220 lines of scar tissue. All of it
is carried into `lib/supabase/`:

- **`db: { schema: 'catalog' }` on every client.** Everything is in `catalog`,
  not `public`. Without it, `from('allowlist')` silently queries
  `public.allowlist`; the symptom was a real admin being told "we do not
  recognise that number".
- **PostgREST must expose `catalog`**, and that takes *two* steps — add it to
  `db-schemas` **and** `notify pgrst, 'reload schema'`. `PGRST106` = not
  exposed; `PGRST205` = stale table cache.
- **`inPageLock` replacing `navigator.locks`.** A backgrounded tab holding the
  cross-tab web lock makes every auth call hang forever — no request, no error,
  a button stuck on "Sending…".
- **`settle()`**, a 30-second timeout, so a stalled SMS hook produces a
  sentence rather than a spinner.
- **Never `maybeSingle()` an unfiltered `allowlist` select.** Two SELECT
  policies exist; for an admin the unfiltered select returns every row and
  `maybeSingle()` rejects, read as "not on the list".
- **Distinguish a failed lookup from an absent row** — collapsing them let a
  404 masquerade as a rejected number for a whole round of testing.

---

## The schema still to build

Everything goes into the existing `catalog` schema — not a sibling, because the
identity table, the helper functions the policies lean on, and the whole
notification machine are already there. Migration files continue the numbering
from `07_`.

**Extend `allowlist`** rather than adding a customers table: `opening_balance`,
`opening_as_of`, `credit_limit`, `payment_terms`, `area_id`, `contact_person`,
`email`, `whatsapp`, `business_type`, `remarks`, `reminder_only`,
`reminder_schedule`, `last_cheque_bank`, `no_login`.

**The customer with no phone.** The office's ledger has them, and `allowlist`'s
primary key *is* the phone. Rule: a synthetic key `'00' || <10 digits>` with
`no_login = true`. Indian mobiles start 6–9, so it can never collide.

**New tables**: `areas`, `invoices`, `payments`, `adjustments` (credit and
discount notes were the same table twice — the old Node handler was literally a
loop over the two names), `voucher_sequence`, `deleted_vouchers`, `routes`,
`route_members` (a join table, not an array, so RLS can join and a shop can sit
on two routes), `staff_schedules`, `collections`, `collection_visits`,
`issues`, plus `tasks` / `task_comments` and the push tables.

**No `on delete cascade` on any reference to `allowlist`.** Deleting a customer
who has money against them must fail loudly; `admin_delete_customer` needs
updating to say so.

### The two bugs to fix, not carry over

**PDC.** The old code stored `is_pdc` on the payment *and* re-derived it live
from the cheque date, so the dashboard and the ledger told two different
stories the moment a date passed. Resolution: **a cheque clears because
somebody says it cleared, not because a date arrived.** `cheque_status`
(pending · cleared · bounced) is the only truth; `is_pdc` becomes a generated
column over it. Two RPCs — `clear_cheque`, `bounce_cheque` — and a "Cheques to
bank" screen. This also gives the business something it did not have: a bounced
cheque puts the money *back* on the ledger instead of silently staying paid.

**Aging.** A `break` in a loop meant only the earliest invoice *ever* was
considered, so aging ran from the oldest bill raised rather than the oldest
unpaid — a loyal customer who pays on time showed 900 days. Replace with FIFO
allocation as one window function: money clears the oldest bills first, and
aging is measured from the oldest bill it has not reached.

### Views and functions replace the Node arithmetic

`catalog.customer_balances` computes outstanding, PDC pending, aging days and
tier for **everyone in one query** — the old `GET /customers` ran four finds
per customer, which is fine at 15 and not at 1,500. Then
`catalog.customer_ledger`, and three views the dealer app reads and nothing
else: `my_balance`, `my_ledger`, `my_cheques`. That is the whole "my ledger, my
dues, my bills, my cheques coming up" feature on the read side — no client
arithmetic, and the printed statement and the screen read the same rows so they
cannot disagree.

`next_receipt_no(temp)` is one `insert … on conflict do update … returning` —
a single atomic statement holding a row lock, the same guarantee Mongo's `$inc`
gave. The key is `mob_<FY>`, so **April resets itself**; deleting never
decrements, so numbers are never reused.

Then, all `security definer`, all reading the caller from the JWT rather than
the payload: `record_payment`, `approve_payment`, `clear_cheque`,
`bounce_cheque`, `void_payment`, `upsert_adjustment`, `decide_adjustment`,
`upsert_invoice`, `start_collection`, `set_visit`, `end_collection`,
`request_reopen`, `approve_reopen`, `import_customers(rows, dry)`.

Two behaviours worth naming: `record_payment` **refuses if the caller cannot
collect from that customer**, so a dealer can never record their own payment;
and `upsert_invoice` enforces the rule the old code documented and never
checked — Busy-synced invoices are read-only.

### Access, stated plainly

Two functions carry the whole thing, in the style of `can_approve`:

- **`can_collect(phone)`** — that shop is on a route currently assigned to me.
- **`can_see_ledger(phone)`** — mine, or admin, or staff in
  `office_manager`/`accounts`, or `can_collect`.

So: a **dealer** matches only the first arm — their own ledger, nobody else's.
A **collection staff member** matches only `can_collect`, and **taking them off
the route takes the access with it**, with no second place to remember and no
code change. **Accounts and office_manager** see everyone, because that is a
`dept` value — data, exactly like `approve_dealer`. **Sales, purchase and
delivery see nobody's money at all**, which is the point of departments being
data rather than code.

---

## Features that live only in the archived `v3/`

The current live site is not the full feature set. These exist only in
`catalog/v3/index.html` and have to be rebuilt:

- **Writing a review.** `product_reviews` is wired and the admin panel
  moderates it, but V4 has no way to leave one.
- **Editing your own profile and photo** — `update_my_profile`, `set_my_photo`,
  the `avatars` bucket (which exists and is public, 2 MB limit).
- **The consumer shop directory** — `dealer_directory`,
  `self_signup_end_customer`, following a shop. The whole `end_customer`
  journey.
- **Retail mode** ("Showing to a customer"). The catalog README describes it as
  live; it is not. Prices switch to MRP with the dealer's own discount, nothing
  on screen says it is on, and the only way out is a press-and-hold on the
  badge.

## Documented but absent — new work, not a port

- The 18 notification templates are editable and nothing reads them when
  sending.
- No scheduler, so the `aging_30/60/75/90/120/180` and `daily_visit` reminder
  ladder never fires.
- `reminder_only` / `reminder_schedule` are captured on the customer form and
  never consumed.
- "Busy-synced invoices are read-only" is a documented rule that no code
  enforces.

## Deleted rather than ported

`POST /seed/init` (unauthenticated, created admins, hardcoded two real phone
numbers), the `dev_otp` field in the login response, the five demo phone
numbers printed on the login screen, sessions with no expiry, and the blind
`$set` on `PUT /customers/:id` and `PUT /routes/:id`. All gone by construction,
because the Node backend is gone.

The five PIN test accounts survive — they cost nothing and prove the roles end
to end — but the *list* sits behind `NEXT_PUBLIC_ENABLE_TEST_NUMBERS`, off in
production, so the sign-in screen no longer prints customer phone numbers.

---

## Phases

Each is independently shippable. The live site keeps working throughout; the
domain moves once, after Phase 3.

| | | |
|---|---|---|
| **0** | Record what exists | ✅ done |
| **1** | Shell and identity | ✅ done |
| **2** | The shop, live from the database | next |
| **3** | Cart, checkout, orders → **cutover** | |
| **4** | The ledger, read-only, for dealers | |
| **5** | The office ledger and collections | |
| **6** | Office catalogue tools | |
| **7** | Tasks, composer, push, reminders | |
| **8** | The `v3`-only features; retire `catalog` | |

Two orderings are deliberate and worth not reshuffling:

- **Identity came first**, because everything needs a session and a wrong
  session model is the one mistake that has to be undone in every screen.
- **The dealer ledger (4) comes before the office ledger (5)**, because a
  read-only ledger is safe to be wrong in public, and it is the fastest
  possible way to find out whether the imported opening balances are right —
  the dealers will say so within a day.

## Risks

1. **The schema dump going stale.** The policies *are* the access control.
   The commit that changes the database is the commit that updates
   `supabase/00_live_schema_*.sql`.
2. **Customers mid-order under V3 localStorage keys.** Needs a one-time session
   shim on first load: read `v3_sb_auth`, call `setSession()` so the cookie is
   written, then remove the key. **Without it, cutover day signs every dealer
   out.** Acceptance test: fill a basket on the live site, deploy SoSell to the
   same hostname, reload — basket intact, still signed in.
3. **The service worker.** A cache-first shell worker written for a no-build
   site is *actively wrong* for Next, whose asset names are content-hashed.
   Ship none before Phase 3. When you do: never touch `*.supabase.co`, never
   `skipWaiting()` on install, never cache an HTML document, and **sweep the
   `pm-v4-*` and `pm-v*` cache names** or the old shell survives the cutover on
   the same origin. **Never redirect `/v4/` — rewrite it**; an installed icon
   pinned to that scope degrades to a browser tab the moment it redirects.
4. **The receipt counter mid-year.** Going live in September means seeding
   `voucher_sequence` from the last number the office actually issued, or the
   app starts at `Mob/1` beside a paper book at `Mob/812`.
5. **The PDC change is a data decision, not only a code one.** Backfill every
   existing cheque and tell the office the same day that a cheque now clears
   because somebody says so.
6. **Fixing aging will look like a bug.** Loyal customers drop from Critical to
   On Track overnight. Ship `aging_days` and `aging_days_legacy` side by side
   for a week with a one-screen explanation.
7. **Two apps writing one database during cutover.** Fine for orders (same
   RPC); **not** fine for the catalogue, because the old admin's localStorage
   draft shows phantom "unsaved changes" against anything the new one writes.
   Freeze catalogue editing to one app at a time — which is why Phase 6 is late.
8. **The Excel import is the riskiest data step**, because it merges the
   office's real ledger into the existing `allowlist` rows on phone. Dry run,
   eyeball the diff, then run it.
