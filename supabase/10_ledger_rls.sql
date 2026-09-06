-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — 10: row-level security for the ledger.
--
-- This file is the access control. Not the screens — a screen that hides a tab
-- is presentation, and the database is the rule. Read it before changing it.
--
-- Note what has NO write policy at all: invoices, payments, adjustments,
-- collections, collection_visits, voucher_sequence, deleted_vouchers. Those
-- are written only through the SECURITY DEFINER functions in file 09, which is
-- what stops a phone being spoofed, a receipt number being chosen, or an
-- approval being forged.
-- ═══════════════════════════════════════════════════════════════════════════

alter table catalog.areas             enable row level security;
alter table catalog.invoices          enable row level security;
alter table catalog.payments          enable row level security;
alter table catalog.adjustments       enable row level security;
alter table catalog.voucher_sequence  enable row level security;
alter table catalog.deleted_vouchers  enable row level security;
alter table catalog.routes            enable row level security;
alter table catalog.route_members     enable row level security;
alter table catalog.collections       enable row level security;
alter table catalog.collection_visits enable row level security;
alter table catalog.staff_schedules   enable row level security;
alter table catalog.issues            enable row level security;

-- ── areas: everyone signed in may read; the office maintains them ──────────
drop policy if exists areas_read on catalog.areas;
create policy areas_read on catalog.areas
  for select to authenticated using (true);
drop policy if exists areas_write on catalog.areas;
create policy areas_write on catalog.areas
  for all to authenticated
  using (catalog.can_edit_catalogue()) with check (catalog.can_edit_catalogue());

-- ── the money: one function decides, and it decides everywhere ─────────────
-- A dealer sees their own rows and nobody else's. A collector sees the shops
-- on a route assigned to them today. Accounts and the office manager see
-- everyone. Sales, purchase and delivery see none of it.
drop policy if exists invoices_read on catalog.invoices;
create policy invoices_read on catalog.invoices
  for select to authenticated using (catalog.can_see_ledger(customer_phone));

drop policy if exists payments_read on catalog.payments;
create policy payments_read on catalog.payments
  for select to authenticated using (catalog.can_see_ledger(customer_phone));

drop policy if exists adjustments_read on catalog.adjustments;
create policy adjustments_read on catalog.adjustments
  for select to authenticated using (catalog.can_see_ledger(customer_phone));

-- ── the bin and the counter: admin only, and read-only even then ───────────
drop policy if exists vouchers_read on catalog.voucher_sequence;
create policy vouchers_read on catalog.voucher_sequence
  for select to authenticated using (catalog.is_admin());

drop policy if exists bin_read on catalog.deleted_vouchers;
create policy bin_read on catalog.deleted_vouchers
  for select to authenticated using (catalog.is_admin());

-- ── routes: your own, or the office's ──────────────────────────────────────
drop policy if exists routes_read on catalog.routes;
create policy routes_read on catalog.routes
  for select to authenticated using (
    catalog.is_admin()
    or staff_phone = catalog.my_phone()
    or exists (select 1 from catalog.allowlist a
                where a.phone = catalog.my_phone()
                  and a.dept in ('office_manager','collection')));

drop policy if exists routes_write on catalog.routes;
create policy routes_write on catalog.routes
  for all to authenticated
  using (catalog.is_admin()
         or exists (select 1 from catalog.allowlist a
                     where a.phone = catalog.my_phone() and a.dept = 'office_manager'))
  with check (catalog.is_admin()
         or exists (select 1 from catalog.allowlist a
                     where a.phone = catalog.my_phone() and a.dept = 'office_manager'));

drop policy if exists route_members_read on catalog.route_members;
create policy route_members_read on catalog.route_members
  for select to authenticated using (
    catalog.is_admin()
    or customer_phone = catalog.my_phone()
    or exists (select 1 from catalog.routes r
                where r.id = route_members.route_id
                  and r.staff_phone = catalog.my_phone())
    or exists (select 1 from catalog.allowlist a
                where a.phone = catalog.my_phone()
                  and a.dept in ('office_manager','collection')));

drop policy if exists route_members_write on catalog.route_members;
create policy route_members_write on catalog.route_members
  for all to authenticated
  using (catalog.is_admin()
         or exists (select 1 from catalog.allowlist a
                     where a.phone = catalog.my_phone() and a.dept = 'office_manager'))
  with check (catalog.is_admin()
         or exists (select 1 from catalog.allowlist a
                     where a.phone = catalog.my_phone() and a.dept = 'office_manager'));

-- ── the day sheet: the collector who is running it, plus the office ────────
drop policy if exists collections_read on catalog.collections;
create policy collections_read on catalog.collections
  for select to authenticated using (
    catalog.is_admin()
    or staff_phone = catalog.my_phone()
    or exists (select 1 from catalog.allowlist a
                where a.phone = catalog.my_phone()
                  and a.dept in ('office_manager','collection','accounts')));

-- A shop may see its own visit — when someone came, and what happened.
drop policy if exists visits_read on catalog.collection_visits;
create policy visits_read on catalog.collection_visits
  for select to authenticated using (
    customer_phone = catalog.my_phone()
    or catalog.is_admin()
    or exists (select 1 from catalog.collections c
                where c.id = collection_visits.collection_id
                  and c.staff_phone = catalog.my_phone())
    or exists (select 1 from catalog.allowlist a
                where a.phone = catalog.my_phone()
                  and a.dept in ('office_manager','collection','accounts')));

drop policy if exists schedules_read on catalog.staff_schedules;
create policy schedules_read on catalog.staff_schedules
  for select to authenticated using (
    staff_phone = catalog.my_phone() or catalog.is_admin()
    or exists (select 1 from catalog.allowlist a
                where a.phone = catalog.my_phone()
                  and a.dept in ('office_manager','collection')));

drop policy if exists schedules_write on catalog.staff_schedules;
create policy schedules_write on catalog.staff_schedules
  for all to authenticated
  using (catalog.is_admin()
         or exists (select 1 from catalog.allowlist a
                     where a.phone = catalog.my_phone() and a.dept = 'office_manager'))
  with check (catalog.is_admin()
         or exists (select 1 from catalog.allowlist a
                     where a.phone = catalog.my_phone() and a.dept = 'office_manager'));

-- ── issues: raise one about your own entries; the office resolves ──────────
drop policy if exists issues_read on catalog.issues;
create policy issues_read on catalog.issues
  for select to authenticated using (
    raised_by = catalog.my_phone()
    or customer_phone = catalog.my_phone()
    or catalog.is_admin()
    or catalog.my_role() = 'staff');

drop policy if exists issues_raise on catalog.issues;
create policy issues_raise on catalog.issues
  for insert to authenticated
  with check (raised_by = catalog.my_phone()
              and (customer_phone is null
                   or catalog.can_see_ledger(customer_phone)));

drop policy if exists issues_resolve on catalog.issues;
create policy issues_resolve on catalog.issues
  for update to authenticated
  using (catalog.is_admin() or catalog.my_role() = 'staff')
  with check (catalog.is_admin() or catalog.my_role() = 'staff');

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANTS
--
-- RLS decides which rows; grants decide whether the table is reachable at all.
-- A policy on a table with no grant still returns 42501.
-- ═══════════════════════════════════════════════════════════════════════════
grant select on catalog.areas, catalog.invoices, catalog.payments,
                catalog.adjustments, catalog.routes, catalog.route_members,
                catalog.collections, catalog.collection_visits,
                catalog.staff_schedules, catalog.issues,
                catalog.voucher_sequence, catalog.deleted_vouchers
  to authenticated;

grant insert, update, delete on catalog.areas          to authenticated;
grant insert, update, delete on catalog.routes         to authenticated;
grant insert, update, delete on catalog.route_members  to authenticated;
grant insert, update, delete on catalog.staff_schedules to authenticated;
grant insert, update          on catalog.issues        to authenticated;

grant select on catalog.customer_balances, catalog.customer_ledger,
                catalog.my_balance, catalog.my_ledger, catalog.my_bills,
                catalog.my_cheques, catalog.my_receipts
  to authenticated;

-- next_receipt_no is called BY the functions below, never by a client — a
-- caller who could burn numbers could make the ledger unauditable.
revoke all on function catalog.next_receipt_no(boolean) from public, anon, authenticated;

grant execute on function catalog.fy_of(date)                          to authenticated;
grant execute on function catalog.fy_start(int)                        to authenticated;
grant execute on function catalog.aging_tier(int, numeric)             to authenticated;
grant execute on function catalog.customer_aging(text)                 to authenticated;
grant execute on function catalog.can_collect(text)                    to authenticated;
grant execute on function catalog.can_see_ledger(text)                 to authenticated;
grant execute on function catalog.record_payment(jsonb)                to authenticated;
grant execute on function catalog.decide_payment(bigint, boolean, text) to authenticated;
grant execute on function catalog.clear_cheque(bigint, date)           to authenticated;
grant execute on function catalog.bounce_cheque(bigint, text)          to authenticated;
grant execute on function catalog.void_payment(bigint, text)           to authenticated;
grant execute on function catalog.upsert_adjustment(jsonb)             to authenticated;
grant execute on function catalog.decide_adjustment(bigint, boolean, text) to authenticated;
grant execute on function catalog.upsert_invoice(jsonb)                to authenticated;
grant execute on function catalog.start_collection(bigint)             to authenticated;
grant execute on function catalog.set_visit(bigint, text, text, date, text) to authenticated;
grant execute on function catalog.end_collection(bigint)               to authenticated;
grant execute on function catalog.request_reopen(bigint)               to authenticated;
grant execute on function catalog.approve_reopen(bigint)               to authenticated;
