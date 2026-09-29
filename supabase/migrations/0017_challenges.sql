-- ===== التحديات والمخاطر: درجة محسوبة، ربط بالمهام وأوامر التغيير، سجل متابعة، سبب الإغلاق =====

alter table public.challenges add column if not exists closed_at timestamptz;
alter table public.challenges add column if not exists closed_by uuid;
alter table public.challenges add column if not exists close_reason text check (close_reason in ('resolved','change_order','accepted','cancelled') or close_reason is null);
alter table public.challenges add column if not exists change_order_id bigint references public.change_orders(id) on delete set null;
alter table public.challenges add column if not exists score int generated always as (
  (case severity when 'منخفضة' then 1 when 'متوسطة' then 2 when 'عالية' then 3 when 'حرجة' then 4 else 2 end)
  * (case likelihood when 'منخفضة' then 1 when 'متوسطة' then 2 when 'عالية' then 3 else 2 end)) stored;
create index if not exists challenges_status_idx on public.challenges(status, score desc);

alter table public.tasks add column if not exists challenge_id bigint references public.challenges(id) on delete set null;
create index if not exists tasks_challenge_idx on public.tasks(challenge_id);

-- ختم الإغلاق
create or replace function public.challenge_close_stamp() returns trigger language plpgsql as $$
begin
  if new.status = 'مغلق' and (old.status is distinct from 'مغلق') then new.closed_at := now(); new.closed_by := auth.uid(); if new.close_reason is null then new.close_reason := 'resolved'; end if;
  elsif new.status <> 'مغلق' then new.closed_at := null; new.closed_by := null; new.close_reason := null; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists challenge_close_trg on public.challenges;
create trigger challenge_close_trg before update on public.challenges for each row execute function public.challenge_close_stamp();

-- سجل المتابعة
create table if not exists public.challenge_notes (
  id bigserial primary key,
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  body text not null,
  by_user uuid, at timestamptz default now()
);
create index if not exists challenge_notes_ch_idx on public.challenge_notes(challenge_id);
alter table public.challenge_notes enable row level security;
grant select, insert, update, delete on public.challenge_notes to authenticated;
grant usage, select on sequence public.challenge_notes_id_seq to authenticated;
drop policy if exists p_read on public.challenge_notes; drop policy if exists p_ins on public.challenge_notes; drop policy if exists p_del on public.challenge_notes;
create policy p_read on public.challenge_notes for select using (public.can_read());
create policy p_ins on public.challenge_notes for insert with check (public.can_edit() and by_user = auth.uid());
create policy p_del on public.challenge_notes for delete using (public.is_admin() or by_user = auth.uid());

-- إشعار عند إضافة متابعة على تحدٍ (للإدارة ومهندس المشروع عدا الكاتب)
create or replace function public.n_challenge_notes() returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select ch.title, ch.project_id, p.name as pname into c from public.challenges ch join public.projects p on p.id = ch.project_id where ch.id = new.challenge_id;
  perform public.notify(array_remove(public.admins() || array[public.proj_eng(c.project_id)], new.by_user), 'challenge', 'متابعة على تحدٍ: ' || c.pname, left(c.title, 60) || ' — ' || left(new.body, 120), '#/challenges?id=' || new.challenge_id);
  return new;
end $$;
drop trigger if exists n_challenge_notes_trg on public.challenge_notes;
create trigger n_challenge_notes_trg after insert on public.challenge_notes for each row execute function public.n_challenge_notes();

-- تحديات تجاوزت موعدها أو حرجة بلا مهام (فحص يومي، بلا تكرار خلال أسبوع)
create or replace function public.notify_overdue_challenges() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_body text;
begin
  for r in select c.id, c.title, c.due_date, c.score, c.project_id, p.engineer_id, p.name as pname,
                  (select count(*) from public.tasks t where t.challenge_id = c.id and t.status in ('open','in_progress')) as open_tasks
           from public.challenges c join public.projects p on p.id = c.project_id
           where c.status <> 'مغلق' and p.archived = false and ((c.due_date is not null and c.due_date < current_date) or (c.score >= 8)) loop
    if r.due_date is not null and r.due_date < current_date then v_body := 'تجاوز الموعد المستهدف ' || to_char(r.due_date, 'YYYY-MM-DD') || ' (' || (current_date - r.due_date) || ' يوم)';
    elsif r.open_tasks = 0 then v_body := 'تحدٍ بدرجة ' || r.score || ' بلا مهام معالجة مفتوحة';
    else continue; end if;
    if not exists (select 1 from public.notifications where kind = 'challenge' and link = '#/challenges?id=' || r.id and created_at > now() - interval '7 days') then
      perform public.notify(public.admins() || array[r.engineer_id], 'challenge', 'تحدٍ يحتاج متابعة: ' || r.pname, left(r.title, 80) || ' — ' || v_body, '#/challenges?id=' || r.id);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- سجل الإنجازات: إغلاق التحديات والمتابعات
create or replace view public.v_user_activity with (security_invoker = true) as
  select created_by as user_id, coalesce(published_at, created_at) as at, 'treport' as kind, case kind when 'meeting' then 'محضر اجتماع: ' else 'تقرير فني: ' end || title as title, project_id, '#/treport/' || id as link, case when status = 'reviewed' then 'reviewed' when status = 'returned' then 'returned' else status end as outcome, id::text as ref from public.tech_reports where status <> 'draft'
  union all select created_by, created_at, 'update', 'تحديث (' || coalesce(kind, 'note') || '): ' || left(body, 100), project_id, '#/project/' || project_id || '/updates', null, id::text from public.project_updates
  union all select created_by, created_at, 'payment', 'إعداد مستخلص رقم ' || no, project_id, '#/project/' || project_id || '/payments', status, id::text from public.payments
  union all select created_by, created_at, 'submittal', 'طلب اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || title, project_id, '#/project/' || project_id || '/submittals', decision, id::text from public.submittals
  union all select engineer_by, engineer_at, 'submittal_review', 'مراجعة اعتماد SUB-' || lpad(no::text, 3, '0') || ' (' || coalesce(engineer_recommend, '') || ')', project_id, '#/project/' || project_id || '/submittals', case when decision is null then null when (engineer_recommend = 'approve' and decision = 'approved') or (engineer_recommend = 'approve_notes' and decision = 'approved_notes') or (engineer_recommend = 'resubmit' and decision = 'resubmit') or (engineer_recommend = 'reject' and decision = 'rejected') then 'agreed' else 'changed' end, id::text from public.submittals where engineer_at is not null
  union all select decided_by, decided_at, 'submittal_decision', 'قرار اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || coalesce(decision, ''), project_id, '#/project/' || project_id || '/submittals', decision, id::text from public.submittals where decided_at is not null
  union all select assignee_id, done_at, 'task_done', 'إنجاز مهمة: ' || title, project_id, '#/project/' || project_id || '/tasks', case when due_date is null then 'no_due' when done_at::date <= due_date then 'on_time' else 'late' end, id::text from public.tasks where status = 'done' and done_at is not null and assignee_id is not null
  union all select created_by, created_at, 'task_created', 'تكليف بمهمة: ' || title, project_id, '#/project/' || project_id || '/tasks', null, id::text from public.tasks where created_by is not null
  union all select created_by, created_at, 'challenge', 'رصد تحدٍ (' || severity || '): ' || title, project_id, '#/challenges?id=' || id, status, id::text from public.challenges
  union all select closed_by, closed_at, 'challenge_closed', 'إغلاق تحدٍ: ' || title, project_id, '#/challenges?id=' || id, close_reason, id::text from public.challenges where closed_at is not null and closed_by is not null
  union all select n.by_user, n.at, 'challenge_note', 'متابعة تحدٍ: ' || left(n.body, 80), c.project_id, '#/challenges?id=' || c.id, null, n.id::text from public.challenge_notes n join public.challenges c on c.id = n.challenge_id
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
