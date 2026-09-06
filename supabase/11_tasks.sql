-- ═══════════════════════════════════════════════════════════════════════════
-- SoSell — 11: tasks.
--
-- ✅ APPLIED 2026-09-06 as migration `sosell_11_tasks`.
--
-- Neither repo had this. The nearest neighbours were the prototype's routes
-- and staff_schedules, and the catalogue's departments — and the right
-- relationship between them is:
--
--     A SCHEDULE is the standing shape of the week.
--     A TASK is what came up.
--
-- So a task is free-form (a title, notes, a due date, a priority) and can
-- OPTIONALLY point at something real — a shop, an order, a bill, a route. That
-- covers "call Sharma Traders about the overdue bill" and "check the Orbit
-- stock" with one shape, which is what was asked for.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists catalog.tasks (
  id            bigint generated always as identity primary key,
  title         text not null,
  detail        text,
  kind          text not null default 'todo'
                  check (kind in ('todo','visit','call','collect','deliver','purchase','fix')),
  -- One person, OR a whole desk. Neither means nobody would do it, which the
  -- check constraint at the bottom refuses.
  assigned_to   text references catalog.allowlist(phone),
  assigned_dept text references catalog.departments(id),
  assigned_by   text not null references catalog.allowlist(phone),
  about_phone   text references catalog.allowlist(phone),
  about_kind    text check (about_kind in ('order','invoice','payment','route','product','signup')),
  about_id      bigint,
  about_ref     text,
  due_on        date,
  priority      smallint not null default 2 check (priority between 1 and 3),
  status        text not null default 'open'
                  check (status in ('open','doing','done','cancelled')),
  done_at       timestamptz,
  done_by       text,
  done_note     text,
  created_at    timestamptz not null default now(),
  constraint tasks_has_an_assignee
    check (assigned_to is not null or assigned_dept is not null)
);
create index if not exists tasks_mine on catalog.tasks (assigned_to, status, due_on);
create index if not exists tasks_desk on catalog.tasks (assigned_dept, status, due_on);

create table if not exists catalog.task_comments (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references catalog.tasks(id) on delete cascade,
  phone      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create or replace function catalog.assign_task(payload jsonb)
returns bigint language plpgsql security definer
set search_path to 'catalog','public' as $$
declare me text := catalog.my_phone(); tid bigint;
        who text := nullif(payload->>'assigned_to','');
        dept text := nullif(payload->>'assigned_dept','');
begin
  if not catalog.can_edit_catalogue() then
    raise exception 'only the office assigns work'; end if;
  if coalesce(payload->>'title','') = '' then raise exception 'a task needs a title'; end if;
  if who is null and dept is null then raise exception 'assign it to somebody'; end if;

  -- Work is assigned to people who work here. A dealer is not staff, and
  -- assigning them a task would put it on a screen they cannot open.
  if who is not null and not exists (
      select 1 from catalog.allowlist a
       where a.phone = who and (a.is_admin or a.role = 'staff'))
  then raise exception 'that person is not on the team'; end if;

  insert into catalog.tasks
    (title, detail, kind, assigned_to, assigned_dept, assigned_by,
     about_phone, about_kind, about_id, about_ref, due_on, priority)
  values (payload->>'title', nullif(payload->>'detail',''),
          coalesce(nullif(payload->>'kind',''),'todo'), who, dept, me,
          nullif(payload->>'about_phone',''), nullif(payload->>'about_kind',''),
          nullif(payload->>'about_id','')::bigint, nullif(payload->>'about_ref',''),
          nullif(payload->>'due_on','')::date,
          coalesce(nullif(payload->>'priority','')::smallint, 2))
  returning id into tid;
  return tid;
end; $$;

-- "Done" is not something anyone can write on anyone else's behalf. Only the
-- person doing it, the person who asked, or an admin.
create or replace function catalog.set_task_status(p_id bigint, p_status text, p_note text default null)
returns void language plpgsql security definer
set search_path to 'catalog','public' as $$
declare t catalog.tasks; me text := catalog.my_phone();
begin
  select * into t from catalog.tasks where id = p_id;
  if t.id is null then raise exception 'no such task'; end if;
  if p_status not in ('open','doing','done','cancelled') then
    raise exception 'unknown status'; end if;
  if not (catalog.is_admin() or t.assigned_to = me or t.assigned_by = me
          or (t.assigned_dept is not null and t.assigned_dept =
              (select a.dept from catalog.allowlist a where a.phone = me)))
  then raise exception 'that is not your task'; end if;

  update catalog.tasks
     set status = p_status, done_note = coalesce(p_note, done_note),
         done_at = case when p_status = 'done' then now() end,
         done_by = case when p_status = 'done' then me end
   where id = p_id;
end; $$;

alter table catalog.tasks         enable row level security;
alter table catalog.task_comments enable row level security;

drop policy if exists tasks_read on catalog.tasks;
create policy tasks_read on catalog.tasks for select to authenticated using (
  assigned_to = catalog.my_phone()
  or assigned_by = catalog.my_phone()
  or catalog.is_admin()
  or (assigned_dept is not null
      and assigned_dept = (select a.dept from catalog.allowlist a
                            where a.phone = catalog.my_phone())));

drop policy if exists task_comments_read on catalog.task_comments;
create policy task_comments_read on catalog.task_comments for select to authenticated
  using (exists (select 1 from catalog.tasks t where t.id = task_comments.task_id));

drop policy if exists task_comments_write on catalog.task_comments;
create policy task_comments_write on catalog.task_comments for insert to authenticated
  with check (phone = catalog.my_phone()
              and exists (select 1 from catalog.tasks t where t.id = task_comments.task_id));

grant select on catalog.tasks, catalog.task_comments to authenticated;
grant insert on catalog.task_comments to authenticated;
grant execute on function catalog.assign_task(jsonb)                  to authenticated;
grant execute on function catalog.set_task_status(bigint, text, text) to authenticated;
