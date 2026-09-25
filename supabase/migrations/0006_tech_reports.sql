-- التقارير الفنية ومحاضر الاجتماعات + الصور
create table if not exists public.tech_reports (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null default 'visit' check (kind in ('visit','status','weekly','monthly','incident','meeting')),
  title text not null default '',
  report_date date default current_date,
  period_from date, period_to date,
  location text default '',          -- الموقع / المنطقة / مكان الاجتماع
  attendees text default '',         -- الحضور
  summary text default '',           -- ملخص / وصف الزيارة / جدول الأعمال
  findings text default '',          -- الملاحظات والمخالفات
  recommendations text default '',   -- التوصيات
  progress_seen numeric(5,2),        -- نسبة الإنجاز المشاهدة (اختياري)
  items jsonb default '[]'::jsonb,   -- قرارات المحضر [{text, owner, due, task_id}]
  next_meeting date,
  status text not null default 'draft' check (status in ('draft','published','reviewed','returned')),
  created_by uuid, published_at timestamptz,
  reviewed_by uuid, reviewed_at timestamptz, review_note text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists tech_reports_project_idx on public.tech_reports(project_id);
create index if not exists tech_reports_status_idx on public.tech_reports(status);

create table if not exists public.report_photos (
  id bigserial primary key,
  report_id bigint references public.tech_reports(id) on delete cascade,
  path text not null, caption text default '', sort int default 0,
  created_by uuid, created_at timestamptz default now()
);
create index if not exists report_photos_report_idx on public.report_photos(report_id);

create table if not exists public.report_comments (
  id bigserial primary key,
  report_id bigint references public.tech_reports(id) on delete cascade,
  body text not null, by_user uuid, at timestamptz default now()
);

alter table public.tasks add column if not exists report_id bigint references public.tech_reports(id) on delete set null;

drop trigger if exists touch_tech_reports on public.tech_reports;
create trigger touch_tech_reports before update on public.tech_reports for each row execute function public.touch();
drop trigger if exists audit_tech_reports on public.tech_reports;
create trigger audit_tech_reports after insert or update or delete on public.tech_reports for each row execute function public.audit();

alter table public.tech_reports enable row level security;
alter table public.report_photos enable row level security;
alter table public.report_comments enable row level security;
drop policy if exists p_read on public.tech_reports; drop policy if exists p_ins on public.tech_reports; drop policy if exists p_upd on public.tech_reports; drop policy if exists p_del on public.tech_reports;
create policy p_read on public.tech_reports for select using (public.can_read());
create policy p_ins on public.tech_reports for insert with check (public.can_edit() and created_by = auth.uid());
create policy p_upd on public.tech_reports for update using (public.is_admin() or (public.can_edit() and created_by = auth.uid())) with check (public.is_admin() or (public.can_edit() and created_by = auth.uid()));
create policy p_del on public.tech_reports for delete using (public.is_admin() or (created_by = auth.uid() and status = 'draft'));
drop policy if exists p_read on public.report_photos; drop policy if exists p_ins on public.report_photos; drop policy if exists p_upd on public.report_photos; drop policy if exists p_del on public.report_photos;
create policy p_read on public.report_photos for select using (public.can_read());
create policy p_ins on public.report_photos for insert with check (public.can_edit());
create policy p_upd on public.report_photos for update using (public.is_admin() or created_by = auth.uid());
create policy p_del on public.report_photos for delete using (public.is_admin() or created_by = auth.uid());
drop policy if exists p_read on public.report_comments; drop policy if exists p_ins on public.report_comments; drop policy if exists p_del on public.report_comments;
create policy p_read on public.report_comments for select using (public.can_read());
create policy p_ins on public.report_comments for insert with check (public.can_read() and by_user = auth.uid());
create policy p_del on public.report_comments for delete using (public.is_admin() or by_user = auth.uid());

-- المهندس لا يغيّر حالة المراجعة؛ الأدمن فقط يراجع أو يعيد
create or replace function public.guard_tech_report() returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if new.status in ('reviewed') or (old.status = 'reviewed' and new.status <> old.status) then
    raise exception 'مراجعة التقرير من صلاحية الإدارة';
  end if;
  if new.status = 'returned' and old.status <> 'returned' then raise exception 'إعادة التقرير من صلاحية الإدارة'; end if;
  new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
  return new;
end $$;
drop trigger if exists guard_tech_report_trg on public.tech_reports;
create trigger guard_tech_report_trg before update on public.tech_reports for each row execute function public.guard_tech_report();

grant select, insert, update, delete on public.tech_reports, public.report_photos, public.report_comments to authenticated;
grant usage, select on sequence public.tech_reports_id_seq, public.report_photos_id_seq, public.report_comments_id_seq to authenticated;

-- مخزن الصور (خاص: يُقرأ بروابط موقّعة للمسجلين فقط) — داخل do لتسجيل أي مشكلة صلاحيات بدل إيقاف النشر
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('report-photos', 'report-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
  drop policy if exists rp_read on storage.objects; drop policy if exists rp_ins on storage.objects; drop policy if exists rp_del on storage.objects; drop policy if exists rp_upd on storage.objects;
  create policy rp_read on storage.objects for select to authenticated using (bucket_id = 'report-photos' and public.can_read());
  create policy rp_ins on storage.objects for insert to authenticated with check (bucket_id = 'report-photos' and public.can_edit());
  create policy rp_upd on storage.objects for update to authenticated using (bucket_id = 'report-photos' and (public.is_admin() or owner = auth.uid()));
  create policy rp_del on storage.objects for delete to authenticated using (bucket_id = 'report-photos' and (public.is_admin() or owner = auth.uid()));
  raise notice 'STORAGE_OK report-photos';
exception when others then
  raise notice 'STORAGE_FAILED: %', sqlerrm;
end $$;
