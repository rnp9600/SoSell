-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — the live `catalog` schema, dumped 2026-09-05
--
-- Project: vcrzauuxvgpsbforiszz (named "Chandler" in the Supabase dashboard —
-- the name predates SoSell and is not the software's name).
--
-- WHY THIS FILE EXISTS
-- `supabase/SCHEMA.md` in the catalog repo has been saying for months that the
-- real schema lives only inside the Supabase project: around a dozen functions,
-- ten views, and every row-level security policy. The policies ARE the access
-- control — the admin panel hiding a tab is presentation, the database is the
-- rule — so losing the project meant reconstructing the security model by
-- reading five HTML files and inferring what it must have been.
--
-- This closes that. Re-run the dump whenever a table, policy or function
-- changes: the commit that changes the database is the commit that updates
-- this file.
--
-- WHAT IS DELIBERATELY NOT HERE
--   · auth.users and anything else Supabase owns — not ours to recreate.
--   · Data. This is the shape, not the contents.
--   · Secrets. The Fast2SMS key and the Send SMS hook secret are edge function
--     secrets and must never enter a repository.
--
-- Order matters: functions before the policies and views that call them.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists catalog;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists catalog.brands (
  id   bigserial primary key,
  name text not null unique,
  sort int default 0
);

create table if not exists catalog.categories (
  id   bigserial primary key,
  name text not null unique,
  sort int default 0
);

create table if not exists catalog.products (
  id           bigserial primary key,
  slug         text not null unique,        -- in links already sent to customers
  code         text unique,                 -- MZ-003
  name         text not null,               -- exactly as printed in the supplier price list
  brand_id     bigint references catalog.brands(id),
  category_id  bigint references catalog.categories(id),
  sub          text,                        -- product type, e.g. "Oil Pourer"
  descr        text,
  spec         text,
  note         text,                        -- e.g. "GST differs by finish"
  alias        text,                        -- the "also called" names; search leans on these
  hsn          text,
  gst          int,
  stock        text default 'active',       -- active | out
  featured     boolean default false,
  hidden       boolean not null default false,
  hotel        jsonb,                       -- hotel-pan spec block, if any
  images       text[] default '{}',         -- first entry is the primary photo
  legacy_sizes text[] default '{}',         -- free-text sizes for products with no rate card
  -- unit/moq/price/mrp apply only to a product with NO size rows. Where rows
  -- exist these are derived on save, so a product can never show two rates.
  unit         text default 'Piece',        -- Piece, Dozen, Box, Gross, Kg, Tag
  moq          int,
  price        numeric,
  mrp          numeric,
  sr           integer,                     -- hand-set sort order
  updated_at   timestamptz default now()
);

create table if not exists catalog.variants (
  id         bigserial primary key,
  product_id bigint not null references catalog.products(id) on delete cascade,
  size       text not null,                 -- "750 ml", "3 pcs set", "NO. 2", "Black"
  rate       numeric,                       -- supplier rate before GST
  price      numeric,                       -- rate including GST  <- shown in the catalogue
  mrp        numeric,
  moq        int,
  unit       text not null default 'Piece',
  sort       int default 0,
  unique (product_id, size)
);

-- The identity table. phone is 12 characters, '91' + ten digits, matching what
-- catalog.my_phone() returns after stripping the '+' from the JWT claim.
create table if not exists catalog.allowlist (
  phone       text primary key,
  name        text,
  shop        text,
  nickname    text,                          -- optional; the office sees it where set
  is_admin    boolean not null default false,
  role        text not null default 'dealer'
                check (role in ('admin','staff','dealer','shop_owner','end_customer')),
  -- shop_owner turned out to be the same thing as a retail dealer and was
  -- collapsed into 'dealer'. The value is still accepted so nothing written
  -- before the merge lost access.
  dealer_type text check (dealer_type is null or dealer_type in ('wholesaler','retailer')),
  owner_phone text references catalog.allowlist(phone),  -- the shop a consumer belongs to
  dept        text,   -- staff only; FK added after departments exists, below
  city        text,   -- a retail dealer is listed to consumers only once this is set
  area        text,
  address     text,
  gst         text,
  gst_status  text check (gst_status is null or gst_status in ('registered','unregistered')),
  photo_url   text,   -- in the "avatars" bucket, named after the owner's phone
  added_at    timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text
);

-- Who may approve what, as data rather than three special cases in code.
create table if not exists catalog.departments (
  id               text primary key,
  label            text not null,
  sort             int not null default 100,
  approve_dealer   boolean not null default false,
  approve_staff    boolean not null default false,
  approve_customer boolean not null default false
);

insert into catalog.departments (id, label, sort, approve_dealer, approve_staff, approve_customer)
values ('office_manager','Office manager', 10, true,  true,  true ),
       ('sales',         'Sales',          20, true,  false, true ),
       ('accounts',      'Accounts',       30, false, false, false),
       ('purchase',      'Purchase',       40, false, false, false),
       ('delivery',      'Delivery',       50, false, false, false),
       ('collection',    'Collection',     60, false, false, false)
on conflict (id) do update
  set label=excluded.label, sort=excluded.sort,
      approve_dealer=excluded.approve_dealer,
      approve_staff=excluded.approve_staff,
      approve_customer=excluded.approve_customer;

create table if not exists catalog.signup_requests (
  id            bigint generated always as identity primary key,
  phone         text not null,
  kind          text not null check (kind in ('dealer','staff','end_customer')),
  name          text not null,
  nickname      text,
  business_name text,
  area          text,
  city          text,
  address       text,
  gst           text,
  gst_status    text check (gst_status is null or gst_status in ('registered','unregistered')),
  dept          text references catalog.departments(id),
  owner_phone   text,    -- set when a dealer vouches for a customer
  note          text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  source        text not null default 'self'   check (source in ('self','dealer','office')),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text,
  decided_note  text
);
-- One live application per number; rejected and approved ones stay for the
-- record, so a number turned down once can apply again.
create unique index if not exists signup_requests_one_pending
  on catalog.signup_requests (phone) where status = 'pending';
create index if not exists signup_requests_pending_first
  on catalog.signup_requests (status, created_at desc);

create table if not exists catalog.orders (
  id              bigserial primary key,
  ref             text not null unique,      -- PM-YYYYMMDD-NNN
  customer_phone  text not null references catalog.allowlist(phone) on delete restrict,
  customer_name   text,
  placed_by       text not null,
  taken_by_office boolean not null default false,
  status          text not null default 'new'
                    check (status in ('new','confirmed','packed','sent','completed','cancelled')),
  note            text,
  total           numeric,
  -- While needs_approval is true and approved_at is null the office cannot
  -- move the order past "confirmed". It is held, not merely annotated.
  needs_approval  boolean not null default false,
  approval_reason text,
  approved_at     timestamptz,
  approved_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_customer_idx on catalog.orders (customer_phone, created_at desc);
create index if not exists orders_status_idx   on catalog.orders (status, created_at desc);

create table if not exists catalog.order_items (
  id           bigserial primary key,
  order_id     bigint not null references catalog.orders(id) on delete cascade,
  product_slug text not null,
  name         text not null,
  size         text,
  unit         text,
  qty          int not null check (qty > 0),
  price        numeric,      -- null means "rate on request"; the line goes out open
  mrp          numeric,
  sort         int
);
create index if not exists order_items_order_idx on catalog.order_items (order_id, sort);

create table if not exists catalog.notices (
  id           bigserial primary key,
  title        text not null,
  body         text,
  product_slug text,
  audience     text not null default 'dealer'
                 check (audience in ('all','dealer','end_customer','staff')),
  tone         text not null default 'new'
                 check (tone in ('festive','offer','new','top')),
  active       boolean not null default true,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  created_by   text
);
create index if not exists notices_live_idx on catalog.notices (active, starts_at, ends_at);

create table if not exists catalog.follows (
  customer_phone text not null references catalog.allowlist(phone) on delete cascade,
  dealer_phone   text not null references catalog.allowlist(phone) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (customer_phone, dealer_phone)
);
create index if not exists follows_dealer_idx on catalog.follows (dealer_phone);

create table if not exists catalog.shop_offers (
  id           bigserial primary key,
  shop_phone   text not null references catalog.allowlist(phone),
  product_slug text not null references catalog.products(slug),
  status       text check (status in ('in_stock','arriving','held')),
  note         text,
  -- Percent off the printed MRP, 0-25. A dealer sets how much they will come
  -- down, not what the product costs, so two dealers cannot advertise
  -- different prices for the same named product.
  discount_pct smallint check (discount_pct is null or (discount_pct between 0 and 25)),
  price_offer  numeric,   -- DEPRECATED, kept so older offers still render
  updated_at   timestamptz not null default now(),
  unique (shop_phone, product_slug)
);
create index if not exists idx_shop_offers_shop    on catalog.shop_offers (shop_phone);
create index if not exists idx_shop_offers_product on catalog.shop_offers (product_slug);

create table if not exists catalog.stock_listings (
  id           bigserial primary key,
  dealer_phone text not null references catalog.allowlist(phone),
  product_slug text not null references catalog.products(slug),
  qty          int not null check (qty > 0),
  asking_rate  numeric,
  city         text,
  held_since   date,
  contact_pref text not null default 'whatsapp'
                 check (contact_pref in ('whatsapp','call','either')),
  note         text,
  status       text not null default 'open' check (status in ('open','sold','expired')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days'),
  sold_at      timestamptz
);
create index if not exists idx_stock_listings_dealer  on catalog.stock_listings (dealer_phone);
create index if not exists idx_stock_listings_product on catalog.stock_listings (product_slug);

create table if not exists catalog.product_reviews (
  product_slug text not null,
  phone        text not null references catalog.allowlist(phone) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  body         text,
  -- A hidden review disappears from the public view but is kept, so the same
  -- person cannot simply post it again under the primary key.
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (product_slug, phone)
);
create index if not exists product_reviews_slug_idx
  on catalog.product_reviews (product_slug) where not hidden;

-- What people looked for. Append-only to everyone: anyone may insert, only the
-- office may select, and there is no update or delete policy at all.
create table if not exists catalog.events (
  id    bigint generated always as identity primary key,
  at    timestamptz not null default now(),
  phone text,                    -- null for anyone browsing signed out
  kind  text not null check (kind in ('search','open','order','zero')),
  q     text,                    -- the search as typed
  slug  text,                    -- the product opened
  n     int,                     -- how many results that search returned
  meta  jsonb
);
create index if not exists idx_events_at   on catalog.events (at desc);
create index if not exists idx_events_kind on catalog.events (kind, at desc);
create index if not exists idx_events_zero on catalog.events (at desc) where kind = 'zero';

create table if not exists catalog.notify_routes (
  kind text not null,
  role text not null check (role in ('admin','staff')),
  dept text not null default '*',        -- '*' = every staff member
  primary key (kind, role, dept)
);

insert into catalog.notify_routes (kind, role, dept) values
  ('signup_dealer',       'admin','*'),
  ('signup_dealer',       'staff','office_manager'),
  ('signup_dealer',       'staff','sales'),
  ('signup_staff',        'admin','*'),
  ('signup_staff',        'staff','office_manager'),
  ('signup_end_customer', 'admin','*'),
  ('signup_end_customer', 'staff','office_manager'),
  ('signup_end_customer', 'staff','sales'),
  ('customer_unattached', 'admin','*'),
  ('customer_unattached', 'staff','sales')
on conflict do nothing;

create table if not exists catalog.notifications (
  id         bigint generated always as identity primary key,
  kind       text not null,
  title      text not null,
  body       text,
  ref_id     bigint,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recent on catalog.notifications (created_at desc);

create table if not exists catalog.notification_targets (
  notification_id bigint not null references catalog.notifications(id) on delete cascade,
  role            text not null,
  dept            text not null default '*',
  primary key (notification_id, role, dept)
);

create table if not exists catalog.notification_reads (
  notification_id bigint not null references catalog.notifications(id) on delete cascade,
  phone           text not null,
  read_at         timestamptz not null default now(),
  primary key (notification_id, phone)
);

create extension if not exists pg_trgm with schema extensions;
create index if not exists idx_catalog_products_brand    on catalog.products (brand_id);
create index if not exists idx_catalog_products_category on catalog.products (category_id);
create index if not exists idx_catalog_products_name_trgm
  on catalog.products using gin (name extensions.gin_trgm_ops);
create index if not exists idx_catalog_variants_product  on catalog.variants (product_id);

-- allowlist.dept is constrained here rather than inline, because departments is
-- created after allowlist. Only staff carry one, and staff without one can
-- approve nothing.
do $$ begin
  alter table catalog.allowlist
    add constraint allowlist_dept_fkey foreign key (dept) references catalog.departments(id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table catalog.allowlist
    add constraint allowlist_dept_staff_only check (dept is null or role = 'staff');
exception when duplicate_object then null; end $$;

-- Tables above; functions, views and policies below.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. IDENTITY HELPERS
--
-- Every policy in this schema leans on these. Note that my_phone() strips the
-- leading '+' from the JWT claim, because that is how numbers are stored in
-- allowlist — a policy that compares against the raw claim compiles, runs, and
-- matches nobody.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.my_phone()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select replace(coalesce(auth.jwt()->>'phone',''), '+', '');
$function$;

CREATE OR REPLACE FUNCTION catalog.my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select coalesce((
    select a.role from catalog.allowlist a
    where a.phone = replace(coalesce(auth.jwt()->>'phone',''), '+', '')
  ), 'guest');
$function$;

CREATE OR REPLACE FUNCTION catalog.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select coalesce((
    select a.is_admin from catalog.allowlist a
    where a.phone = replace(coalesce(auth.jwt()->>'phone',''), '+', '')
  ), false);
$function$;

CREATE OR REPLACE FUNCTION catalog.is_dealer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$ select catalog.my_role() in ('dealer','shop_owner'); $function$;

CREATE OR REPLACE FUNCTION catalog.is_listed_dealer(p_phone text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select exists (
    select 1 from catalog.allowlist a
     where a.phone = p_phone and a.role in ('dealer','shop_owner')
  );
$function$;

CREATE OR REPLACE FUNCTION catalog.can_trade()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select coalesce((select a.role in ('dealer','shop_owner','admin','staff')
    from catalog.allowlist a where a.phone = catalog.my_phone()), false);
$function$;

CREATE OR REPLACE FUNCTION catalog.can_edit_catalogue()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$ select catalog.is_admin() or catalog.my_role() = 'staff'; $function$;

CREATE OR REPLACE FUNCTION catalog.my_owner_phone()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select a.owner_phone from catalog.allowlist a where a.phone = catalog.my_phone();
$function$;

-- The shops a consumer may see the offers of: the one that put them on the
-- list, plus every shop they have followed.
CREATE OR REPLACE FUNCTION catalog.my_dealer_phones()
 RETURNS SETOF text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select a.owner_phone from catalog.allowlist a
   where a.phone = catalog.my_phone() and a.owner_phone is not null
  union
  select f.dealer_phone from catalog.follows f
   where f.customer_phone = catalog.my_phone();
$function$;

CREATE OR REPLACE FUNCTION catalog.can_see_order(p_order_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select exists (
    select 1 from catalog.orders o
     where o.id = p_order_id
       and (catalog.can_edit_catalogue()
            or o.customer_phone = catalog.my_phone()
            or o.placed_by      = catalog.my_phone())
  );
$function$;

-- Who may decide what, read from the three booleans on catalog.departments.
-- "Only an admin or an office manager lets new staff in" is a row someone can
-- change, not a branch in code.
CREATE OR REPLACE FUNCTION catalog.can_approve(p_kind text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select case
    when catalog.is_admin() then true
    when catalog.my_role() <> 'staff' then false
    else coalesce((
      select case p_kind
               when 'dealer' then d.approve_dealer
               when 'staff' then d.approve_staff
               when 'end_customer' then d.approve_customer
               else false end
        from catalog.allowlist a join catalog.departments d on d.id = a.dept
       where a.phone = catalog.my_phone()), false)
  end;
$function$;

CREATE OR REPLACE FUNCTION catalog.can_approve_any()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select catalog.can_approve('dealer') or catalog.can_approve('staff')
      or catalog.can_approve('end_customer');
$function$;

-- What the office should call an applicant: a nickname if they gave one,
-- otherwise "Firm name (Area)" — because two shops called Sharma Traders is
-- the normal case and the area is what tells them apart.
CREATE OR REPLACE FUNCTION catalog.display_name(p_nickname text, p_business text, p_name text, p_area text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(
    nullif(trim(coalesce(p_nickname,'')), ''),
    nullif(trim(coalesce(p_business, p_name, '')), '')
      || case when nullif(trim(coalesce(p_area,'')),'') is not null
              then ' (' || trim(p_area) || ')' else '' end,
    'Unnamed');
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. NOTIFICATIONS
--
-- notify() addresses a notification through catalog.notify_routes, so "who
-- hears about a new dealer" is data. A delivery driver is not told about a
-- dealer application, and changing that needs no deploy.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.notify(p_kind text, p_title text, p_body text, p_ref bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare nid bigint;
begin
  insert into catalog.notifications (kind, title, body, ref_id)
  values (p_kind, p_title, p_body, p_ref) returning id into nid;
  insert into catalog.notification_targets (notification_id, role, dept)
  select nid, r.role, r.dept from catalog.notify_routes r where r.kind = p_kind
  on conflict do nothing;
  return nid;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.mark_notifications_read(p_ids bigint[])
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  insert into catalog.notification_reads (notification_id, phone)
  select unnest(p_ids), catalog.my_phone()
  where coalesce(catalog.my_phone(),'') <> ''
  on conflict do nothing;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. SIGNING UP, AND BEING APPROVED
--
-- Getting in is a queue, not a wall. The OTP proves a phone and nothing more;
-- a number with no allowlist row fills a form, and somebody in the office
-- decides. They can browse while they wait; they cannot trade.
--
-- submit_signup and decide_signup are the ONLY doors, and both are SECURITY
-- DEFINER reading the phone from the JWT — so it cannot be spoofed from the
-- payload and a decision cannot be forged.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.submit_signup(payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare ph text := catalog.my_phone();
        k text := coalesce(payload->>'kind','end_customer');
        nm text := nullif(trim(coalesce(payload->>'name','')), '');
        rid bigint;
begin
  if coalesce(ph,'') = '' then raise exception 'not signed in'; end if;
  if nm is null then raise exception 'a name is needed'; end if;
  if k not in ('dealer','staff','end_customer') then raise exception 'unknown kind'; end if;
  if exists (select 1 from catalog.allowlist where phone = ph) then
    raise exception 'that number is already set up - just sign in'; end if;
  if k = 'staff' and nullif(payload->>'dept','') is null then
    raise exception 'which department?'; end if;

  insert into catalog.signup_requests
    (phone, kind, name, nickname, business_name, area, city, address,
     gst, gst_status, dept, owner_phone, note, source)
  values (ph, k, nm,
     nullif(trim(coalesce(payload->>'nickname','')),''),
     nullif(trim(coalesce(payload->>'business_name','')),''),
     nullif(trim(coalesce(payload->>'area','')),''),
     nullif(trim(coalesce(payload->>'city','')),''),
     nullif(trim(coalesce(payload->>'address','')),''),
     nullif(trim(coalesce(payload->>'gst','')),''),
     nullif(payload->>'gst_status',''),
     nullif(payload->>'dept',''),
     nullif(regexp_replace(coalesce(payload->>'owner_phone',''), '\D', '', 'g'),''),
     nullif(trim(coalesce(payload->>'note','')),''), 'self')
  -- Re-submitting replaces the pending application rather than failing on the
  -- unique index. Someone correcting a typo should not be stuck.
  on conflict (phone) where status = 'pending' do update
    set kind=excluded.kind, name=excluded.name, nickname=excluded.nickname,
        business_name=excluded.business_name, area=excluded.area, city=excluded.city,
        address=excluded.address, gst=excluded.gst, gst_status=excluded.gst_status,
        dept=excluded.dept, owner_phone=excluded.owner_phone, note=excluded.note,
        created_at=now()
  returning id into rid;

  perform catalog.notify('signup_' || k,
    case k when 'dealer' then 'New dealer application'
           when 'staff' then 'New staff request'
           else 'New customer sign-up' end,
    catalog.display_name(
      nullif(trim(coalesce(payload->>'nickname','')),''),
      nullif(trim(coalesce(payload->>'business_name','')),''), nm,
      nullif(trim(coalesce(payload->>'area','')),''))
      || ' - +91' || right(ph, 10), rid);
  return rid;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.decide_signup(p_id bigint, p_ok boolean, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare r catalog.signup_requests; me text := catalog.my_phone();
begin
  select * into r from catalog.signup_requests where id = p_id;
  if r.id is null then raise exception 'no such request'; end if;
  if r.status <> 'pending' then raise exception 'that one is already %', r.status; end if;
  if not catalog.can_approve(r.kind) then
    raise exception 'you are not set up to decide % applications', r.kind; end if;

  if not p_ok then
    update catalog.signup_requests
       set status='rejected', decided_at=now(), decided_by=me, decided_note=p_note
     where id = p_id;
    return 'rejected';
  end if;

  insert into catalog.allowlist
    (phone, name, nickname, shop, role, is_admin, city, area, address,
     gst, gst_status, dept, owner_phone, approved_at, approved_by)
  values (r.phone, r.name, r.nickname, r.business_name,
     case r.kind when 'dealer' then 'dealer' when 'staff' then 'staff' else 'end_customer' end,
     false, r.city, r.area, r.address, r.gst, r.gst_status,
     case when r.kind='staff' then r.dept else null end,
     r.owner_phone, now(), me)
  on conflict (phone) do update
    set name=excluded.name, nickname=excluded.nickname, shop=excluded.shop,
        role=excluded.role, city=excluded.city, area=excluded.area,
        address=excluded.address, gst=excluded.gst, gst_status=excluded.gst_status,
        dept=excluded.dept, owner_phone=excluded.owner_phone,
        approved_at=excluded.approved_at, approved_by=excluded.approved_by;

  update catalog.signup_requests
     set status='approved', decided_at=now(), decided_by=me, decided_note=p_note
   where id = p_id;

  -- A customer nobody owns is somebody's job to place, so say so once rather
  -- than letting them sit unattached and unnoticed.
  if r.kind = 'end_customer' and coalesce(r.owner_phone,'') = '' then
    perform catalog.notify('customer_unattached', 'Customer has no shop yet',
      catalog.display_name(r.nickname, r.business_name, r.name, r.area)
        || ' - +91' || right(r.phone, 10) || ' - set them against a dealer.', r.id);
  end if;
  return 'approved';
end; $function$;

-- Deliberately returns a row for a number with no application at all, so the
-- app has one question to ask instead of three.
CREATE OR REPLACE FUNCTION catalog.my_signup_status()
 RETURNS TABLE(status text, kind text, id bigint, created_at timestamp with time zone, decided_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
  select coalesce(
           (select 'member'::text from catalog.allowlist where phone = catalog.my_phone()),
           (select s.status from catalog.signup_requests s where s.phone = catalog.my_phone()
             order by s.created_at desc limit 1), 'none'),
         (select s.kind from catalog.signup_requests s where s.phone = catalog.my_phone()
           order by s.created_at desc limit 1),
         (select s.id from catalog.signup_requests s where s.phone = catalog.my_phone()
           order by s.created_at desc limit 1),
         (select s.created_at from catalog.signup_requests s where s.phone = catalog.my_phone()
           order by s.created_at desc limit 1),
         (select s.decided_note from catalog.signup_requests s where s.phone = catalog.my_phone()
           order by s.created_at desc limit 1);
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. PEOPLE
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.admin_upsert_customer(p_phone text, p_name text, p_shop text, p_role text, p_nickname text DEFAULT NULL::text, p_dealer_type text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_gst text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
begin
  if not catalog.is_admin() then raise exception 'not an admin'; end if;
  if p_role not in ('admin','staff','dealer','end_customer') then
    raise exception 'role must be admin, staff, dealer or end_customer';
  end if;
  if p_dealer_type is not null and p_dealer_type not in ('wholesaler','retailer') then
    raise exception 'dealer type must be wholesaler or retailer';
  end if;

  insert into catalog.allowlist (phone, name, shop, role, is_admin, nickname, dealer_type, city, gst)
  values (p_phone, p_name, p_shop, p_role, p_role = 'admin', p_nickname,
          case when p_role = 'dealer' then coalesce(p_dealer_type,'retailer') else null end,
          nullif(p_city,''), upper(nullif(p_gst,'')))
  on conflict (phone) do update set
    name        = excluded.name,
    shop        = excluded.shop,
    role        = excluded.role,
    is_admin    = excluded.is_admin,
    nickname    = excluded.nickname,
    dealer_type = excluded.dealer_type,
    city        = excluded.city,
    gst         = excluded.gst;
end; $function$;

-- NOTE for SoSell: once the ledger tables exist this must refuse to delete a
-- customer who has money against them. A deleted customer with orphaned
-- payments is unrecoverable.
CREATE OR REPLACE FUNCTION catalog.admin_delete_customer(p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
begin
  if not catalog.is_admin() then
    raise exception 'not an admin';
  end if;
  delete from catalog.allowlist where phone = p_phone;
end;
$function$;

-- A shop asking a customer for their number. A consumer who signed up alone
-- has no owner yet, and a dealer adding that number claims them; a number
-- already on another dealer's list is refused.
CREATE OR REPLACE FUNCTION catalog.shop_upsert_end_customer(p_phone text, p_name text, p_nickname text DEFAULT NULL::text, p_city text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare existing catalog.allowlist;
begin
  if not catalog.is_dealer() then
    raise exception 'not a dealer';
  end if;

  select * into existing from catalog.allowlist where phone = p_phone;

  if existing.phone is null then
    insert into catalog.allowlist (phone, name, role, owner_phone, nickname, city)
    values (p_phone, p_name, 'end_customer', catalog.my_phone(), p_nickname, nullif(p_city,''));
    -- Adding someone is also following them: the shop that put them on the
    -- list is a shop they buy from, and this is what makes its offers show.
    insert into catalog.follows (customer_phone, dealer_phone)
    values (p_phone, catalog.my_phone())
    on conflict do nothing;
  elsif existing.role = 'end_customer'
        and (existing.owner_phone = catalog.my_phone() or existing.owner_phone is null) then
    update catalog.allowlist
       set name = p_name,
           nickname = p_nickname,
           city = coalesce(nullif(p_city,''), city),
           owner_phone = coalesce(owner_phone, catalog.my_phone())
     where phone = p_phone;
    insert into catalog.follows (customer_phone, dealer_phone)
    values (p_phone, catalog.my_phone())
    on conflict do nothing;
  else
    raise exception 'that number is already on someone else''s list';
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.shop_delete_end_customer(p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
begin
  if not catalog.is_dealer() then
    raise exception 'not a dealer';
  end if;
  delete from catalog.allowlist
   where phone = p_phone and role = 'end_customer' and owner_phone = catalog.my_phone();
end; $function$;

CREATE OR REPLACE FUNCTION catalog.self_signup_end_customer(p_name text, p_city text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare ph text := catalog.my_phone(); existing catalog.allowlist;
begin
  if coalesce(ph,'') = '' then
    raise exception 'not signed in';
  end if;

  select * into existing from catalog.allowlist where phone = ph;

  if existing.phone is not null then
    if existing.role <> 'end_customer' then
      raise exception 'that number is already registered';
    end if;
    update catalog.allowlist
       set name = coalesce(nullif(p_name,''), name),
           city = coalesce(nullif(p_city,''), city)
     where phone = ph;
    return;
  end if;

  insert into catalog.allowlist (phone, name, role, city, is_admin)
  values (ph, nullif(p_name,''), 'end_customer', nullif(p_city,''), false);
end; $function$;

CREATE OR REPLACE FUNCTION catalog.update_my_profile(p_name text, p_shop text, p_city text, p_gst text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare me text := catalog.my_phone(); r catalog.allowlist;
begin
  if coalesce(me,'') = '' then raise exception 'not signed in'; end if;
  select * into r from catalog.allowlist where phone = me;
  if r.phone is null then raise exception 'that number is not on our list'; end if;

  if coalesce(trim(p_name),'') = '' then
    raise exception 'a name is needed';
  end if;
  -- A GSTIN is 15 characters. Reject anything that is plainly not one rather
  -- than storing a typo that later prints on an order.
  if coalesce(trim(p_gst),'') <> '' and trim(p_gst) !~ '^[0-9A-Za-z]{15}$' then
    raise exception 'a GST number is 15 letters and digits';
  end if;

  update catalog.allowlist
     set name = trim(p_name),
         -- Consumers have no firm and no GST; ignore both rather than storing
         -- something the rest of the system will not expect on that role.
         shop = case when r.role = 'end_customer' then shop else nullif(trim(coalesce(p_shop,'')),'') end,
         city = nullif(trim(coalesce(p_city,'')),''),
         gst  = case when r.role = 'end_customer' then null else upper(nullif(trim(coalesce(p_gst,'')),'')) end
   where phone = me;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.set_my_photo(p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare me text := catalog.my_phone();
begin
  if coalesce(me,'') = '' then raise exception 'not signed in'; end if;
  if p_url is not null and p_url <> '' then
    if position('/storage/v1/object/public/avatars/' || me || '/' in p_url) = 0 then
      raise exception 'that is not your own photo';
    end if;
  end if;
  update catalog.allowlist set photo_url = nullif(p_url,'') where phone = me;
  if not found then raise exception 'that number is not on our list'; end if;
end; $function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. THE CATALOGUE
--
-- A product with size rows takes its price from the rows; the four single-line
-- fields are derived on save, so a product can never display two rates.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.admin_upsert_product(payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare
  pid bigint;
  p_slug text := payload->>'slug';
begin
  if not catalog.can_edit_catalogue() then
    raise exception 'not allowed to edit the catalogue';
  end if;
  if coalesce(p_slug,'') = '' then
    raise exception 'product needs a slug';
  end if;

  insert into catalog.brands(name)
  select payload->>'brand' where coalesce(payload->>'brand','') <> ''
  on conflict (name) do nothing;

  insert into catalog.categories(name)
  select payload->>'cat' where coalesce(payload->>'cat','') <> ''
  on conflict (name) do nothing;

  insert into catalog.products
    (slug, code, name, brand_id, category_id, sub, descr, spec, note, gst,
     stock, featured, hidden, hotel, images, legacy_sizes, unit, moq, updated_at)
  values (
    p_slug, nullif(payload->>'code',''), payload->>'name',
    (select id from catalog.brands b where b.name = payload->>'brand'),
    (select id from catalog.categories c where c.name = payload->>'cat'),
    nullif(payload->>'sub',''), nullif(payload->>'desc',''), nullif(payload->>'spec',''),
    nullif(payload->>'note',''), nullif(payload->>'gst','')::int,
    coalesce(nullif(payload->>'stock',''),'active'),
    coalesce((payload->>'feat')::boolean,false),
    coalesce((payload->>'hidden')::boolean,false),
    case when payload->'hotel' in ('null'::jsonb) then null else payload->'hotel' end,
    coalesce(array(select jsonb_array_elements_text(payload->'imgs')), array[]::text[]),
    coalesce(array(select jsonb_array_elements_text(payload->'sizes')), array[]::text[]),
    coalesce(nullif(payload->>'unit',''),'Piece'),
    nullif(payload->>'moq','')::int,
    now()
  )
  on conflict (slug) do update set
    code=excluded.code, name=excluded.name, brand_id=excluded.brand_id,
    category_id=excluded.category_id, sub=excluded.sub, descr=excluded.descr,
    spec=excluded.spec, note=excluded.note, gst=excluded.gst, stock=excluded.stock,
    featured=excluded.featured, hidden=excluded.hidden, hotel=excluded.hotel,
    images=excluded.images, legacy_sizes=excluded.legacy_sizes,
    unit=excluded.unit, moq=excluded.moq, updated_at=now()
  returning id into pid;

  delete from catalog.variants where product_id = pid;

  insert into catalog.variants (product_id, size, rate, price, mrp, moq, unit, sort)
  select pid, coalesce(nullif(x->>'size',''),'Standard'),
         nullif(x->>'rate','')::numeric, nullif(x->>'price','')::numeric,
         nullif(x->>'mrp','')::numeric,  nullif(x->>'moq','')::int,
         coalesce(nullif(x->>'unit',''),'Piece'), ord
  from lateral jsonb_array_elements(coalesce(payload->'variants','[]'::jsonb)) with ordinality as t(x,ord);

  return pid;
end;
$function$;

CREATE OR REPLACE FUNCTION catalog.admin_delete_product(p_slug text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
begin
  if not catalog.can_edit_catalogue() then
    raise exception 'not allowed to edit the catalogue';
  end if;
  delete from catalog.products where slug = p_slug;
end; $function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. ORDERS
--
-- place_order is the only door. The customer defaults to the caller, and only
-- the office may place an order for somebody else.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.place_order(p_customer text, p_note text, p_items jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare
  me      text := catalog.my_phone();
  cust    text := coalesce(nullif(p_customer,''), me);
  office  boolean := catalog.can_edit_catalogue();
  v_ref   text;  v_id bigint;  v_total numeric;  v_name text;  n int;
begin
  if coalesce(me,'') = '' then raise exception 'not signed in'; end if;
  if catalog.my_role() = 'guest' then
    raise exception 'that number is not on our list';
  end if;
  if cust <> me and not office then
    raise exception 'only Patel Marketing can place an order for someone else';
  end if;

  select coalesce(nullif(a.nickname,''), nullif(a.shop,''), nullif(a.name,''), a.phone)
    into v_name from catalog.allowlist a where a.phone = cust;
  if v_name is null then raise exception 'that customer is not on the list'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'an order needs at least one line';
  end if;

  -- A line with a null price is "rate on request" and contributes nothing to
  -- the total; the order goes out with that rate left open.
  select coalesce(sum(coalesce((x->>'price')::numeric,0)
                      * greatest((x->>'qty')::int,0)), 0)
    into v_total from jsonb_array_elements(p_items) x;

  -- PM-YYYYMMDD-NNN, counted per Indian calendar day, retried on collision.
  for n in 1..25 loop
    select 'PM-' || to_char((now() at time zone 'Asia/Kolkata')::date,'YYYYMMDD')
           || '-' || lpad((count(*) + n)::text, 3, '0')
      into v_ref from catalog.orders
     where (created_at at time zone 'Asia/Kolkata')::date
           = (now() at time zone 'Asia/Kolkata')::date;
    begin
      insert into catalog.orders
        (ref, customer_phone, customer_name, placed_by, taken_by_office, note, total)
      values (v_ref, cust, v_name, me, (cust <> me), nullif(p_note,''), v_total)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if n = 25 then raise; end if;
    end;
  end loop;

  insert into catalog.order_items
    (order_id, product_slug, name, size, unit, qty, price, mrp, sort)
  select v_id, coalesce(nullif(x->>'slug',''),'unknown'),
         coalesce(nullif(x->>'name',''),'(unnamed)'),
         nullif(x->>'size',''), nullif(x->>'unit',''),
         greatest((x->>'qty')::int, 1),
         nullif(x->>'price','')::numeric, nullif(x->>'mrp','')::numeric, ord
  from jsonb_array_elements(p_items) with ordinality as t(x, ord);

  return v_ref;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.set_order_status(p_ref text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
declare o catalog.orders;
begin
  if not catalog.can_edit_catalogue() then
    raise exception 'not allowed to change an order';
  end if;
  if p_status not in ('new','confirmed','packed','sent','completed','cancelled') then
    raise exception 'unknown status';
  end if;

  select * into o from catalog.orders where ref = p_ref;
  if o.ref is null then raise exception 'no order with that reference'; end if;

  -- Cancelling is always allowed; going forwards is not, while it is held.
  if o.needs_approval and o.approved_at is null
     and p_status in ('packed','sent','completed') then
    raise exception 'this order is waiting for the admin to approve it';
  end if;

  update catalog.orders
     set status = p_status, updated_at = now()
   where ref = p_ref;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.request_approval(p_ref text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
begin
  if not catalog.can_edit_catalogue() then
    raise exception 'not allowed to change an order';
  end if;
  update catalog.orders
     set needs_approval = true,
         approval_reason = nullif(p_reason,''),
         approved_at = null, approved_by = null,
         updated_at = now()
   where ref = p_ref;
  if not found then raise exception 'no order with that reference'; end if;
end; $function$;

CREATE OR REPLACE FUNCTION catalog.approve_order(p_ref text, p_ok boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'public'
AS $function$
begin
  if not catalog.is_admin() then
    raise exception 'only an admin can approve an order';
  end if;
  if p_ok then
    update catalog.orders
       set approved_at = now(), approved_by = catalog.my_phone(),
           needs_approval = false, updated_at = now()
     where ref = p_ref;
  else
    update catalog.orders
       set status = 'cancelled', needs_approval = false,
           approved_at = null, approved_by = null, updated_at = now()
     where ref = p_ref;
  end if;
  if not found then raise exception 'no order with that reference'; end if;
end; $function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. sync_from_site — LEGACY
--
-- Pulls data.json back into the tables over HTTP. This existed because the
-- published file and the database could drift in either direction. SoSell
-- reads catalog.catalogue live and has no publish step, so this becomes a
-- one-way repair tool rather than part of the normal flow. Kept because it is
-- part of the schema as it stands, and because it is the only way to restore
-- the tables from the file if the project is ever rebuilt.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION catalog.sync_from_site(url text DEFAULT NULL::text, prune boolean DEFAULT true)
 RETURNS TABLE(products integer, variants integer, added integer, removed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'catalog', 'extensions', 'public'
AS $function$
declare
  src text := coalesce(url, 'https://patelmarketing-catalog.vercel.app/data.json');
  body text; doc jsonb; before int; gone int := 0;
begin
  select count(*) into before from catalog.products;
  select content into body from extensions.http_get(src);
  if body is null or left(btrim(body),1) <> '[' then
    raise exception 'data.json did not come back as a list from %', src; end if;
  doc := body::jsonb;
  -- A truncated or half-written file must not be allowed to prune the shop.
  if jsonb_array_length(doc) < 50 then
    raise exception 'refusing to sync: only % products found, that looks wrong',
      jsonb_array_length(doc); end if;

  drop table if exists _in;
  create temp table _in on commit drop as
  with base as (
    select coalesce(nullif(p->>'slug',''),
             trim(both '-' from regexp_replace(
               lower(coalesce(p->>'brand','')||'-'||(p->>'name')),'[^a-z0-9]+','-','g'))) as s0,
           nullif(p->>'code','') as code, p
    from jsonb_array_elements(doc) p
    where coalesce(p->>'name','') <> ''
  ), ranked as (
    select *, row_number() over (partition by s0 order by coalesce(code,'zzz'), p->>'name') rn from base
  )
  select case when rn=1 then s0
              when code is not null then s0||'-'||lower(regexp_replace(code,'[^a-zA-Z0-9]','','g'))
              else s0||'-'||rn end as slug, code, p
  from ranked;

  -- Slugs are in links already sent to customers, so a slug that has to move
  -- is parked under a temporary name rather than colliding.
  update catalog.products pr set slug = pr.slug||'~'||pr.id
   where exists (select 1 from _in i where i.code is not null and pr.code=i.code
                   and pr.slug is distinct from i.slug)
      or (pr.slug in (select slug from _in)
          and coalesce(pr.code,'') is distinct from
              coalesce((select i.code from _in i where i.slug=pr.slug limit 1),''));
  update catalog.products pr set slug=i.slug from _in i
   where i.code is not null and pr.code=i.code and pr.slug ~ '~[0-9]+$';
  update catalog.products pr set code=null from _in i
   where pr.code=i.code and pr.slug is distinct from i.slug;

  insert into catalog.brands(name)
  select distinct p->>'brand' from _in where coalesce(p->>'brand','')<>''
  on conflict (name) do nothing;
  insert into catalog.categories(name)
  select distinct p->>'cat' from _in where coalesce(p->>'cat','')<>''
  on conflict (name) do nothing;

  insert into catalog.products
    (slug, code, name, brand_id, category_id, sub, descr, spec, note, gst,
     stock, featured, hidden, hotel, images, legacy_sizes,
     alias, hsn, price, mrp, sr, updated_at)
  select i.slug, i.code, p->>'name',
    (select id from catalog.brands b where b.name = p->>'brand'),
    (select id from catalog.categories c where c.name = p->>'cat'),
    nullif(p->>'sub',''), nullif(p->>'desc',''), nullif(p->>'spec',''),
    nullif(p->>'note',''), nullif(p->>'gst','')::int,
    coalesce(nullif(p->>'stock',''),'active'),
    coalesce((p->>'feat')::boolean,false),
    coalesce((p->>'hidden')::boolean,false),
    case when p->'hotel' in ('null'::jsonb) then null else p->'hotel' end,
    coalesce(array(select jsonb_array_elements_text(p->'imgs')), array[]::text[]),
    coalesce(array(select jsonb_array_elements_text(p->'sizes')), array[]::text[]),
    nullif(p->>'alias',''), nullif(p->>'hsn',''),
    nullif(p->>'price','')::numeric, nullif(p->>'mrp','')::numeric,
    nullif(p->>'sr','')::int, now()
  from _in i
  on conflict (slug) do update set
    code=excluded.code, name=excluded.name, brand_id=excluded.brand_id,
    category_id=excluded.category_id, sub=excluded.sub, descr=excluded.descr,
    spec=excluded.spec, note=excluded.note, gst=excluded.gst, stock=excluded.stock,
    featured=excluded.featured, hidden=excluded.hidden, hotel=excluded.hotel,
    images=excluded.images, legacy_sizes=excluded.legacy_sizes,
    alias=excluded.alias, hsn=excluded.hsn, price=excluded.price,
    mrp=excluded.mrp, sr=excluded.sr, updated_at=now();

  delete from catalog.variants v using catalog.products pr
   where v.product_id=pr.id and pr.slug in (select slug from _in);
  insert into catalog.variants (product_id, size, rate, price, mrp, moq, unit, sort)
  select pr.id, coalesce(nullif(x->>'size',''),'Standard'),
         nullif(x->>'rate','')::numeric, nullif(x->>'price','')::numeric,
         nullif(x->>'mrp','')::numeric,  nullif(x->>'moq','')::int,
         coalesce(nullif(x->>'unit',''),'Piece'), ord
  from _in i join catalog.products pr on pr.slug=i.slug,
  lateral jsonb_array_elements(coalesce(i.p->'variants','[]'::jsonb)) with ordinality as t(x,ord);

  if prune then
    with dead as (select id from catalog.products where slug not in (select slug from _in)),
         dv as (delete from catalog.variants v using dead d where v.product_id = d.id returning 1)
    delete from catalog.products p using dead d where p.id = d.id;
    get diagnostics gone = row_count;
  end if;

  return query
    select (select count(*)::int from catalog.products),
           (select count(*)::int from catalog.variants),
           (select count(*)::int from catalog.products) - before + gone, gone;
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS
--
-- security_invoker is set where a view reads a table whose SELECT policy must
-- still apply through it. Without it a view owned by postgres hands the whole
-- table to anyone who can select from the view.
-- ═══════════════════════════════════════════════════════════════════════════

-- The catalogue, shaped exactly like a data.json row so the front end needs no
-- translation. price falls back to products.price for the four products that
-- carry a rate with no size rows at all.
create or replace view catalog.catalogue as
 SELECT p.images[1] AS img, p.images AS imgs, p.name,
    b.name AS brand, c.name AS cat, p.sub,
    p.descr AS "desc", p.spec, p.code, p.gst, p.note,
    p.alias, p.hsn, p.mrp, p.sr, p.unit, p.moq,
    COALESCE(( SELECT min(v.price) AS min
           FROM catalog.variants v
          WHERE (v.product_id = p.id)), p.price) AS price,
    COALESCE(( SELECT json_agg(json_build_object('size', v.size, 'rate', v.rate, 'price', v.price, 'mrp', v.mrp, 'moq', v.moq, 'unit', v.unit) ORDER BY v.sort, v.id) AS json_agg
           FROM catalog.variants v
          WHERE (v.product_id = p.id)), '[]'::json) AS variants,
    p.stock, p.hotel, p.featured AS feat, p.legacy_sizes AS sizes,
    p.slug, p.hidden
   FROM ((catalog.products p
     LEFT JOIN catalog.brands b ON ((b.id = p.brand_id)))
     LEFT JOIN catalog.categories c ON ((c.id = p.category_id)))
  ORDER BY p.id;

-- The queue, already filtered to what the caller may act on, and carrying the
-- display name so the app does not re-implement that rule.
create or replace view catalog.approval_queue as
 SELECT id, phone, kind, status, created_at,
    catalog.display_name(nickname, business_name, name, area) AS display,
    name, nickname, business_name, area, city, address,
    gst, gst_status, dept, owner_phone, note,
    decided_at, decided_by, decided_note
   FROM catalog.signup_requests s
  WHERE catalog.can_approve(kind)
  ORDER BY (status = 'pending'::text) DESC, created_at DESC;

-- Routed by department, not broadcast to everyone.
create or replace view catalog.my_notifications as
 SELECT n.id, n.kind, n.title, n.body, n.ref_id, n.created_at,
    (rd.phone IS NOT NULL) AS is_read
   FROM ((catalog.notifications n
     JOIN catalog.notification_targets t ON ((t.notification_id = n.id)))
     LEFT JOIN catalog.notification_reads rd ON (((rd.notification_id = n.id) AND (rd.phone = catalog.my_phone()))))
  WHERE (((t.role = 'admin'::text) AND catalog.is_admin()) OR ((t.role = 'staff'::text) AND (catalog.my_role() = 'staff'::text) AND ((t.dept = '*'::text) OR (t.dept = ( SELECT a.dept
           FROM catalog.allowlist a
          WHERE (a.phone = catalog.my_phone()))))))
  ORDER BY n.created_at DESC;

create or replace view catalog.order_summary as
 SELECT id, ref, customer_phone, placed_by, taken_by_office, status, note, total,
    created_at, updated_at, needs_approval, approval_reason, approved_at, approved_by,
    COALESCE(NULLIF(customer_name, ''::text), customer_phone) AS customer,
    ( SELECT count(*) AS count FROM catalog.order_items i WHERE (i.order_id = o.id)) AS lines,
    ( SELECT COALESCE(sum(i.qty), (0)::bigint) AS "coalesce"
        FROM catalog.order_items i WHERE (i.order_id = o.id)) AS pieces
   FROM catalog.orders o;

create or replace view catalog.order_customers as
 SELECT phone,
    COALESCE(NULLIF(nickname, ''::text), NULLIF(shop, ''::text), NULLIF(name, ''::text), phone) AS name,
    NULLIF(shop, ''::text) AS shop, role, dealer_type,
    NULLIF(city, ''::text) AS city, photo_url
   FROM catalog.allowlist a
  WHERE (catalog.can_edit_catalogue() AND (role = ANY (ARRAY['dealer'::text, 'shop_owner'::text, 'end_customer'::text])));

-- A retail dealer appears here only once a city is set, so the city doubles as
-- the opt-in to being listed to consumers.
create or replace view catalog.dealer_directory as
 SELECT phone,
    COALESCE(NULLIF(shop, ''::text), NULLIF(name, ''::text), 'Shop'::text) AS shop,
    city,
    (EXISTS ( SELECT 1 FROM catalog.follows f
          WHERE ((f.dealer_phone = a.phone) AND (f.customer_phone = catalog.my_phone())))) AS following
   FROM catalog.allowlist a
  WHERE ((role = ANY (ARRAY['dealer'::text, 'shop_owner'::text])) AND (COALESCE(dealer_type, 'retailer'::text) = 'retailer'::text) AND (NULLIF(city, ''::text) IS NOT NULL));

create or replace view catalog.product_rating_summary as
 SELECT product_slug, (count(*))::integer AS reviews, round(avg(rating), 1) AS rating
   FROM catalog.product_reviews
  WHERE (NOT hidden)
  GROUP BY product_slug;

-- Only a first name and a city — a review must not publish a phone number.
create or replace view catalog.product_reviews_public as
 SELECT r.product_slug, r.rating, r.body, r.created_at,
    COALESCE(NULLIF(split_part(COALESCE(a.name, ''::text), ' '::text, 1), ''::text), 'A customer'::text) AS author,
    NULLIF(a.city, ''::text) AS city,
    (r.phone = catalog.my_phone()) AS mine
   FROM (catalog.product_reviews r
     LEFT JOIN catalog.allowlist a ON ((a.phone = r.phone)))
  WHERE (NOT r.hidden);

-- The searches that found nothing, most-asked first. This is the events
-- table's reason for existing: each row is a product somebody wanted that we
-- either do not stock, or stock under a name nobody types.
create or replace view catalog.searches_with_nothing as
 SELECT lower(btrim(q)) AS query, count(*) AS times, max(at) AS last_asked
   FROM catalog.events
  WHERE ((kind = 'zero'::text) AND (q IS NOT NULL) AND (btrim(q) <> ''::text))
  GROUP BY (lower(btrim(q)))
  ORDER BY (count(*)) DESC, (max(at)) DESC;

create or replace view catalog.product_stats as
 SELECT slug AS product, count(*) AS opens, max(at) AS last_seen
   FROM catalog.events
  WHERE ((kind = 'open'::text) AND (slug IS NOT NULL))
  GROUP BY slug;

alter view catalog.searches_with_nothing set (security_invoker = on);
alter view catalog.product_stats         set (security_invoker = on);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY — 39 policies
--
-- This is the part that actually keeps one dealer out of another dealer's
-- customer list. The admin panel hiding a tab is presentation; these are the
-- rule. Read them before changing them.
--
-- Note what has NO write policy at all: orders (INSERT), signup_requests,
-- notifications, notification_targets. Those tables are written only through
-- SECURITY DEFINER functions, which is what stops a phone being spoofed or a
-- decision forged.
-- ═══════════════════════════════════════════════════════════════════════════

alter table catalog.allowlist            enable row level security;
alter table catalog.brands               enable row level security;
alter table catalog.categories           enable row level security;
alter table catalog.products             enable row level security;
alter table catalog.variants             enable row level security;
alter table catalog.orders               enable row level security;
alter table catalog.order_items          enable row level security;
alter table catalog.notices              enable row level security;
alter table catalog.follows              enable row level security;
alter table catalog.shop_offers          enable row level security;
alter table catalog.stock_listings       enable row level security;
alter table catalog.product_reviews      enable row level security;
alter table catalog.events               enable row level security;
alter table catalog.departments          enable row level security;
alter table catalog.signup_requests      enable row level security;
alter table catalog.notify_routes        enable row level security;
alter table catalog.notifications        enable row level security;
alter table catalog.notification_targets enable row level security;
alter table catalog.notification_reads   enable row level security;

-- ── allowlist: the identity table ──────────────────────────────────────────
-- Note there are TWO select policies. Everyone reads their own row; an admin
-- reads them all. A client doing an unfiltered select().maybeSingle() as an
-- admin therefore gets "multiple rows returned" and reads it as "not on the
-- list" — always filter by the caller's own phone.
create policy "read own allowlist row" on catalog.allowlist for SELECT to authenticated using ((phone = replace(COALESCE((auth.jwt() ->> 'phone'::text), ''::text), '+'::text, ''::text)));
create policy "admins may write allowlist" on catalog.allowlist for ALL to authenticated using (catalog.is_admin()) with check (catalog.is_admin());
create policy "dealers manage their own end customers" on catalog.allowlist for ALL to authenticated using (((role = 'end_customer'::text) AND (owner_phone = catalog.my_phone()) AND catalog.is_dealer())) with check (((role = 'end_customer'::text) AND (owner_phone = catalog.my_phone()) AND catalog.is_dealer()));
create policy "end customers read the dealers they follow" on catalog.allowlist for SELECT to authenticated using (((role = ANY (ARRAY['dealer'::text, 'shop_owner'::text])) AND (phone IN ( SELECT catalog.my_dealer_phones() AS my_dealer_phones))));

-- ── the catalogue: public to read, office to write ─────────────────────────
create policy "public read brands" on catalog.brands for SELECT to public using (true);
create policy "admins and staff may write brands" on catalog.brands for ALL to authenticated using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());
create policy "public read categories" on catalog.categories for SELECT to public using (true);
create policy "admins and staff may write categories" on catalog.categories for ALL to authenticated using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());
create policy "public read products" on catalog.products for SELECT to public using (true);
create policy "admins and staff may write products" on catalog.products for ALL to authenticated using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());
create policy "public read variants" on catalog.variants for SELECT to public using (true);
create policy "admins and staff may write variants" on catalog.variants for ALL to authenticated using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());

-- ── orders: no INSERT policy — place_order() is the only door ──────────────
create policy "see your own orders" on catalog.orders for SELECT to authenticated using ((catalog.can_edit_catalogue() OR (customer_phone = catalog.my_phone()) OR (placed_by = catalog.my_phone())));
create policy "office works the order book" on catalog.orders for UPDATE to authenticated using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());
create policy "see items of orders you can see" on catalog.order_items for SELECT to authenticated using (catalog.can_see_order(order_id));

-- ── noticeboard: live, in-window, and addressed to your role ───────────────
create policy "read live notices for you" on catalog.notices for SELECT to anon, authenticated using ((catalog.can_edit_catalogue() OR (active AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now())) AND ((audience = 'all'::text) OR ((audience = 'dealer'::text) AND catalog.is_dealer()) OR ((audience = 'end_customer'::text) AND (catalog.my_role() = 'end_customer'::text)) OR ((audience = 'staff'::text) AND catalog.can_edit_catalogue())))));
create policy "office writes notices" on catalog.notices for ALL to authenticated using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());

-- ── follows and shop offers ────────────────────────────────────────────────
create policy "customers manage their own follows" on catalog.follows for ALL to authenticated using ((customer_phone = catalog.my_phone())) with check (((customer_phone = catalog.my_phone()) AND catalog.is_listed_dealer(dealer_phone)));
create policy "dealers see who follows them" on catalog.follows for SELECT to authenticated using (((dealer_phone = catalog.my_phone()) OR catalog.is_admin()));
create policy "dealers manage their own offers" on catalog.shop_offers for ALL to authenticated using (((shop_phone = catalog.my_phone()) AND catalog.is_dealer())) with check (((shop_phone = catalog.my_phone()) AND catalog.is_dealer()));
create policy "end customers read the offers of dealers they follow" on catalog.shop_offers for SELECT to authenticated using (((shop_phone IN ( SELECT catalog.my_dealer_phones() AS my_dealer_phones)) OR catalog.is_admin()));

-- ── the stock exchange: dealers only ───────────────────────────────────────
create policy "traders read listings" on catalog.stock_listings for SELECT to authenticated using (catalog.can_trade());
create policy "traders create own listings" on catalog.stock_listings for INSERT to authenticated with check ((catalog.can_trade() AND (dealer_phone = catalog.my_phone())));
create policy "traders manage own listings" on catalog.stock_listings for UPDATE to authenticated using (((dealer_phone = catalog.my_phone()) OR catalog.is_admin())) with check (((dealer_phone = catalog.my_phone()) OR catalog.is_admin()));
create policy "traders delete own listings" on catalog.stock_listings for DELETE to authenticated using (((dealer_phone = catalog.my_phone()) OR catalog.is_admin()));

-- ── reviews: you write your own, an admin hides any ────────────────────────
-- The public read path is the product_reviews_public view, not this table.
-- "NOT hidden" in the write policy is what stops someone un-hiding their own
-- moderated review.
create policy "read own review" on catalog.product_reviews for SELECT to authenticated using (((phone = catalog.my_phone()) OR catalog.is_admin()));
create policy "write own review" on catalog.product_reviews for ALL to authenticated using (((phone = catalog.my_phone()) AND (catalog.my_role() <> 'guest'::text) AND (NOT hidden))) with check (((phone = catalog.my_phone()) AND (catalog.my_role() <> 'guest'::text) AND (NOT hidden)));
create policy "admins moderate reviews" on catalog.product_reviews for ALL to authenticated using (catalog.is_admin()) with check (catalog.is_admin());

-- ── events: append-only to everyone ────────────────────────────────────────
-- Anyone may INSERT; only the office may SELECT; there is no UPDATE or DELETE
-- policy at all. A browsing log one dealer can read back is a different and
-- worse thing than a browsing log.
create policy "anyone may log an event" on catalog.events for INSERT to anon, authenticated with check (true);
create policy "admin and staff may read events" on catalog.events for SELECT to authenticated using (catalog.can_edit_catalogue());

-- ── departments and routing: readable by all, written by an admin ──────────
create policy "dept_read" on catalog.departments for SELECT to authenticated using (true);
create policy "dept_write" on catalog.departments for ALL to authenticated using (catalog.is_admin()) with check (catalog.is_admin());
create policy "nr_read" on catalog.notify_routes for SELECT to authenticated using (true);
create policy "nr_write" on catalog.notify_routes for ALL to authenticated using (catalog.is_admin()) with check (catalog.is_admin());

-- ── signup requests: read your own, or the kinds you may decide ────────────
create policy "sr_read_own" on catalog.signup_requests for SELECT to authenticated using ((phone = catalog.my_phone()));
create policy "sr_read_decider" on catalog.signup_requests for SELECT to authenticated using (catalog.can_approve(kind));

-- ── notifications: read through my_notifications, base tables stay closed ──
create policy "ntf_read" on catalog.notifications for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM catalog.notification_targets t
  WHERE ((t.notification_id = notifications.id) AND (((t.role = 'admin'::text) AND catalog.is_admin()) OR ((t.role = 'staff'::text) AND (catalog.my_role() = 'staff'::text) AND ((t.dept = '*'::text) OR (t.dept = ( SELECT a.dept
           FROM catalog.allowlist a
          WHERE (a.phone = catalog.my_phone()))))))))));
create policy "ntg_read" on catalog.notification_targets for SELECT to authenticated using ((catalog.is_admin() OR (catalog.my_role() = 'staff'::text)));
create policy "nrd_own" on catalog.notification_reads for ALL to authenticated using ((phone = catalog.my_phone())) with check ((phone = catalog.my_phone()));

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
--
-- RLS decides which rows; these decide whether the table is reachable at all.
-- Both are needed — a policy on a table with no grant still returns 42501.
--
-- Note what anon may do: read the catalogue and the noticeboard, and INSERT an
-- event. anon has INSERT and NOT SELECT on events, which is the point — so the
-- client must not ask for the row back. supabase-js sends return=minimal when
-- .insert() has no .select(); adding .select() there turns every logged event
-- into a 42501.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema catalog to anon, authenticated;

-- The public catalogue.
grant select on catalog.brands, catalog.categories, catalog.products,
                catalog.variants, catalog.catalogue to anon, authenticated;
grant select on catalog.notices, catalog.product_rating_summary,
                catalog.product_reviews_public to anon, authenticated;

grant insert on catalog.events to anon, authenticated;
grant select on catalog.events, catalog.searches_with_nothing,
                catalog.product_stats to authenticated;

grant select on catalog.allowlist, catalog.departments, catalog.notify_routes,
                catalog.signup_requests to authenticated;
grant select on catalog.approval_queue, catalog.my_notifications,
                catalog.dealer_directory, catalog.order_customers,
                catalog.order_summary to authenticated;

grant select on catalog.orders, catalog.order_items to authenticated;
grant update on catalog.orders to authenticated;

grant select, insert, update, delete on catalog.notices          to authenticated;
grant select, insert, update, delete on catalog.shop_offers      to authenticated;
grant select, insert, update, delete on catalog.stock_listings   to authenticated;
grant select, insert, update, delete on catalog.product_reviews  to authenticated;
grant select, insert, delete         on catalog.follows          to authenticated;
grant select, insert                 on catalog.notification_reads to authenticated;

-- notify() must not be callable by a client: it addresses a notification at
-- whoever the routing table says, and nothing else should be able to do that.
revoke all on function catalog.notify(text,text,text,bigint) from public, anon, authenticated;

grant execute on function catalog.my_phone()                          to anon, authenticated;
grant execute on function catalog.my_role()                           to anon, authenticated;
grant execute on function catalog.is_admin()                          to anon, authenticated;
grant execute on function catalog.is_dealer()                         to authenticated;
grant execute on function catalog.is_listed_dealer(text)              to authenticated;
grant execute on function catalog.can_trade()                         to authenticated;
grant execute on function catalog.can_edit_catalogue()                to authenticated;
grant execute on function catalog.can_see_order(bigint)               to authenticated;
grant execute on function catalog.my_owner_phone()                    to authenticated;
grant execute on function catalog.my_dealer_phones()                  to authenticated;
grant execute on function catalog.can_approve(text)                   to authenticated;
grant execute on function catalog.can_approve_any()                   to authenticated;
grant execute on function catalog.display_name(text,text,text,text)   to authenticated;
grant execute on function catalog.mark_notifications_read(bigint[])   to authenticated;
grant execute on function catalog.submit_signup(jsonb)                to authenticated;
grant execute on function catalog.decide_signup(bigint,boolean,text)  to authenticated;
grant execute on function catalog.my_signup_status()                  to authenticated;
grant execute on function catalog.admin_upsert_customer(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function catalog.admin_delete_customer(text)         to authenticated;
grant execute on function catalog.shop_upsert_end_customer(text,text,text,text) to authenticated;
grant execute on function catalog.shop_delete_end_customer(text)      to authenticated;
grant execute on function catalog.self_signup_end_customer(text,text) to authenticated;
grant execute on function catalog.update_my_profile(text,text,text,text) to authenticated;
grant execute on function catalog.set_my_photo(text)                  to authenticated;
grant execute on function catalog.admin_upsert_product(jsonb)         to authenticated;
grant execute on function catalog.admin_delete_product(text)          to authenticated;
grant execute on function catalog.place_order(text,text,jsonb)        to authenticated;
grant execute on function catalog.set_order_status(text,text)         to authenticated;
grant execute on function catalog.request_approval(text,text)         to authenticated;
grant execute on function catalog.approve_order(text,boolean)         to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- POSTGREST MUST EXPOSE THIS SCHEMA
--
-- Everything above lives in `catalog`, not `public`, and PostgREST only serves
-- schemas listed in db-schemas. Adding the schema is not enough on its own —
-- the table cache has to be rebuilt too, and doing only the first is why this
-- once looked unfixed for a whole round.
--
--   PGRST106  the schema itself is not exposed
--   PGRST205  the schema is fine, the table cache is stale
--
-- Set Settings -> API -> Exposed schemas to include `catalog` as well, so the
-- dashboard and the role setting agree — a dashboard change can rewrite
-- db_schemas and drop it, which brings the 404s straight back.
-- ═══════════════════════════════════════════════════════════════════════════

-- alter role authenticator set pgrst.db_schemas = 'public, graphql_public, catalog';
-- notify pgrst, 'reload config';
-- notify pgrst, 'reload schema';
