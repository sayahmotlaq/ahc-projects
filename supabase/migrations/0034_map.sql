-- ===== الخريطة: جدول المرافق بإحداثياتها + رابط موقع/إحداثيات لكل مشروع (يرث موقع منشأته إن لم يُحدد) =====
create table if not exists public.facilities (
  id bigserial primary key,
  name text not null,
  kind text not null default 'hospital' check (kind in ('hospital','center','other')),
  map_link text default '',
  lat double precision, lng double precision,
  sort int default 0, active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.facilities enable row level security;
grant select, insert, update, delete on public.facilities to authenticated;
grant usage, select on sequence public.facilities_id_seq to authenticated;
drop policy if exists p_read on public.facilities; create policy p_read on public.facilities for select using (public.can_read());
drop policy if exists p_admin on public.facilities; create policy p_admin on public.facilities for all using (public.is_admin()) with check (public.is_admin());

alter table public.projects
  add column if not exists facility_id bigint references public.facilities(id) on delete set null,
  add column if not exists map_link text default '',
  add column if not exists lat double precision,
  add column if not exists lng double precision;
create index if not exists projects_facility_idx on public.projects(facility_id);
