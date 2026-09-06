-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — 08: the arithmetic, in SQL.
--
-- All of this lived in a Node handler in the prototype. It moves here for
-- three reasons: there is one copy of it, row-level security can be applied to
-- it, and computing a customer's position stops being four queries per
-- customer. That last one is not a micro-optimisation — the old GET /customers
-- ran four finds PER ROW, which is fine at 15 customers and falls over at
-- 1,500.
--
-- TWO BUGS ARE FIXED HERE RATHER THAN CARRIED OVER. Both are described where
-- they are fixed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. The financial year: 1 April to 31 March
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.fy_of(d date) returns int
  language sql immutable as $$
    select case when extract(month from d) >= 4
                then extract(year from d)::int
                else extract(year from d)::int - 1 end;
$$;

create or replace function catalog.fy_start(fy int) returns date
  language sql immutable as $$ select make_date(fy, 4, 1); $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Receipt numbers
--
-- One INSERT ... ON CONFLICT DO UPDATE ... RETURNING is a single atomic
-- statement holding a row lock — the same guarantee Mongo's $inc gave, in one
-- round trip. Two collectors writing a receipt at the same moment cannot get
-- the same number.
--
-- April resets itself, because the key contains the year. Deleting never
-- decrements, so a number is never reused.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.next_receipt_no(p_temp boolean default false)
returns text language plpgsql security definer
set search_path to 'catalog','public' as $$
declare fy int := catalog.fy_of(current_date); k text; n bigint;
begin
  k := case when p_temp then 'mob_temp' else 'mob_' || fy end;
  insert into catalog.voucher_sequence (key, fy, counter) values (k, fy, 1)
  on conflict (key) do update set counter = catalog.voucher_sequence.counter + 1
  returning counter into n;
  return case when p_temp then 'Mob/temp/' || n else 'Mob/' || n end;
end; $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Aging — FIFO
--
-- ⚠ BUG FIXED HERE. The prototype walked the invoices and then `break`ed on
-- the first one, so only the EARLIEST invoice ever raised was considered, and
-- aging was measured from the oldest bill RAISED rather than the oldest bill
-- UNPAID. A dealer who had traded for two years and paid on time every month
-- showed 900 days and a Critical flag the moment any balance existed at all.
-- The flag was therefore worthless: it fired on the best customers.
--
-- The fix is to allocate money to the oldest bills first, and age from the
-- oldest bill the money has not reached. That is one window function.
--
-- Only CLEARED payments count. A post-dated cheque sitting in a drawer has not
-- paid anything yet, and neither has a bounced one.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.customer_aging(p_phone text)
returns table (oldest_open_date date, open_amount numeric)
language sql stable security definer
set search_path to 'catalog','public' as $$
  with items as (
    -- The opening balance behaves as a bill dated 1 April.
    select coalesce(a.opening_as_of,
                    catalog.fy_start(catalog.fy_of(current_date)))::date as d,
           a.opening_balance as amt
      from catalog.allowlist a
     where a.phone = p_phone and a.opening_balance > 0
    union all
    select i.date, i.amount from catalog.invoices i where i.customer_phone = p_phone
  ),
  paid as (
    select coalesce((select sum(amount) from catalog.payments
                      where customer_phone = p_phone and status = 'approved'
                        and (mode <> 'cheque' or cheque_status = 'cleared')), 0)
         + coalesce((select sum(amount) from catalog.adjustments
                      where customer_phone = p_phone and status = 'approved'), 0) as c
  ),
  running as (
    select d, amt,
           sum(amt) over (order by d, amt rows unbounded preceding) as cum
      from items
  )
  select min(d),
         sum(least(amt, greatest(cum - (select c from paid), 0)))
    from running
   where cum > (select c from paid);
$$;

-- The buckets. Display only — Critical warns, it never blocks a sale. That was
-- the explicit instruction, and it is why this returns a label rather than a
-- boolean anything could gate on.
create or replace function catalog.aging_tier(p_days int, p_out numeric)
returns text language sql immutable as $$
  select case when coalesce(p_out,0) <= 0 then 'On Track'
              when p_days <=  60 then 'On Track'
              when p_days <=  75 then 'Due Soon'
              when p_days <= 120 then 'Please Clear'
              when p_days <= 180 then 'Overdue'
              else 'Critical' end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Where every customer stands — ONE query, not four per customer
-- ───────────────────────────────────────────────────────────────────────────
create or replace view catalog.customer_balances as
with inv as (
  select customer_phone, sum(amount) amt from catalog.invoices group by 1),
adj as (
  select customer_phone, sum(amount) amt from catalog.adjustments
   where status = 'approved' group by 1),
pay as (
  select customer_phone,
         sum(amount) filter (where mode <> 'cheque' or cheque_status = 'cleared') as cleared,
         sum(amount) filter (where mode  = 'cheque' and cheque_status = 'pending') as pdc
    from catalog.payments where status = 'approved' group by 1)
select a.phone as customer_phone,
       catalog.display_name(a.nickname, a.shop, a.name, a.area) as display,
       a.area, a.area_id, a.credit_limit, a.reminder_only,
       a.opening_balance,
       coalesce(inv.amt, 0)     as invoiced,
       coalesce(adj.amt, 0)     as adjusted,
       coalesce(pay.cleared, 0) as received,
       -- Post-dated cheques are shown SEPARATELY and never net off the
       -- outstanding. Money you have been promised is not money you have.
       coalesce(pay.pdc, 0)     as pdc_pending,
       a.opening_balance + coalesce(inv.amt,0)
         - coalesce(adj.amt,0) - coalesce(pay.cleared,0)  as outstanding,
       ag.oldest_open_date,
       greatest(0, current_date - ag.oldest_open_date)     as aging_days,
       catalog.aging_tier(
         greatest(0, current_date - ag.oldest_open_date),
         a.opening_balance + coalesce(inv.amt,0)
           - coalesce(adj.amt,0) - coalesce(pay.cleared,0)) as aging_tier
  from catalog.allowlist a
  left join inv on inv.customer_phone = a.phone
  left join adj on adj.customer_phone = a.phone
  left join pay on pay.customer_phone = a.phone
  left join lateral catalog.customer_aging(a.phone) ag on true
 where a.role in ('dealer','shop_owner');

-- The statement, as a running balance. The printed version and the screen read
-- the SAME rows, so they cannot disagree — the prototype reassembled the print
-- sheet in the browser from four separate arrays.
create or replace view catalog.customer_ledger as
select customer_phone, at, kind, ref, description, debit, credit
  from (
    select a.phone as customer_phone,
           coalesce(a.opening_as_of,
                    catalog.fy_start(catalog.fy_of(current_date)))::date as at,
           'opening'::text as kind, null::text as ref,
           'Opening balance'::text as description,
           a.opening_balance as debit, 0::numeric as credit
      from catalog.allowlist a where a.opening_balance <> 0
    union all
    select i.customer_phone, i.date, 'invoice', i.invoice_no,
           coalesce(i.description, 'Invoice'), i.amount, 0
      from catalog.invoices i
    union all
    select p.customer_phone, p.created_at::date, 'payment', p.receipt_no,
           initcap(p.mode) || coalesce(' · ' || p.bank_name, ''), 0, p.amount
      from catalog.payments p
     where p.status = 'approved' and (p.mode <> 'cheque' or p.cheque_status = 'cleared')
    union all
    select j.customer_phone, j.created_at::date, j.kind, j.receipt_no,
           coalesce(j.reason, initcap(j.kind) || ' note'), 0, j.amount
      from catalog.adjustments j where j.status = 'approved'
  ) rows
 order by customer_phone, at, kind;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Who may see whose money
--
-- Two functions carry the whole rule, in the style catalog.can_approve()
-- already set: the decision is data, not a branch repeated in code.
-- ───────────────────────────────────────────────────────────────────────────

-- True when that shop is on a route currently assigned to me. Take a collector
-- off the route and their access goes with it — there is no second place to
-- remember and no deploy involved.
create or replace function catalog.can_collect(p_phone text)
returns boolean language sql stable security definer
set search_path to 'catalog','public' as $$
  select exists (
    select 1 from catalog.route_members rm
      join catalog.routes r on r.id = rm.route_id
     where rm.customer_phone = p_phone
       and r.staff_phone     = catalog.my_phone()
       and r.status          = 'active');
$$;

create or replace function catalog.can_see_ledger(p_phone text)
returns boolean language sql stable security definer
set search_path to 'catalog','public' as $$
  select p_phone = catalog.my_phone()          -- it is mine
      or catalog.is_admin()                    -- the proprietor
      or (catalog.my_role() = 'staff' and exists (   -- the back office
            select 1 from catalog.allowlist a
             where a.phone = catalog.my_phone()
               and a.dept in ('office_manager','accounts')))
      or catalog.can_collect(p_phone);         -- the collector, on their route
$$;

-- So, in one sentence each:
--   a DEALER matches only the first arm — their own ledger, nobody else's;
--   a COLLECTOR matches only can_collect — the shops on a route assigned to
--     them today, and nothing when they come off it;
--   ACCOUNTS and OFFICE_MANAGER see everyone, because that is a dept value —
--     data, exactly like approve_dealer;
--   SALES, PURCHASE and DELIVERY see nobody's money at all, which is the whole
--     point of departments being data rather than code.

-- ───────────────────────────────────────────────────────────────────────────
-- 6. What a dealer's own screens read. Nothing else reads these.
-- ───────────────────────────────────────────────────────────────────────────
create or replace view catalog.my_balance as
  select * from catalog.customer_balances where customer_phone = catalog.my_phone();

create or replace view catalog.my_ledger as
  select * from catalog.customer_ledger where customer_phone = catalog.my_phone();

create or replace view catalog.my_bills as
  select id, invoice_no, date, amount, description, source, order_ref
    from catalog.invoices where customer_phone = catalog.my_phone()
   order by date desc;

-- "Cheques I have given that are coming up for clearance." The one thing a
-- dealer most wants to know and had no way to see.
create or replace view catalog.my_cheques as
  select receipt_no, amount, bank_name, cheque_no, cheque_date, cheque_status,
         cleared_on, bounced_on
    from catalog.payments
   where customer_phone = catalog.my_phone() and mode = 'cheque'
   order by (cheque_status = 'pending') desc, cheque_date;

create or replace view catalog.my_receipts as
  select receipt_no, created_at, mode, amount, bank_name, cheque_no, cheque_date,
         status, cheque_status
    from catalog.payments
   where customer_phone = catalog.my_phone() and status = 'approved'
   order by created_at desc;

-- security_invoker so each of these runs as its caller and the policies below
-- still apply through them. Without it a view owned by postgres hands the
-- whole table to anyone who can select from the view.
alter view catalog.customer_balances set (security_invoker = on);
alter view catalog.customer_ledger   set (security_invoker = on);
alter view catalog.my_balance        set (security_invoker = on);
alter view catalog.my_ledger         set (security_invoker = on);
alter view catalog.my_bills          set (security_invoker = on);
alter view catalog.my_cheques        set (security_invoker = on);
alter view catalog.my_receipts       set (security_invoker = on);
