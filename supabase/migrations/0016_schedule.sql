-- ===== الجدول الزمني: حزم الأعمال والمعالم + منحنى S + الخط الأساس =====
alter table public.projects add column if not exists progress_mode text default 'manual' check (progress_mode in ('manual','schedule'));
alter table public.projects add column if not exists schedule_baseline_at timestamptz;
alter table public.projects add column if not exists schedule_baseline_by uuid;

create table if not exists public.schedule_items (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  sort int default 0,
  kind text not null default 'package' check (kind in ('package','milestone')),
  name text not null,
  weight numeric(6,2) default 0,             -- للحزم: نسبتها من المشروع
  planned_start date, planned_end date,      -- المعلم: planned_end فقط
  baseline_start date, baseline_end date,    -- تُثبّت عند اعتماد الخط الأساس
  actual_start date, actual_end date,
  pct numeric(5,2) default 0, pct_updated_at timestamptz,
  note text default '',
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists schedule_items_project_idx on public.schedule_items(project_id);
create table if not exists public.schedule_snapshots (
  project_id uuid references public.projects(id) on delete cascade,
  on_date date not null, planned numeric(5,2), actual numeric(5,2),
  primary key (project_id, on_date)
);
alter table public.schedule_items enable row level security; alter table public.schedule_snapshots enable row level security;
drop policy if exists p_read on public.schedule_items; drop policy if exists p_ins on public.schedule_items; drop policy if exists p_upd on public.schedule_items; drop policy if exists p_del on public.schedule_items;
create policy p_read on public.schedule_items for select using (public.can_read());
create policy p_ins on public.schedule_items for insert with check (public.is_admin() or (public.can_edit() and exists (select 1 from public.projects p where p.id = project_id and p.engineer_id = auth.uid())));
create policy p_upd on public.schedule_items for update using (public.is_admin() or (public.can_edit() and exists (select 1 from public.projects p where p.id = project_id and p.engineer_id = auth.uid())));
create policy p_del on public.schedule_items for delete using (public.is_admin() or (public.can_edit() and exists (select 1 from public.projects p where p.id = project_id and p.engineer_id = auth.uid())));
drop policy if exists p_read on public.schedule_snapshots; drop policy if exists p_all on public.schedule_snapshots;
create policy p_read on public.schedule_snapshots for select using (public.can_read());
create policy p_all on public.schedule_snapshots for all using (public.can_edit()) with check (public.can_edit());
grant select, insert, update, delete on public.schedule_items, public.schedule_snapshots to authenticated;
grant usage, select on sequence public.schedule_items_id_seq to authenticated;
drop trigger if exists touch_schedule_items on public.schedule_items; create trigger touch_schedule_items before update on public.schedule_items for each row execute function public.touch();
drop trigger if exists audit_schedule_items on public.schedule_items; create trigger audit_schedule_items after insert or update or delete on public.schedule_items for each row execute function public.audit();

-- بعد اعتماد الخط الأساس لا يغيّر المهندس المخطط (الأوزان والتواريخ المخططة) — الإدارة فقط
create or replace function public.guard_schedule_item() returns trigger language plpgsql security definer set search_path = public as $$
declare bl timestamptz;
begin
  if new.pct is distinct from old.pct then new.pct_updated_at := now(); end if;
  if public.is_admin() then return new; end if;
  select schedule_baseline_at into bl from public.projects where id = new.project_id;
  if bl is not null and (new.planned_start is distinct from old.planned_start or new.planned_end is distinct from old.planned_end or new.weight is distinct from old.weight or new.kind is distinct from old.kind) then
    raise exception 'الخط الأساس معتمد — تعديل المخطط يحتاج أمر تمديد أو موافقة الإدارة';
  end if;
  return new;
end $$;
drop trigger if exists guard_schedule_item_trg on public.schedule_items;
create trigger guard_schedule_item_trg before update on public.schedule_items for each row execute function public.guard_schedule_item();

-- حساب المخطط والفعلي لمشروع (نفس المعادلة في الواجهة)
create or replace function public.sched_calc(pid uuid, on_day date default current_date, out planned numeric, out actual numeric) language plpgsql stable security definer set search_path = public as $$
declare tw numeric; r record; f numeric;
begin
  select coalesce(sum(weight),0) into tw from public.schedule_items where project_id = pid and kind = 'package';
  planned := 0; actual := 0;
  if tw = 0 then planned := null; actual := null; return; end if;
  for r in select * from public.schedule_items where project_id = pid and kind = 'package' loop
    if r.planned_start is null or r.planned_end is null then f := 0;
    elsif on_day >= r.planned_end then f := 1;
    elsif on_day <= r.planned_start then f := 0;
    else f := (on_day - r.planned_start)::numeric / greatest(1, (r.planned_end - r.planned_start));
    end if;
    planned := planned + r.weight * f; actual := actual + r.weight * coalesce(r.pct,0) / 100;
  end loop;
  planned := round(planned / tw * 100, 1); actual := round(actual / tw * 100, 1);
end $$;

-- مزامنة نسب المشروع من الجدول (للمشاريع التي اختارت الجدول مصدراً) + لقطة يومية للمنحنى
create or replace function public.sync_schedule_progress() returns int language plpgsql security definer set search_path = public as $$
declare p record; c record; n int := 0;
begin
  for p in select distinct s.project_id, pr.progress_mode from public.schedule_items s join public.projects pr on pr.id = s.project_id where pr.archived = false loop
    select * into c from public.sched_calc(p.project_id);
    if c.planned is null then continue; end if;
    insert into public.schedule_snapshots(project_id, on_date, planned, actual) values (p.project_id, current_date, c.planned, c.actual) on conflict (project_id, on_date) do update set planned = excluded.planned, actual = excluded.actual;
    if p.progress_mode = 'schedule' then update public.projects set progress_planned = round(c.planned), progress_actual = round(c.actual) where id = p.project_id; n := n + 1; end if;
  end loop;
  return n;
end $$;
create or replace function public.sync_schedule_trg() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; c record; m text;
begin
  pid := coalesce(new.project_id, old.project_id);
  select * into c from public.sched_calc(pid);
  if c.planned is not null then
    insert into public.schedule_snapshots(project_id, on_date, planned, actual) values (pid, current_date, c.planned, c.actual) on conflict (project_id, on_date) do update set planned = excluded.planned, actual = excluded.actual;
    select progress_mode into m from public.projects where id = pid;
    if m = 'schedule' then update public.projects set progress_planned = round(c.planned), progress_actual = round(c.actual) where id = pid; end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists sync_schedule_after on public.schedule_items;
create trigger sync_schedule_after after insert or update or delete on public.schedule_items for each row execute function public.sync_schedule_trg();

-- إزاحة ما تبقى من الجدول (بعد أمر تمديد) — الإدارة
create or replace function public.shift_schedule(pid uuid, p_days int, p_from date default current_date) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'إزاحة الجدول من صلاحية الإدارة'; end if;
  update public.schedule_items set planned_end = planned_end + p_days, planned_start = case when planned_start >= p_from then planned_start + p_days else planned_start end
    where project_id = pid and planned_end >= p_from and actual_end is null;
  get diagnostics n = row_count; return n;
end $$;

-- تنبيه المعالم المتأخرة (يومياً، مرة كل أسبوع لكل معلم)
create or replace function public.notify_late_milestones() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select s.id, s.name, s.planned_end, s.project_id, p.engineer_id, p.name as pname from public.schedule_items s join public.projects p on p.id = s.project_id
           where s.kind = 'milestone' and s.actual_end is null and s.planned_end < current_date and p.archived = false and p.stage = 'execution' loop
    if not exists (select 1 from public.notifications where kind = 'milestone' and link = '#/project/' || r.project_id || '/schedule' and body like '%' || r.name || '%' and created_at > now() - interval '7 days') then
      perform public.notify(public.admins() || array[r.engineer_id], 'milestone', 'معلم متأخر: ' || r.pname, r.name || ' — كان مخططاً ' || to_char(r.planned_end, 'YYYY-MM-DD') || ' (' || (current_date - r.planned_end) || ' يوم)', '#/project/' || r.project_id || '/schedule'); n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- سجل الإنجازات: تحديثات الجدول
create or replace view public.v_user_activity with (security_invoker = true) as
  select created_by as user_id, coalesce(published_at, created_at) as at, 'treport' as kind, case kind when 'meeting' then 'محضر اجتماع: ' else 'تقرير فني: ' end || title as title, project_id, '#/treport/' || id as link, case when status = 'reviewed' then 'reviewed' when status = 'returned' then 'returned' else status end as outcome, id::text as ref from public.tech_reports where status <> 'draft'
  union all select created_by, created_at, 'update', 'تحديث (' || coalesce(kind, 'note') || '): ' || left(body, 100), project_id, '#/project/' || project_id || '/updates', null, id::text from public.project_updates
  union all select created_by, created_at, 'payment', 'إعداد مستخلص رقم ' || no, project_id, '#/project/' || project_id || '/payments', status, id::text from public.payments
  union all select created_by, created_at, 'submittal', 'طلب اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || title, project_id, '#/project/' || project_id || '/submittals', decision, id::text from public.submittals
  union all select engineer_by, engineer_at, 'submittal_review', 'مراجعة اعتماد SUB-' || lpad(no::text, 3, '0') || ' (' || coalesce(engineer_recommend, '') || ')', project_id, '#/project/' || project_id || '/submittals', case when decision is null then null when (engineer_recommend = 'approve' and decision = 'approved') or (engineer_recommend = 'approve_notes' and decision = 'approved_notes') or (engineer_recommend = 'resubmit' and decision = 'resubmit') or (engineer_recommend = 'reject' and decision = 'rejected') then 'agreed' else 'changed' end, id::text from public.submittals where engineer_at is not null
  union all select decided_by, decided_at, 'submittal_decision', 'قرار اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || coalesce(decision, ''), project_id, '#/project/' || project_id || '/submittals', decision, id::text from public.submittals where decided_at is not null
  union all select assignee_id, done_at, 'task_done', 'إنجاز مهمة: ' || title, project_id, '#/project/' || project_id || '/tasks', case when due_date is null then 'no_due' when done_at::date <= due_date then 'on_time' else 'late' end, id::text from public.tasks where status = 'done' and done_at is not null and assignee_id is not null
  union all select created_by, created_at, 'task_created', 'تكليف بمهمة: ' || title, project_id, '#/project/' || project_id || '/tasks', null, id::text from public.tasks where created_by is not null
  union all select created_by, created_at, 'challenge', 'رصد تحدٍ (' || severity || '): ' || title, project_id, '#/project/' || project_id || '/challenges', status, id::text from public.challenges
  union all select by_user, at, 'stage', 'نقل المشروع إلى مرحلة ' || to_stage, project_id, '#/project/' || project_id || '/log', null, id::text from public.project_stage_log where by_user is not null
  union all select created_by, created_at, 'request', 'طلب للإدارة: ' || title, project_id, '#/project/' || project_id || '/requests', status, id::text from public.requests
  union all select responded_by, responded_at, 'request_response', 'الرد على طلب: ' || title, project_id, '#/project/' || project_id || '/requests', status, id::text from public.requests where responded_at is not null
  union all select created_by, created_at, 'document', 'تسجيل مستند (' || category || '): ' || title, project_id, '#/project/' || project_id || '/docs', null, id::text from public.documents
  union all select r.created_by, r.created_at, 'drawing', 'رفع مخطط ' || coalesce(d.dwg_no, '') || ' مراجعة ' || r.rev, d.project_id, '#/project/' || d.project_id || '/drawings', r.status, r.id::text from public.drawing_revisions r join public.drawings d on d.id = r.drawing_id
  union all select created_by, created_at, 'boq', 'إعداد جدول كميات: ' || name, project_id, '#/project/' || project_id || '/boq', status, id::text from public.boqs
  union all select by_user, at, 'comment', 'تعليق على تقرير', (select project_id from public.tech_reports t where t.id = c.report_id), '#/treport/' || report_id, null, id::text from public.report_comments c
  union all select created_by, created_at, 'project', 'إنشاء مشروع: ' || name, id, '#/project/' || id, null, id::text from public.projects where created_by is not null
  union all select created_by, created_at, 'change', 'أمر تغيير رقم ' || no || ': ' || title, project_id, '#/project/' || project_id || '/changes', status, id::text from public.change_orders
  union all select decided_by, decided_at, 'change_decision', 'قرار أمر تغيير رقم ' || no || ': ' || status, project_id, '#/project/' || project_id || '/changes', status, id::text from public.change_orders where decided_at is not null
  union all select by_user, updated_at, 'closeout', 'إغلاق: ' || label, project_id, '#/project/' || project_id || '/closeout', null, id::text from public.closeout_items where done and by_user is not null
  union all select created_by, created_at, 'schedule', 'إضافة ' || case kind when 'milestone' then 'معلم: ' else 'حزمة أعمال: ' end || name, project_id, '#/project/' || project_id || '/schedule', null, id::text from public.schedule_items where created_by is not null
  union all select a.by_user, a.at, 'schedule_update', 'تحديث إنجاز: ' || coalesce(a.new_data->>'name', '') || ' → ' || coalesce(a.new_data->>'pct', '') || '%', (a.new_data->>'project_id')::uuid, '#/project/' || (a.new_data->>'project_id') || '/schedule', null, a.id::text from public.audit_log a where a.table_name = 'schedule_items' and a.action = 'UPDATE' and a.by_user is not null and (a.old_data->>'pct') is distinct from (a.new_data->>'pct');
grant select on public.v_user_activity to authenticated;
-- المستخدم يرى سجلات التدقيق الخاصة به (لسجل إنجازاته)
drop policy if exists p_read_own on public.audit_log;
create policy p_read_own on public.audit_log for select using (by_user = auth.uid());
