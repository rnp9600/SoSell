-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — 12: reaching people.
--
-- ✅ APPLIED 2026-09-06 as migration `sosell_12_notifications_and_push`.
--
-- This EXTENDS the notification machine that already works rather than
-- replacing it. catalog.notify_routes still decides who hears about a
-- sign-up, and a delivery driver still is not told about a dealer
-- application. What is added is the ability to address a NAMED PERSON — which
-- is the one thing missing that made a dealer unreachable, and therefore the
-- one line that turns "notify the office" into "send a message to anyone".
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists catalog.notification_recipients (
  notification_id bigint not null references catalog.notifications(id) on delete cascade,
  phone           text   not null references catalog.allowlist(phone),
  primary key (notification_id, phone)
);

alter table catalog.notifications
  add column if not exists audience     text not null default 'route',
  add column if not exists sent_by      text references catalog.allowlist(phone),
  add column if not exists url          text,
  add column if not exists template_key text;

do $$ begin
  alter table catalog.notifications add constraint notifications_audience_ck
    check (audience in ('route','people','role','dept','all'));
exception when duplicate_object then null; end $$;

-- The prototype let an admin edit eighteen templates and then never read one
-- when sending — every notify() call passed a hardcoded string. Templates
-- were an editable screen with no effect. render_template() below is what
-- finally makes them do something.
create table if not exists catalog.notification_templates (
  key        text primary key,
  title      text not null,
  body       text not null,
  channel    text not null default 'inapp' check (channel in ('inapp','push','whatsapp')),
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists catalog.push_subscriptions (
  id         bigint generated always as identity primary key,
  phone      text not null references catalog.allowlist(phone),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failures   int not null default 0
);
create index if not exists push_subs_phone on catalog.push_subscriptions (phone);

-- Delivery is a queue rather than a fetch inside the send, so a slow or dead
-- endpoint cannot make the composer hang, and a failed push can be retried.
create table if not exists catalog.push_outbox (
  id              bigint generated always as identity primary key,
  notification_id bigint not null references catalog.notifications(id) on delete cascade,
  phone           text not null,
  status          text not null default 'queued'
                    check (status in ('queued','sent','failed','gone')),
  attempts        int not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index if not exists push_outbox_queued on catalog.push_outbox (status, created_at);

-- So a 200-day customer is not told the same thing every single morning.
create table if not exists catalog.reminder_log (
  customer_phone text not null,
  rung           int  not null,
  fy             int  not null,
  sent_at        timestamptz not null default now(),
  primary key (customer_phone, rung, fy)
);

create or replace function catalog.render_template(p_key text, p_vars jsonb)
returns table (title text, body text)
language plpgsql stable security definer
set search_path to 'catalog','public' as $$
declare t catalog.notification_templates; k text; ttl text; bdy text;
begin
  select * into t from catalog.notification_templates where key = p_key and active;
  if t.key is null then return; end if;
  ttl := t.title; bdy := t.body;
  for k in select jsonb_object_keys(coalesce(p_vars, '{}'::jsonb)) loop
    ttl := replace(ttl, '{' || k || '}', coalesce(p_vars->>k, ''));
    bdy := replace(bdy, '{' || k || '}', coalesce(p_vars->>k, ''));
  end loop;
  return query select ttl, bdy;
end; $$;

-- p_phones NULL falls back to the department routing table, exactly as
-- catalog.notify() does, so both paths remain one mechanism rather than two.
create or replace function catalog.notify_people(
  p_kind text, p_title text, p_body text, p_url text default null,
  p_phones text[] default null)
returns bigint language plpgsql security definer
set search_path to 'catalog','public' as $$
declare nid bigint;
begin
  insert into catalog.notifications (kind, title, body, url, audience, sent_by)
  values (p_kind, p_title, p_body, p_url,
          case when p_phones is null then 'route' else 'people' end,
          catalog.my_phone())
  returning id into nid;

  if p_phones is null then
    insert into catalog.notification_targets (notification_id, role, dept)
    select nid, r.role, r.dept from catalog.notify_routes r where r.kind = p_kind
    on conflict do nothing;
  else
    insert into catalog.notification_recipients (notification_id, phone)
    select nid, unnest(p_phones) on conflict do nothing;
    insert into catalog.push_outbox (notification_id, phone)
    select nid, unnest(p_phones);
  end if;
  return nid;
end; $$;

-- The office composer. Pick an audience, resolve it to phones, send once.
create or replace function catalog.send_message(payload jsonb)
returns jsonb language plpgsql security definer
set search_path to 'catalog','public' as $$
declare aud text := coalesce(payload->>'audience','people');
        phones text[]; nid bigint;
begin
  if not catalog.can_edit_catalogue() then
    raise exception 'only the office sends messages'; end if;
  if coalesce(payload->>'title','') = '' then raise exception 'a message needs a heading'; end if;

  phones := case aud
    when 'people' then array(select jsonb_array_elements_text(payload->'phones'))
    when 'role'   then array(select a.phone from catalog.allowlist a where a.role = payload->>'role')
    when 'dept'   then array(select a.phone from catalog.allowlist a where a.dept = payload->>'dept')
    when 'route'  then array(select rm.customer_phone from catalog.route_members rm
                              where rm.route_id = (payload->>'route_id')::bigint)
    when 'all'    then array(select a.phone from catalog.allowlist a)
    else null end;

  -- Sending to nobody is almost always a mistake with the picker, not an
  -- intention, so it fails rather than quietly succeeding.
  if phones is null or array_length(phones,1) is null then
    raise exception 'that audience is nobody';
  end if;

  nid := catalog.notify_people(
    coalesce(nullif(payload->>'kind',''),'message'),
    payload->>'title', nullif(payload->>'body',''),
    nullif(payload->>'url',''), phones);

  update catalog.notifications
     set audience = aud, template_key = nullif(payload->>'template_key','')
   where id = nid;

  return jsonb_build_object('id', nid, 'reached', array_length(phones,1));
end; $$;

-- How many people that audience actually is, BEFORE you send to them.
create or replace function catalog.audience_count(payload jsonb)
returns int language sql stable security definer
set search_path to 'catalog','public' as $$
  select case coalesce(payload->>'audience','people')
    when 'people' then jsonb_array_length(coalesce(payload->'phones','[]'::jsonb))
    when 'role'   then (select count(*)::int from catalog.allowlist a where a.role = payload->>'role')
    when 'dept'   then (select count(*)::int from catalog.allowlist a where a.dept = payload->>'dept')
    when 'route'  then (select count(*)::int from catalog.route_members rm
                         where rm.route_id = (payload->>'route_id')::bigint)
    when 'all'    then (select count(*)::int from catalog.allowlist)
    else 0 end;
$$;

-- THE ONE LINE THAT MAKES A DEALER REACHABLE. my_notifications routed only to
-- admin and staff, so a customer could never be told anything at all. Dropped
-- and rebuilt rather than replaced, because a view cannot gain a column in
-- the middle — CREATE OR REPLACE refuses with 42P16.
drop view if exists catalog.my_notifications;
create view catalog.my_notifications as
  select n.id, n.kind, n.title, n.body, n.ref_id, n.url, n.created_at,
         bool_or(rd.phone is not null) as is_read
    from catalog.notifications n
    left join catalog.notification_targets t on t.notification_id = n.id
    left join catalog.notification_recipients nr on nr.notification_id = n.id
    left join catalog.notification_reads rd
           on rd.notification_id = n.id and rd.phone = catalog.my_phone()
   where (t.role = 'admin' and catalog.is_admin())
      or (t.role = 'staff' and catalog.my_role() = 'staff'
          and (t.dept = '*' or t.dept = (select a.dept from catalog.allowlist a
                                          where a.phone = catalog.my_phone())))
      or nr.phone = catalog.my_phone()
   group by n.id, n.kind, n.title, n.body, n.ref_id, n.url, n.created_at
   order by n.created_at desc;

alter view catalog.my_notifications set (security_invoker = on);

alter table catalog.notification_recipients enable row level security;
alter table catalog.notification_templates  enable row level security;
alter table catalog.push_subscriptions      enable row level security;
alter table catalog.push_outbox             enable row level security;
alter table catalog.reminder_log            enable row level security;

drop policy if exists nrec_read on catalog.notification_recipients;
create policy nrec_read on catalog.notification_recipients for select to authenticated
  using (phone = catalog.my_phone() or catalog.can_edit_catalogue());

drop policy if exists ntpl_read on catalog.notification_templates;
create policy ntpl_read on catalog.notification_templates for select to authenticated
  using (catalog.can_edit_catalogue());
drop policy if exists ntpl_write on catalog.notification_templates;
create policy ntpl_write on catalog.notification_templates for all to authenticated
  using (catalog.is_admin()) with check (catalog.is_admin());

-- A device subscription is nobody's business but its owner's.
drop policy if exists push_subs_own on catalog.push_subscriptions;
create policy push_subs_own on catalog.push_subscriptions for all to authenticated
  using (phone = catalog.my_phone()) with check (phone = catalog.my_phone());

drop policy if exists push_outbox_office on catalog.push_outbox;
create policy push_outbox_office on catalog.push_outbox for select to authenticated
  using (catalog.can_edit_catalogue());

drop policy if exists reminder_log_office on catalog.reminder_log;
create policy reminder_log_office on catalog.reminder_log for select to authenticated
  using (catalog.can_edit_catalogue());

grant select on catalog.notification_recipients, catalog.notification_templates,
                catalog.push_subscriptions, catalog.push_outbox,
                catalog.reminder_log, catalog.my_notifications
  to authenticated;
grant insert, update, delete on catalog.push_subscriptions     to authenticated;
grant insert, update, delete on catalog.notification_templates to authenticated;

grant execute on function catalog.notify_people(text,text,text,text,text[]) to authenticated;
grant execute on function catalog.send_message(jsonb)         to authenticated;
grant execute on function catalog.audience_count(jsonb)       to authenticated;
grant execute on function catalog.render_template(text,jsonb) to authenticated;

-- The aging ladder the prototype documented and never built. Seeded so the
-- wording exists to be edited by the office rather than invented in code.
insert into catalog.notification_templates (key, title, body) values
  ('aging_30','Your account','{customer_name}, your account shows {amount} outstanding. Please arrange payment when you can.'),
  ('aging_60','A reminder','{customer_name}, {amount} has been outstanding for two months now. Can we collect this week?'),
  ('aging_75','Please clear','{customer_name}, {amount} is now well past due. Please let us know when we can collect.'),
  ('aging_90','Overdue','{customer_name}, {amount} is three months overdue. Please clear it or call us to arrange terms.'),
  ('aging_120','Seriously overdue','{customer_name}, {amount} has been outstanding for four months. We need to hear from you.'),
  ('aging_180','Urgent','{customer_name}, {amount} is six months overdue. Please call the office today.'),
  ('daily_visit','We are coming by','{customer_name}, we plan to visit tomorrow. {amount} is outstanding.'),
  ('payment_received','Payment received','Thank you {customer_name}. We have recorded {amount} against your account. Receipt {receipt_no}.'),
  ('cheque_bounced','A cheque did not clear','{customer_name}, cheque {receipt_no} for {amount} was returned. The amount is back on your account.'),
  ('order_packed','Your order is packed','Order {order_ref} is packed and will be sent shortly.')
on conflict (key) do nothing;
