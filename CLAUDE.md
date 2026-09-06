# SoSell

One app for **Patel Marketing**, merging two half-products: the live catalogue
PWA (`rnp9600/catalog`) and the never-deployed collection module
(`rnp9600/chandler-app`). Both stay as read-only references — nothing is
committed to either.

## Naming, which is not cosmetic

**SoSell** is the software. **Patel Marketing** is the firm — the legal name —
and it belongs on receipts, deposit slips, printed ledgers and the verification
SMS. Both come from `lib/config.js`. Chrome says SoSell; paperwork says Patel
Marketing. The word "Chandler" must not appear anywhere.

## Rules this codebase keeps

**The database is the access control.** Authorisation is row-level security,
never a check in a component. A screen that renders empty for the wrong role is
the correct outcome. `middleware.js` refreshes the session and performs no
authorisation, deliberately — the rule would otherwise live in two places and
only the Postgres copy actually holds.

**The service-role key lives in three paths and nowhere else**:
`app/api/cron/**`, `app/api/push/send`, `scripts/**`. Everything else,
*including every office screen*, uses `lib/supabase/server.js`. The review
test: *would this code be wrong if RLS were enforced?* If yes, the code is
wrong, not RLS. `yarn check:secrets` enforces it.

**A screen is a route; a sheet is a decision.** If it has state worth going
Back to, it gets an address. Dismissing a sheet must not consume a Back press.

**One button.** `components/ui/button.jsx` — four intents (primary, secondary,
quiet, danger), three sizes, a 44px floor on `md`. shadcn's `ghost`, `outline`,
`link`, `default` and `destructive` are deleted, not aliased, so a stray
variant throws instead of rendering a fifth kind of button nobody designed.

**A missing rate is `—`.** Never `₹0`, never `₹NaN` (127 products have no rate
on file). MRP is a *printed* price — if the supplier did not give one, we do
not show one.

**The cart stores `{slug, size, qty}` and nothing else.** Price, name, unit and
MOQ are re-resolved at render, which is why a repeat order prices at today's
rates without special-casing.

**localStorage keys say `v3` on purpose.** Dealers have half-filled baskets
under those exact names right now. `lib/storage.js` is the only file that names
one. Renaming a key empties every basket simultaneously.

## Colour

Two orthogonal attributes on `<html>`: `data-theme` (sky · teal · emerald ·
charcoal) × `data-mode` (light · dark; "auto" is resolved, never stamped).
Eight blocks in `app/globals.css`, each writing the *same* token list — add a
token to one, add it to all eight. shadcn's variables are *derived* from those
tokens in a single mapping block and are never assigned a colour of their own.

## The database

`supabase/00_live_schema_2026-09-05.sql` is a full dump: 19 tables, 32
functions, 10 views, 39 policies. **The commit that changes the database is the
commit that updates that file.** `supabase/SCHEMA.md` has the queries.

Everything is in the `catalog` schema, not `public` — every client must set
`db: { schema: 'catalog' }`, and PostgREST must keep `catalog` exposed
(`PGRST106` = not exposed, `PGRST205` = stale table cache).

## Two environment facts that will confuse you

1. **This sandbox cannot reach `*.supabase.co`.** A direct REST call returns
   HTTP 000 — the connection never opens. So a local run always falls back to
   `lib/catalogue/fallback.json` and reports "database unreachable", and that
   is correct behaviour, not a bug. The live read can only be verified from a
   deploy. The Supabase MCP tools reach the project by another route and do
   work.

2. **The image bucket is not in step.** It holds 897 photos and zero
   thumbnails, against 914 and 904 in the catalog repo. `NEXT_PUBLIC_IMAGE_SOURCE`
   is therefore `legacy` until the sync Action has actually run. See
   `supabase/SCHEMA.md`.

## Commands

```
yarn dev              # localhost:3000
yarn build
yarn check:secrets    # where the service-role key may appear
```
