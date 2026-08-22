-- =====================================================================
-- Status Dashboard — FINAL, consolidated setup
-- Paste this whole file into: Supabase Dashboard → SQL Editor → Run
--
-- Safe to re-run on top of ANY earlier state (fresh project, or one that
-- already has schema.sql / migration-today.sql / migration-domains.sql /
-- fix-triggers.sql applied in some combination). This file supersedes
-- all of those — you only need to run this one from now on.
--
-- What it sets up, matching the current app exactly:
--   dashboard_meta   — singleton row, just the "Last updated" stamp
--   day_reports      — one PDF per day (Today screen)
--   domains          — Current Domains screen
--   upcoming_tasks   — Upcoming screen
--   admins           — write allowlist (see IMPORTANT below)
--   reports bucket   — public-read PDF storage
--
-- Dropped: work_entries, working_tasks, requirements — their screens
-- (Work Log / Overall / History as a separate view) no longer exist in
-- the app, so their tables are removed rather than left as dead weight.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Admin allowlist
--
-- IMPORTANT: this project has public sign-up ENABLED, so writes are
-- never granted to the `authenticated` role in general — anyone could
-- sign themselves up. Writes are restricted to user ids explicitly
-- listed here. This table has RLS on and NO policies at all, so no
-- client (not even a logged-in admin) can read or modify it — manage it
-- only from this SQL editor.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;


-- ---------------------------------------------------------------------
-- 2. Timezone helper
--
-- Postgres `current_date` is UTC. The dashboard's "today" is the
-- viewer's LOCAL date (Asia/Karachi, UTC+5) — for roughly the first
-- five hours of each local day, UTC is still on yesterday's date.
-- Change the zone string below if you ever work from elsewhere.
-- ---------------------------------------------------------------------
create or replace function public.local_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Karachi')::date;
$$;


-- ---------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------
create table if not exists public.dashboard_meta (
  id smallint primary key default 1 check (id = 1),
  updated_at timestamptz not null default now()
);

create table if not exists public.day_reports (
  day date primary key,
  pdf_path text not null,
  file_name text not null default '',
  uploaded_at timestamptz not null default now()
);

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.upcoming_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists domains_sort_idx        on public.domains (sort_order);
create index if not exists upcoming_tasks_sort_idx  on public.upcoming_tasks (sort_order);

-- Old columns from earlier drafts that some projects may still carry.
alter table public.dashboard_meta drop column if exists domain;


-- ---------------------------------------------------------------------
-- 4. Drop retired tables (Work Log / Overall / History are gone)
-- ---------------------------------------------------------------------
drop table if exists public.work_entries  cascade;
drop table if exists public.working_tasks cascade;
drop table if exists public.requirements  cascade;


-- ---------------------------------------------------------------------
-- 5. Keep dashboard_meta.updated_at fresh
--
-- These MUST be FOR EACH ROW, not FOR EACH STATEMENT.
-- A statement-level trigger fires once per statement even when the
-- statement affects ZERO rows. RLS rejects non-admin writes by
-- filtering rows out (not by erroring), so an anonymous visitor could
-- send a no-op DELETE and still fire a statement trigger — which, being
-- SECURITY DEFINER, would bypass RLS and bump the public timestamp
-- anyway. Row-level triggers only fire for rows that actually survived
-- RLS. (This was a real, verified bug in an earlier draft.)
-- ---------------------------------------------------------------------
create or replace function public.touch_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dashboard_meta set updated_at = now() where id = 1;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['day_reports', 'domains', 'upcoming_tasks']
  loop
    -- clear every legacy trigger name from earlier drafts, so a table
    -- can never end up carrying two touch_meta triggers
    execute format('drop trigger if exists trg_touch_meta_working   on public.%I', t);
    execute format('drop trigger if exists trg_touch_meta_upcoming  on public.%I', t);
    execute format('drop trigger if exists trg_touch_meta_req       on public.%I', t);
    execute format('drop trigger if exists trg_touch_meta_entries   on public.%I', t);
    execute format('drop trigger if exists trg_touch_meta_reports   on public.%I', t);
    execute format('drop trigger if exists trg_touch_meta_%s        on public.%I', t, t);

    execute format(
      'create trigger trg_touch_meta_%s after insert or update or delete on public.%I '
      'for each row execute function public.touch_meta()', t, t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 6. Row Level Security — public read, admin-only write
-- ---------------------------------------------------------------------
alter table public.dashboard_meta enable row level security;
alter table public.day_reports    enable row level security;
alter table public.domains        enable row level security;
alter table public.upcoming_tasks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dashboard_meta', 'day_reports', 'domains', 'upcoming_tasks']
  loop
    execute format('drop policy if exists "public_read"  on public.%I', t);
    execute format('drop policy if exists "admin_insert" on public.%I', t);
    execute format('drop policy if exists "admin_update" on public.%I', t);
    execute format('drop policy if exists "admin_delete" on public.%I', t);

    execute format(
      'create policy "public_read" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "admin_insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format(
      'create policy "admin_update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format(
      'create policy "admin_delete" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 7. Storage — public-read PDF bucket, admin-only writes
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do update set public = true;

drop policy if exists "reports_public_read"  on storage.objects;
drop policy if exists "reports_admin_insert" on storage.objects;
drop policy if exists "reports_admin_update" on storage.objects;
drop policy if exists "reports_admin_delete" on storage.objects;

create policy "reports_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'reports');

create policy "reports_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'reports' and public.is_admin());

create policy "reports_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'reports' and public.is_admin())
  with check (bucket_id = 'reports' and public.is_admin());

create policy "reports_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'reports' and public.is_admin());


-- ---------------------------------------------------------------------
-- 8. Seed data
--
-- day_reports is intentionally NOT seeded here: a row must point at a
-- real object in the `reports` bucket, and this script cannot upload
-- file bytes. Either upload through the app once you're an admin, or
-- upload PDFs via Supabase Studio → Storage → reports, then insert
-- matching rows, e.g.:
--
--   insert into public.day_reports (day, pdf_path, file_name)
--   values (current_date, current_date || '.pdf', 'report.pdf');
-- ---------------------------------------------------------------------
insert into public.dashboard_meta (id) values (1)
on conflict (id) do nothing;

insert into public.domains (name, note, sort_order)
select v.name, v.note, v.sort_order from (values
  ('Status Dashboard build-out', 'Frontend + Supabase backend', 0),
  ('Daily reporting workflow',   'PDF upload and history view', 1)
) as v(name, note, sort_order)
where not exists (select 1 from public.domains);

insert into public.upcoming_tasks (title, notes, sort_order)
select v.title, v.notes, v.sort_order from (values
  ('Roll out to the wider team',      'Once admin accounts are set up',        0),
  ('Automate the daily PDF report',   'Generate instead of uploading by hand', 1),
  ('Add per-person filtering',        'So each area reports separately',       2),
  ('Set up a weekly summary email',   'Digest of the week for stakeholders',   3)
) as v(title, notes, sort_order)
where not exists (select 1 from public.upcoming_tasks);


-- =====================================================================
-- 9. AFTER RUNNING THIS — make yourself an admin
-- =====================================================================
-- a) Supabase Dashboard → Authentication → Users → "Add user"
--    Create your admin user and TICK "Auto Confirm User"
--    (mailer_autoconfirm is off on this project, so without that tick
--     the account cannot log in until a confirmation email is clicked).
--
-- b) Then run this, with your email:
--
--      insert into public.admins (user_id)
--      select id from auth.users where email = 'you@example.com'
--      on conflict do nothing;
--
-- c) Verify:
--      select u.email from public.admins a join auth.users u on u.id = a.user_id;
-- =====================================================================


-- ---------------------------------------------------------------------
-- 10. Verify tables + trigger levels (all touch_meta triggers must be ROW)
-- ---------------------------------------------------------------------
select tgrelid::regclass as table_name, tgname,
       case when (tgtype & 1) = 1 then 'ROW' else 'STATEMENT' end as level
from pg_trigger
where not tgisinternal and tgname like 'trg_touch_meta%'
order by table_name;
