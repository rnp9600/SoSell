# SoSell

The wholesale platform for **Patel Marketing** — one app covering both halves
of the business.

SoSell is the software. *Patel Marketing* is the firm, and it stays the name on
receipts, deposit slips, printed ledgers and the verification SMS. Both come
from one place, `lib/config.js`, so a change of legal name later is one line.

## The two halves

**For customers** — the catalogue, ordering, and their own money: what they
owe and how overdue it is, every bill, every receipt, the orders currently in
process, and the cheques they have given that are coming up for clearance.

**For the office** — products and rates, collection routes and day sheets,
payment approvals, deposit slips, tasks assigned to teammates, and
notifications sent to whoever needs them.

## Where it came from

Two half-products, merged:

- **`rnp9600/catalog`** — the live catalogue PWA. 743 products, real
  phone-OTP auth, a Postgres schema where row-level security *is* the access
  control, an order book, and a signup-approval queue. Its `ARCHITECTURE.md`
  and `README.md` record why each rule exists, mostly written after something
  broke in a customer's hands. Worth reading before changing anything here.
- **`rnp9600/chandler-app`** — never deployed, but the only place the
  collection domain existed: routes, `Mob/N` receipts, post-dated cheques,
  aging, deposit slips.

Both remain as read-only references. Nothing is committed to either.

## Three rules this codebase keeps

**The database is the access control.** A screen that renders empty for the
wrong role is the correct outcome. Authorisation is row-level security, never
a check in a component — there is one copy of the rule and it is in Postgres.
The service-role key appears in exactly three places (`app/api/cron/**`,
`app/api/push/send`, `scripts/**`) and nowhere else. The test to apply in
review: *would this code be wrong if RLS were enforced?* If yes, the code is
wrong, not RLS.

**A screen is a route; a sheet is a decision.** If it has state worth going
Back to, it gets an address. Dismissing a sheet must not consume a Back press.

**A missing rate is `—`.** Never `₹0`, never `₹NaN`. 127 products have no rate
on file; each one is a question a dealer wants to ask, so it goes on the order
with the rate left open and the message says so. MRP is a printed price — if
the supplier did not give one, we do not show one.

## Layout

```
app/(shop)      the catalogue, cart, checkout, orders
app/(account)   profile, ledger, bills, cheques, settings
app/(office)    products, routes, collections, approvals, tasks, notifications
lib/config.js   APP.name = SoSell · FIRM.legalName = Patel Marketing
lib/supabase/   server (cookies) · browser · admin (service role)
supabase/       the schema, dumped and committed — see SCHEMA.md
```

## Status

Early. See `supabase/SCHEMA.md` for the state of the database and one open
finding about the image bucket.
