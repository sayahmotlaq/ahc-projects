-- توسعة بطاقة المشروع لتطابق ملف المتابعة + سجل التحديات
alter table public.projects
  add column if not exists category text default 'حكومي',
  add column if not exists beneficiary text,
  add column if not exists funding text,
  add column if not exists justification text,
  add column if not exists budget_approved numeric(16,2),
  add column if not exists contract_extra numeric(16,2) default 0,
  add column if not exists extra_days int default 0,
  add column if not exists revised_end_date date,
  add column if not exists tender_submit_date date,
  add column if not exists tender_date date,
  add column if not exists award_date date,
  add column if not exists engineer_name text,
  add column if not exists status_note text;

create table if not exists public.challenges (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  category text default 'فني',
  severity text default 'متوسطة' check (severity in ('منخفضة','متوسطة','عالية','حرجة')),
  likelihood text default 'متوسطة' check (likelihood in ('منخفضة','متوسطة','عالية')),
  impact_days int, impact_amount numeric(16,2),
  action text, owner text, due_date date,
  status text default 'مفتوح' check (status in ('مفتوح','قيد المعالجة','مغلق')),
  notes text, detected_on date default current_date,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists challenges_project_idx on public.challenges(project_id);
alter table public.challenges enable row level security;
drop policy if exists p_read on public.challenges; drop policy if exists p_edit_ins on public.challenges;
drop policy if exists p_edit_upd on public.challenges; drop policy if exists p_edit_del on public.challenges;
create policy p_read on public.challenges for select using (public.can_read());
create policy p_edit_ins on public.challenges for insert with check (public.can_edit());
create policy p_edit_upd on public.challenges for update using (public.can_edit()) with check (public.can_edit());
create policy p_edit_del on public.challenges for delete using (public.can_edit());
drop trigger if exists touch_challenges on public.challenges;
create trigger touch_challenges before update on public.challenges for each row execute function public.touch();
drop trigger if exists audit_challenges on public.challenges;
create trigger audit_challenges after insert or update or delete on public.challenges for each row execute function public.audit();
grant select, insert, update, delete on public.challenges to authenticated;
grant usage, select on sequence public.challenges_id_seq to authenticated;
