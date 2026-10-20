-- 0060: قسم «الدراسات» في المشاريع + نوع جديد «جدول المواد والمواصفات المعتمدة»
-- الدراسة تجمع جداول الكميات وجداول المواصفات قبل أن يبدأ المشروع؛ تُنشأ من قسم الدراسات أو من المنشأة، وتُحوَّل إلى مشروع فتنتقل مستنداتها إليه.
-- قابل لإعادة التشغيل.

create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  facility text default '',
  facility_id bigint references public.facilities(id) on delete set null,
  kind text default '',
  status text not null default 'draft' check (status in ('draft','ready','converted','archived')),
  project_id uuid references public.projects(id) on delete set null,
  notes text default '',
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.studies enable row level security;
grant select, insert, update, delete on public.studies to authenticated;
drop policy if exists p_read on public.studies; create policy p_read on public.studies for select using (public.can_read());
drop policy if exists p_edit on public.studies; create policy p_edit on public.studies for all using (public.can_edit()) with check (public.can_edit());

alter table public.boqs add column if not exists study_id uuid references public.studies(id) on delete set null;
create index if not exists boqs_study_idx on public.boqs(study_id);

create table if not exists public.spec_sets (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references public.studies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null default 'جدول المواد والمواصفات المعتمدة',
  status text not null default 'draft' check (status in ('draft','approved','issued')),
  contractor text default '',
  notes text default '',
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint spec_sets_owner check (study_id is not null or project_id is not null)
);
create index if not exists spec_sets_project_idx on public.spec_sets(project_id);
create index if not exists spec_sets_study_idx on public.spec_sets(study_id);
alter table public.spec_sets enable row level security;
grant select, insert, update, delete on public.spec_sets to authenticated;
drop policy if exists p_read on public.spec_sets; create policy p_read on public.spec_sets for select using (public.can_read());
drop policy if exists p_edit on public.spec_sets; create policy p_edit on public.spec_sets for all using (public.can_edit()) with check (public.can_edit());

create table if not exists public.spec_lines (
  id bigserial primary key,
  set_id uuid not null references public.spec_sets(id) on delete cascade,
  item_code text not null references public.items(code),
  variants text[] not null default '{}',
  locs text default '',
  makers text default '',
  note text default '',
  submit text[] not null default '{sample,data}',
  sort int default 0,
  created_at timestamptz default now(),
  unique (set_id, item_code)
);
create index if not exists spec_lines_set_idx on public.spec_lines(set_id);
alter table public.spec_lines enable row level security;
grant select, insert, update, delete on public.spec_lines to authenticated;
grant usage, select on sequence public.spec_lines_id_seq to authenticated;
drop policy if exists p_read on public.spec_lines; create policy p_read on public.spec_lines for select using (public.can_read());
drop policy if exists p_edit on public.spec_lines; create policy p_edit on public.spec_lines for all using (public.can_edit()) with check (public.can_edit());

create or replace function public.touch_updated() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists studies_touch on public.studies; create trigger studies_touch before update on public.studies for each row execute function public.touch_updated();
drop trigger if exists spec_sets_touch on public.spec_sets; create trigger spec_sets_touch before update on public.spec_sets for each row execute function public.touch_updated();
-- تعديل أي سطر يحدّث تاريخ الجدول
create or replace function public.spec_line_touch() returns trigger language plpgsql as $$
begin update public.spec_sets set updated_at = now() where id = coalesce(new.set_id, old.set_id); return null; end $$;
drop trigger if exists spec_lines_touch on public.spec_lines; create trigger spec_lines_touch after insert or update or delete on public.spec_lines for each row execute function public.spec_line_touch();
