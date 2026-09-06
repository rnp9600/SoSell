-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — 09: the doors, and the locks.
--
-- Every write goes through a SECURITY DEFINER function that reads the caller
-- from the JWT rather than from the payload — the rule catalog.submit_signup()
-- already set. The tables below grant no direct INSERT, UPDATE or DELETE at
-- all, so a phone cannot be spoofed and a decision cannot be forged.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Money in
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.record_payment(payload jsonb)
returns text language plpgsql security definer
set search_path to 'catalog','public' as $$
declare
  me    text := catalog.my_phone();
  cust  text := payload->>'customer_phone';
  mode  text := coalesce(payload->>'mode','cash');
  amt   numeric := nullif(payload->>'amount','')::numeric;
  chdt  date := nullif(payload->>'cheque_date','')::date;
  bank  text := nullif(payload->>'bank_name','');
  vis   bigint := nullif(payload->>'visit_id','')::bigint;
  rno   text; st text; chst text; pid bigint;
begin
  if coalesce(me,'') = '' then raise exception 'not signed in'; end if;
  if coalesce(cust,'') = '' then raise exception 'which customer?'; end if;
  if amt is null or amt <= 0 then raise exception 'an amount is needed'; end if;
  if mode not in ('cash','cheque','online') then raise exception 'unknown mode'; end if;

  -- The important one: a dealer can never record their own payment. Only
  -- somebody who may collect from them, or the office, may say money arrived.
  if not (catalog.is_admin()
          or catalog.can_collect(cust)
          or (catalog.my_role() = 'staff' and exists (
                select 1 from catalog.allowlist a
                 where a.phone = me and a.dept in ('office_manager','accounts'))))
  then
    raise exception 'you are not set up to record a payment for that customer';
  end if;

  if mode = 'cheque' then
    if chdt is null then raise exception 'a cheque needs its date'; end if;
    -- Pending until somebody says the bank cleared it. The date says when it
    -- MAY be banked, not that the money arrived.
    chst := 'pending';
  end if;

  -- Online is the only mode nobody watched happen, so it is the only one that
  -- waits for verification.
  st := case when mode = 'online' then 'under_verification' else 'approved' end;
  rno := catalog.next_receipt_no(false);

  insert into catalog.payments
    (receipt_no, fy, customer_phone, collected_by, visit_id, mode, amount,
     cheque_no, cheque_date, bank_name, utr, remarks, status, cheque_status,
     approved_by, approved_at)
  values
    (rno, catalog.fy_of(current_date), cust, me, vis, mode, amt,
     nullif(payload->>'cheque_no',''), chdt, bank, nullif(payload->>'utr',''),
     nullif(payload->>'remarks',''), st, chst,
     case when st = 'approved' then me end,
     case when st = 'approved' then now() end)
  returning id into pid;

  -- A shop usually pays from the same bank, so remember it for the next form.
  if mode = 'cheque' and bank is not null then
    update catalog.allowlist set last_cheque_bank = bank where phone = cust;
  end if;

  -- Recording a payment against a visit IS the visit outcome.
  if vis is not null then
    update catalog.collection_visits
       set status = 'paid', updated_at = now()
     where id = vis;
  end if;

  perform catalog.notify('payment_recorded', 'Payment recorded',
    rno || ' · Rs. ' || to_char(amt, 'FM99,99,99,990') || ' · ' || mode, pid);

  return rno;
end; $$;

create or replace function catalog.decide_payment(p_id bigint, p_ok boolean, p_note text default null)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
begin
  if not catalog.is_admin() then raise exception 'only an admin decides a payment'; end if;
  if p_ok then
    update catalog.payments
       set status='approved', approved_by=catalog.my_phone(), approved_at=now()
     where id = p_id and status = 'under_verification';
  else
    update catalog.payments
       set status='rejected', rejected_at=now(), reject_reason=p_note
     where id = p_id and status = 'under_verification';
  end if;
  if not found then raise exception 'no payment waiting on that id'; end if;
end; $$;

-- A cheque clears because somebody says so.
create or replace function catalog.clear_cheque(p_id bigint, p_on date default current_date)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
begin
  if not (catalog.is_admin() or exists (
        select 1 from catalog.allowlist a
         where a.phone = catalog.my_phone() and a.dept in ('office_manager','accounts')))
  then raise exception 'only the office clears a cheque'; end if;

  update catalog.payments
     set cheque_status='cleared', cleared_on=p_on, bounced_on=null, bounce_reason=null
   where id = p_id and mode = 'cheque';
  if not found then raise exception 'no cheque with that id'; end if;
end; $$;

-- And a bounced one puts the money BACK on the ledger, which the prototype
-- had no way to express at all.
create or replace function catalog.bounce_cheque(p_id bigint, p_reason text default null)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
declare r catalog.payments;
begin
  if not (catalog.is_admin() or exists (
        select 1 from catalog.allowlist a
         where a.phone = catalog.my_phone() and a.dept in ('office_manager','accounts')))
  then raise exception 'only the office marks a cheque bounced'; end if;

  update catalog.payments
     set cheque_status='bounced', bounced_on=current_date,
         bounce_reason=p_reason, cleared_on=null
   where id = p_id and mode = 'cheque'
  returning * into r;
  if r.id is null then raise exception 'no cheque with that id'; end if;

  perform catalog.notify('cheque_bounced', 'Cheque bounced',
    r.receipt_no || ' · Rs. ' || to_char(r.amount, 'FM99,99,99,990')
      || coalesce(' · ' || p_reason, ''), r.id);
end; $$;

-- Deleting a payment retires its number and keeps the record. The counter is
-- never decremented, so the number is never reused.
create or replace function catalog.void_payment(p_id bigint, p_reason text)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
declare r catalog.payments;
begin
  if not catalog.is_admin() then raise exception 'only an admin voids a payment'; end if;
  select * into r from catalog.payments where id = p_id;
  if r.id is null then raise exception 'no payment with that id'; end if;

  insert into catalog.deleted_vouchers
    (source_table, receipt_no, customer_phone, amount, payload, deleted_by, reason)
  values ('payments', r.receipt_no, r.customer_phone, r.amount,
          to_jsonb(r), catalog.my_phone(), p_reason);

  delete from catalog.payments where id = p_id;
end; $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Credit and discount notes
--
-- Staff raise them with a TEMPORARY number and an admin approves; approval
-- reassigns a real Mob/N, so a pending note can never look like a real one.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.upsert_adjustment(payload jsonb)
returns text language plpgsql security definer
set search_path to 'catalog','public' as $$
declare me text := catalog.my_phone(); admin boolean := catalog.is_admin();
        rno text; aid bigint;
        amt numeric := nullif(payload->>'amount','')::numeric;
        knd text := coalesce(payload->>'kind','credit');
begin
  if coalesce(me,'') = '' then raise exception 'not signed in'; end if;
  if knd not in ('credit','discount') then raise exception 'unknown kind'; end if;
  if amt is null or amt <= 0 then raise exception 'an amount is needed'; end if;
  if not (admin or catalog.my_role() = 'staff') then raise exception 'not allowed'; end if;

  rno := catalog.next_receipt_no(not admin);

  insert into catalog.adjustments
    (customer_phone, kind, amount, reason, receipt_no, status, created_by,
     decided_by, decided_at)
  values (payload->>'customer_phone', knd, amt, nullif(payload->>'reason',''),
          rno, case when admin then 'approved' else 'pending' end, me,
          case when admin then me end, case when admin then now() end)
  returning id into aid;

  if not admin then
    perform catalog.notify('approval_pending', 'A note needs approving',
      initcap(knd) || ' note ' || rno || ' · Rs. '
        || to_char(amt, 'FM99,99,99,990'), aid);
  end if;
  return rno;
end; $$;

create or replace function catalog.decide_adjustment(p_id bigint, p_ok boolean, p_note text default null)
returns text language plpgsql security definer
set search_path to 'catalog','public' as $$
declare rno text;
begin
  if not catalog.is_admin() then raise exception 'only an admin decides a note'; end if;
  if not p_ok then
    update catalog.adjustments
       set status='rejected', decided_by=catalog.my_phone(), decided_at=now(),
           decided_note=p_note
     where id = p_id and status = 'pending';
    if not found then raise exception 'no note waiting on that id'; end if;
    return null;
  end if;

  -- A real number, replacing the temporary one.
  rno := catalog.next_receipt_no(false);
  update catalog.adjustments
     set status='approved', receipt_no=rno, decided_by=catalog.my_phone(),
         decided_at=now(), decided_note=p_note
   where id = p_id and status = 'pending';
  if not found then raise exception 'no note waiting on that id'; end if;
  return rno;
end; $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Bills
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.upsert_invoice(payload jsonb)
returns bigint language plpgsql security definer
set search_path to 'catalog','public' as $$
declare me text := catalog.my_phone(); iid bigint := nullif(payload->>'id','')::bigint;
        existing catalog.invoices;
begin
  if not (catalog.is_admin() or exists (
        select 1 from catalog.allowlist a
         where a.phone = me and a.dept in ('office_manager','accounts')))
  then raise exception 'not allowed to raise a bill'; end if;

  if iid is not null then
    select * into existing from catalog.invoices where id = iid;
    if existing.id is null then raise exception 'no invoice with that id'; end if;
    -- The rule the prototype documented and never checked once.
    if existing.source <> 'app' then
      raise exception 'that bill came from Busy and is read-only here';
    end if;
    update catalog.invoices
       set invoice_no  = nullif(payload->>'invoice_no',''),
           date        = coalesce(nullif(payload->>'date','')::date, date),
           amount      = coalesce(nullif(payload->>'amount','')::numeric, amount),
           description = nullif(payload->>'description',''),
           edited      = true, updated_at = now(), updated_by = me
     where id = iid;
    return iid;
  end if;

  insert into catalog.invoices
    (customer_phone, invoice_no, date, amount, description, source, order_ref, created_by)
  values (payload->>'customer_phone', nullif(payload->>'invoice_no',''),
          coalesce(nullif(payload->>'date','')::date, current_date),
          nullif(payload->>'amount','')::numeric,
          nullif(payload->>'description',''),
          coalesce(nullif(payload->>'source',''),'app'),
          nullif(payload->>'order_ref',''), me)
  returning id into iid;
  return iid;
end; $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. The day sheet
-- ───────────────────────────────────────────────────────────────────────────
create or replace function catalog.start_collection(p_route bigint)
returns bigint language plpgsql security definer
set search_path to 'catalog','public' as $$
declare me text := catalog.my_phone(); cid bigint; r catalog.routes;
begin
  select * into r from catalog.routes where id = p_route;
  if r.id is null then raise exception 'no such route'; end if;
  if not (catalog.is_admin() or r.staff_phone = me) then
    raise exception 'that is not your route'; end if;

  -- Idempotent: pressing Start twice on a shaky signal must not open two
  -- day sheets for the same route.
  select id into cid from catalog.collections
   where route_id = p_route and on_date = current_date;
  if cid is not null then return cid; end if;

  insert into catalog.collections (route_id, staff_phone)
  values (p_route, coalesce(r.staff_phone, me))
  returning id into cid;

  insert into catalog.collection_visits (collection_id, customer_phone)
  select cid, rm.customer_phone from catalog.route_members rm
   where rm.route_id = p_route
  on conflict do nothing;

  return cid;
end; $$;

create or replace function catalog.set_visit(
  p_collection bigint, p_customer text, p_status text, p_followup date default null,
  p_note text default null)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
declare c catalog.collections;
begin
  select * into c from catalog.collections where id = p_collection;
  if c.id is null then raise exception 'no such collection'; end if;
  if not (catalog.is_admin() or c.staff_phone = catalog.my_phone()) then
    raise exception 'that is not your route'; end if;
  -- End Route locks the VISIT statuses. Payments deliberately stay allowed:
  -- money that arrives after the sheet is closed is still money.
  if c.status = 'ended' then
    raise exception 'this route has been ended — ask an admin to reopen it'; end if;
  if p_status not in ('not_visited','paid','not_available','refused','skipped') then
    raise exception 'unknown visit status'; end if;

  update catalog.collection_visits
     set status = p_status, followup_date = p_followup, note = p_note, updated_at = now()
   where collection_id = p_collection and customer_phone = p_customer;
  if not found then raise exception 'that customer is not on this sheet'; end if;
end; $$;

create or replace function catalog.end_collection(p_collection bigint)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
declare c catalog.collections;
begin
  select * into c from catalog.collections where id = p_collection;
  if c.id is null then raise exception 'no such collection'; end if;
  if not (catalog.is_admin() or c.staff_phone = catalog.my_phone()) then
    raise exception 'that is not your route'; end if;

  update catalog.collections set status='ended', ended_at=now() where id = p_collection;
  perform catalog.notify('route_completed', 'Route ended',
    'Route ' || c.route_id || ' ended for ' || c.on_date, p_collection);
end; $$;

create or replace function catalog.request_reopen(p_collection bigint)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
begin
  update catalog.collections set reopen_requested_at = now()
   where id = p_collection and status = 'ended';
  if not found then raise exception 'that route is not ended'; end if;
  perform catalog.notify('reopen_request', 'Someone wants a route reopened',
    'Collection ' || p_collection, p_collection);
end; $$;

create or replace function catalog.approve_reopen(p_collection bigint)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
begin
  if not catalog.is_admin() then raise exception 'only an admin reopens a route'; end if;
  update catalog.collections
     set status='active', ended_at=null, reopen_requested_at=null,
         reopen_approved_at=now(), reopen_approved_by=catalog.my_phone()
   where id = p_collection;
  if not found then raise exception 'no such collection'; end if;
end; $$;
