-- =====================================================================
-- منصة إدارة مشاريع تجمع الأحساء الصحي — المخطط الأساسي (الإصدار 1)
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- المستخدمون والصلاحيات ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'pending' check (role in ('admin','engineer','viewer','pending','disabled')),
  title text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
insert into public.settings(key, value) values
  ('admin_emails', '["saya7motlaq@gmail.com"]'::jsonb),
  ('ref_version', '{"v":0}'::jsonb),
  ('org', '{"name":"تجمع الأحساء الصحي","dept":"إدارة الخدمات الفنية — قسم المشاريع"}'::jsonb)
on conflict (key) do nothing;

-- إنشاء الملف الشخصي تلقائياً عند التسجيل؛ الإيميلات الإدارية تصبح admin مباشرة
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare admins jsonb; r text;
begin
  select value into admins from public.settings where key='admin_emails';
  if admins is not null and admins ? lower(new.email) then r := 'admin'; else r := 'pending'; end if;
  insert into public.profiles(id, email, full_name, role)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), r)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'anon');
$$;
create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.my_role() = 'admin' $$;
create or replace function public.can_edit() returns boolean
language sql stable as $$ select public.my_role() in ('admin','engineer') $$;
create or replace function public.can_read() returns boolean
language sql stable as $$ select public.my_role() in ('admin','engineer','viewer') $$;

-- ---------- المرجع الفني ----------
create table if not exists public.divisions (
  code text primary key, ar text not null, en text, sort int default 0, active boolean default true
);
create table if not exists public.sections (
  code text primary key, division_code text not null references public.divisions(code) on delete cascade,
  ar text not null, en text, active boolean default true
);
create table if not exists public.items (
  code text primary key, section_code text not null references public.sections(code) on delete cascade,
  ar text not null, en text, unit text default '—', status text default 'skeleton',
  scope text, specs jsonb default '[]', health jsonb default '[]', accept jsonb default '[]',
  method jsonb default '[]', refs jsonb default '[]', notes jsonb default '[]', keywords jsonb default '[]',
  price_basis text, active boolean default true,
  updated_at timestamptz default now(), updated_by uuid
);
create index if not exists items_section_idx on public.items(section_code);
create table if not exists public.variants (
  code text primary key, item_code text not null references public.items(code) on delete cascade,
  ar text not null, en text, unit text default 'عدد', price numeric(14,2) default 0, spec text,
  active boolean default true, updated_at timestamptz default now(), updated_by uuid
);
create index if not exists variants_item_idx on public.variants(item_code);
create table if not exists public.price_history (
  id bigserial primary key, variant_code text not null, old_price numeric(14,2), new_price numeric(14,2),
  changed_by uuid, changed_at timestamptz default now(), note text
);
create or replace function public.track_price() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and new.price is distinct from old.price then
    insert into public.price_history(variant_code, old_price, new_price, changed_by) values (new.code, old.price, new.price, auth.uid());
  end if;
  new.updated_at := now(); new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists variants_price_trg on public.variants;
create trigger variants_price_trg before update on public.variants for each row execute function public.track_price();

-- ---------- المشاريع ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  ref text, name text not null, facility text, dept text, type text,
  engineer_id uuid references public.profiles(id), manager_note text,
  stage text not null default 'request',
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  budget numeric(16,2), contract_value numeric(16,2), contractor text, consultant text,
  start_date date, end_date date, actual_end_date date, duration_days int,
  progress_planned numeric(5,2) default 0, progress_actual numeric(5,2) default 0,
  paid_amount numeric(16,2) default 0,
  notes text, tags jsonb default '[]', archived boolean default false,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.project_stage_log (
  id bigserial primary key, project_id uuid references public.projects(id) on delete cascade,
  from_stage text, to_stage text, note text, by_user uuid, at timestamptz default now()
);
create table if not exists public.project_updates (
  id bigserial primary key, project_id uuid references public.projects(id) on delete cascade,
  kind text default 'note' check (kind in ('note','visit','issue','letter','payment','milestone')),
  body text not null, amount numeric(16,2), ref_no text, happened_on date default current_date,
  created_by uuid, created_at timestamptz default now()
);
create table if not exists public.boqs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'تقديري', status text default 'draft' check (status in ('draft','approved','tender','awarded','final')),
  contingency numeric(5,2) default 5, vat numeric(5,2) default 15, factor numeric(6,3) default 1,
  notes text, created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.boq_lines (
  id bigserial primary key, boq_id uuid references public.boqs(id) on delete cascade,
  variant_code text not null references public.variants(code),
  qty numeric(14,3) not null default 0, loc text, unit_price numeric(14,2), sort int default 0,
  created_at timestamptz default now()
);
create index if not exists boq_lines_boq_idx on public.boq_lines(boq_id);

-- سجل التدقيق
create table if not exists public.audit_log (
  id bigserial primary key, table_name text, row_id text, action text, old_data jsonb, new_data jsonb,
  by_user uuid, at timestamptz default now()
);
create or replace function public.audit() returns trigger language plpgsql security definer as $$
declare rid text;
begin
  rid := coalesce((to_jsonb(coalesce(new, old))->>'id'), (to_jsonb(coalesce(new, old))->>'code'));
  insert into public.audit_log(table_name, row_id, action, old_data, new_data, by_user)
  values (tg_table_name, rid, tg_op, case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['items','variants','projects','boqs','profiles'] loop
    execute format('drop trigger if exists audit_%s on public.%I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit()', t, t);
  end loop; end $$;

create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['projects','boqs','items','profiles'] loop
    execute format('drop trigger if exists touch_%s on public.%I', t, t);
    execute format('create trigger touch_%s before update on public.%I for each row execute function public.touch()', t, t);
  end loop; end $$;

-- ---------- سياسات الأمان (RLS) ----------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.divisions enable row level security;
alter table public.sections enable row level security;
alter table public.items enable row level security;
alter table public.variants enable row level security;
alter table public.price_history enable row level security;
alter table public.projects enable row level security;
alter table public.project_stage_log enable row level security;
alter table public.project_updates enable row level security;
alter table public.boqs enable row level security;
alter table public.boq_lines enable row level security;
alter table public.audit_log enable row level security;

do $$ declare t text; begin
  foreach t in array array['profiles','settings','divisions','sections','items','variants','price_history','projects','project_stage_log','project_updates','boqs','boq_lines','audit_log'] loop
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('drop policy if exists p_admin_all on public.%I', t);
    execute format('drop policy if exists p_edit_ins on public.%I', t);
    execute format('drop policy if exists p_edit_upd on public.%I', t);
    execute format('drop policy if exists p_edit_del on public.%I', t);
    execute format('drop policy if exists p_self_upd on public.%I', t);
  end loop; end $$;

-- الملفات الشخصية: كل مستخدم يرى ملفه؛ القرّاء يرون الجميع؛ الأدمن يعدّل الجميع؛ المستخدم يعدّل اسمه فقط
create policy p_read on public.profiles for select using (id = auth.uid() or public.can_read());
create policy p_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy p_self_upd on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy p_read on public.settings for select using (auth.uid() is not null);
create policy p_admin_all on public.settings for all using (public.is_admin()) with check (public.is_admin());

-- المرجع: قراءة لكل المستخدمين المعتمدين؛ تعديل للأدمن فقط
create policy p_read on public.divisions for select using (public.can_read());
create policy p_admin_all on public.divisions for all using (public.is_admin()) with check (public.is_admin());
create policy p_read on public.sections for select using (public.can_read());
create policy p_admin_all on public.sections for all using (public.is_admin()) with check (public.is_admin());
create policy p_read on public.items for select using (public.can_read());
create policy p_admin_all on public.items for all using (public.is_admin()) with check (public.is_admin());
create policy p_read on public.variants for select using (public.can_read());
create policy p_admin_all on public.variants for all using (public.is_admin()) with check (public.is_admin());
create policy p_read on public.price_history for select using (public.can_read());
create policy p_admin_all on public.price_history for all using (public.is_admin()) with check (public.is_admin());

-- المشاريع: قراءة للمعتمدين؛ إضافة وتعديل للمهندسين والأدمن؛ حذف للأدمن
create policy p_read on public.projects for select using (public.can_read());
create policy p_edit_ins on public.projects for insert with check (public.can_edit());
create policy p_edit_upd on public.projects for update using (public.can_edit()) with check (public.can_edit());
create policy p_edit_del on public.projects for delete using (public.is_admin());
create policy p_read on public.project_stage_log for select using (public.can_read());
create policy p_edit_ins on public.project_stage_log for insert with check (public.can_edit());
create policy p_read on public.project_updates for select using (public.can_read());
create policy p_edit_ins on public.project_updates for insert with check (public.can_edit());
create policy p_edit_upd on public.project_updates for update using (public.can_edit()) with check (public.can_edit());
create policy p_edit_del on public.project_updates for delete using (public.is_admin() or created_by = auth.uid());
create policy p_read on public.boqs for select using (public.can_read());
create policy p_edit_ins on public.boqs for insert with check (public.can_edit());
create policy p_edit_upd on public.boqs for update using (public.can_edit()) with check (public.can_edit());
create policy p_edit_del on public.boqs for delete using (public.can_edit());
create policy p_read on public.boq_lines for select using (public.can_read());
create policy p_edit_ins on public.boq_lines for insert with check (public.can_edit());
create policy p_edit_upd on public.boq_lines for update using (public.can_edit()) with check (public.can_edit());
create policy p_edit_del on public.boq_lines for delete using (public.can_edit());
create policy p_read on public.audit_log for select using (public.is_admin());

-- ---------- دوال مساعدة ----------
-- تغيير مرحلة مشروع مع تسجيلها
create or replace function public.set_stage(p_id uuid, p_stage text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare old_stage text;
begin
  if not public.can_edit() then raise exception 'غير مصرح'; end if;
  select stage into old_stage from public.projects where id = p_id;
  update public.projects set stage = p_stage where id = p_id;
  insert into public.project_stage_log(project_id, from_stage, to_stage, note, by_user) values (p_id, old_stage, p_stage, p_note, auth.uid());
end $$;

-- لوحة المؤشرات
create or replace view public.v_dashboard as
select stage, count(*) as n, coalesce(sum(coalesce(contract_value, budget)),0) as value
from public.projects where not archived group by stage;

-- ---------- الصلاحيات على مستوى الأدوار (RLS هي الحاكمة) ----------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant select on public.v_dashboard to authenticated;
