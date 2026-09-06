-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — 07: the collection domain.
--
-- This is the half of the business that has never shipped. It existed only as
-- a MongoDB prototype that was never deployed, and the seeder that filled it
-- with demo data is deliberately not carried over — THERE IS NO DATA
-- MIGRATION. Real ledger data arrives once, through import_customers() in
-- file 11, from the spreadsheet the office already keeps.
--
-- Everything lives in the `catalog` schema alongside the catalogue, because
-- the identity table, the helper functions the policies lean on, and the whole
-- notification machine are already there. A sibling schema would mean a second
-- PostgREST profile, cross-schema grants, and two places to remember.
--
-- THE IDENTITY RULE: a dealer IS a credit customer. The shops we sell to on
-- credit are the shops the collection routes visit, so there is one row per
-- person in catalog.allowlist and every table below keys on that same
-- 12-character phone (91XXXXXXXXXX) that catalog.my_phone() returns. Never ten
-- digits, never a UUID.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Areas — the geography a route is built from
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.areas (
  id   bigint generated always as identity primary key,
  name text not null unique,
  sort int  not null default 100
);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. What allowlist has to carry now
--
-- Extending the identity table rather than adding a customers table is what
-- the "a dealer is a credit customer" decision buys: one row, one phone, one
-- set of policies.
-- ───────────────────────────────────────────────────────────────────────────
alter table catalog.allowlist
  add column if not exists opening_balance   numeric(14,2) not null default 0,
  -- Always a 1 April. Stored rather than derived, because the figure is a
  -- decision the office made at the year end, not something to recompute.
  add column if not exists opening_as_of     date,
  add column if not exists credit_limit      numeric(14,2) not null default 0,
  add column if not exists payment_terms     text,
  add column if not exists area_id           bigint references catalog.areas(id),
  add column if not exists contact_person    text,
  add column if not exists email             text,
  add column if not exists whatsapp          text,
  add column if not exists business_type     text,
  add column if not exists remarks           text,
  -- A customer who gets automated reminders instead of a staff visit.
  add column if not exists reminder_only     boolean not null default false,
  add column if not exists reminder_schedule text,
  -- Prefills the next cheque form. A shop pays from the same bank most times.
  add column if not exists last_cheque_bank  text,
  -- A ledger-only customer with no phone to sign in with. See below.
  add column if not exists no_login          boolean not null default false;

comment on column catalog.allowlist.no_login is
  'A ledger-only customer. allowlist.phone is the primary key, but the office
   ledger contains people with no mobile number on file. Those get a synthetic
   key of ''00'' || <10 digits>. Indian mobiles start 6-9, so 00... can never
   collide with a real number, and one row per person survives.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Bills
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.invoices (
  id             bigint generated always as identity primary key,
  -- No ON DELETE CASCADE anywhere in this file. Deleting a customer who has
  -- money against them must fail loudly rather than quietly taking the
  -- evidence with it.
  customer_phone text not null references catalog.allowlist(phone),
  invoice_no     text,
  date           date not null,
  amount         numeric(14,2) not null check (amount <> 0),
  description    text,
  -- 'busy' rows come from the accounting package and are READ-ONLY. The old
  -- code documented that rule and never checked it; upsert_invoice() in file
  -- 08 enforces it.
  source         text not null default 'app' check (source in ('app','busy','import')),
  edited         boolean not null default false,
  -- The bridge to the order book: a bill raised against an order.
  order_ref      text references catalog.orders(ref),
  created_at     timestamptz not null default now(),
  created_by     text,
  updated_at     timestamptz,
  updated_by     text
);
create unique index if not exists invoices_no_per_customer
  on catalog.invoices (customer_phone, invoice_no) where invoice_no is not null;
create index if not exists invoices_cust_date
  on catalog.invoices (customer_phone, date);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Money in
--
-- ONE SOURCE OF TRUTH FOR A CHEQUE, which the prototype did not have. It
-- stored is_pdc on the payment AND re-derived it live from the cheque date, so
-- the dashboard and the ledger told two different stories the moment a date
-- passed.
--
-- The resolution is not to pick one: it is that a cheque clears because
-- somebody says it cleared, not because a date arrived. cheque_date is when
-- you MAY bank it; cheque_status is whether the money came. Nothing derives
-- one from the other, and is_pdc is generated so nothing can set it
-- independently.
--
-- This also gives the business something it did not have: a bounced cheque
-- puts the money back on the ledger instead of silently staying paid.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.payments (
  id             bigint generated always as identity primary key,
  receipt_no     text not null unique,          -- Mob/N, or Mob/temp/N
  fy             int  not null,                 -- the April-March year it belongs to
  customer_phone text not null references catalog.allowlist(phone),
  collected_by   text not null references catalog.allowlist(phone),
  visit_id       bigint,                        -- set below, once visits exist
  mode           text not null check (mode in ('cash','cheque','online')),
  amount         numeric(14,2) not null check (amount > 0),

  cheque_no     text,
  cheque_date   date,
  bank_name     text,
  utr           text,
  remarks       text,

  -- Online payments queue for verification; cash and cheque are taken at face
  -- value at the counter, because the collector is standing there.
  status        text not null default 'approved'
                  check (status in ('under_verification','approved','rejected')),

  cheque_status text check (cheque_status in ('pending','cleared','bounced')),
  cleared_on    date,
  bounced_on    date,
  bounce_reason text,

  -- Generated, so it can never disagree with cheque_status.
  is_pdc boolean generated always as
    (mode = 'cheque' and cheque_status = 'pending') stored,

  approved_by   text,
  approved_at   timestamptz,
  rejected_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now()
);

do $$ begin
  alter table catalog.payments add constraint payments_cheque_shape
    check ((mode = 'cheque') = (cheque_status is not null));
exception when duplicate_object then null; end $$;

create index if not exists payments_cust
  on catalog.payments (customer_phone, created_at desc);
-- The query the "cheques to bank" screen runs.
create index if not exists payments_banking
  on catalog.payments (cheque_status, cheque_date) where mode = 'cheque';

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Credit and discount notes
--
-- These were two identical collections in the prototype, and the handler was
-- literally a for-loop over the two names. One table, one kind column.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.adjustments (
  id             bigint generated always as identity primary key,
  customer_phone text not null references catalog.allowlist(phone),
  kind           text not null check (kind in ('credit','discount')),
  amount         numeric(14,2) not null check (amount > 0),
  reason         text,
  receipt_no     text not null unique,
  status         text not null default 'pending'
                   check (status in ('pending','approved','rejected')),
  created_by     text not null,
  created_at     timestamptz not null default now(),
  decided_by     text,
  decided_at     timestamptz,
  decided_note   text
);
create index if not exists adjustments_cust
  on catalog.adjustments (customer_phone, status);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Receipt numbering
--
-- Mob/1, Mob/2 ... restarting every 1 April, because the key contains the
-- financial year. A number is NEVER reused: deleting a payment moves it to the
-- bin and never decrements the counter.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.voucher_sequence (
  key     text primary key,              -- 'mob_<FY>' or 'mob_temp'
  fy      int,
  counter bigint not null default 0
);

-- The bin. A deleted voucher is kept, not destroyed — the number is retired
-- and the record of what it was survives.
create table if not exists catalog.deleted_vouchers (
  id             bigint generated always as identity primary key,
  source_table   text not null,
  receipt_no     text,
  customer_phone text,
  amount         numeric(14,2),
  payload        jsonb not null,
  deleted_by     text not null,
  deleted_at     timestamptz not null default now(),
  reason         text
);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Routes and the day sheet
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.routes (
  id          bigint generated always as identity primary key,
  name        text not null,
  kind        text not null default 'weekly'
                check (kind in ('weekly','fortnightly','monthly','overdue_visit','one_time')),
  cycle       jsonb not null default '{}'::jsonb,
  staff_phone text references catalog.allowlist(phone),
  status      text not null default 'active'
                check (status in ('active','paused','archived')),
  created_by  text,
  created_at  timestamptz not null default now()
);
create index if not exists routes_staff on catalog.routes (staff_phone, status);

-- A join table, not an array of ids. RLS can then say "a collector sees the
-- shops on their own route" with a join instead of an array scan, and a shop
-- can sit on two routes without anything special.
create table if not exists catalog.route_members (
  route_id       bigint not null references catalog.routes(id) on delete cascade,
  customer_phone text   not null references catalog.allowlist(phone),
  sort           int    not null default 0,
  primary key (route_id, customer_phone)
);

create table if not exists catalog.collections (
  id          bigint generated always as identity primary key,
  route_id    bigint not null references catalog.routes(id),
  staff_phone text   not null references catalog.allowlist(phone),
  on_date     date   not null default current_date,
  status      text   not null default 'active' check (status in ('active','ended')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  -- Ending a route locks it. Unlocking is a staff request and an admin
  -- decision, not a button.
  reopen_requested_at timestamptz,
  reopen_approved_at  timestamptz,
  reopen_approved_by  text,
  unique (route_id, on_date)
);

create table if not exists catalog.collection_visits (
  id             bigint generated always as identity primary key,
  collection_id  bigint not null references catalog.collections(id) on delete cascade,
  customer_phone text   not null references catalog.allowlist(phone),
  status         text   not null default 'not_visited'
                   check (status in ('not_visited','paid','not_available','refused','skipped')),
  followup_date  date,
  note           text,
  updated_at     timestamptz not null default now(),
  unique (collection_id, customer_phone)
);

do $$ begin
  alter table catalog.payments
    add constraint payments_visit_fkey
    foreign key (visit_id) references catalog.collection_visits(id);
exception when duplicate_object then null; end $$;

create table if not exists catalog.staff_schedules (
  staff_phone text     not null references catalog.allowlist(phone),
  dow         smallint not null check (dow between 0 and 6),   -- 0 = Monday
  route_id    bigint   not null references catalog.routes(id) on delete cascade,
  primary key (staff_phone, dow, route_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Issues — a query raised against a ledger entry
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists catalog.issues (
  id             bigint generated always as identity primary key,
  entry_kind     text not null check (entry_kind in ('invoice','payment','adjustment','order')),
  entry_id       bigint,
  customer_phone text references catalog.allowlist(phone),
  note           text,
  raised_by      text not null,
  status         text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by    text,
  resolved_at    timestamptz,
  resolution_note text,
  created_at     timestamptz not null default now()
);
create index if not exists issues_open on catalog.issues (status, created_at desc);
