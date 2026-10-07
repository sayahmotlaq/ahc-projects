-- ===== سلسلة المتابعة الموحدة (Thread): تعليقات على المهام والاعتمادات والمستخلصات وأوامر التغيير والإجازات، مع توحيد القراءة مع متابعات الطلبات والتحديات والتقارير =====
create table if not exists public.comments (
  id bigserial primary key,
  kind text not null check (kind in ('task','submittal','payment','change','leave','project','boq')),
  ref_id bigint not null,
  project_id uuid references public.projects(id) on delete cascade,
  body text not null,
  by_user uuid references public.profiles(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists comments_ref_idx on public.comments(kind, ref_id);
create index if not exists comments_project_idx on public.comments(project_id, at desc);
alter table public.comments enable row level security;
drop policy if exists p_read on public.comments; create policy p_read on public.comments for select using (public.can_read());
drop policy if exists p_ins on public.comments; create policy p_ins on public.comments for insert with check (public.can_read() and by_user = auth.uid());
drop policy if exists p_del on public.comments; create policy p_del on public.comments for delete using (public.is_admin() or by_user = auth.uid());
grant select, insert, delete on public.comments to authenticated;
grant usage, select on sequence public.comments_id_seq to authenticated;

-- عرض موحد لكل سلاسل المتابعة (القديمة والجديدة)
create or replace view public.v_thread with (security_invoker = true) as
  select 'c-' || c.id as uid, c.kind, c.ref_id, c.project_id, c.body, c.by_user, c.at, null::text as status_after from public.comments c
  union all select 'r-' || x.id, 'request', x.request_id, r.project_id, x.body, x.by_user, x.at, x.status_after from public.request_replies x join public.requests r on r.id = x.request_id
  union all select 'n-' || n.id, 'challenge', n.challenge_id, ch.project_id, n.body, n.by_user, n.at, null from public.challenge_notes n join public.challenges ch on ch.id = n.challenge_id
  union all select 't-' || t.id, 'treport', t.report_id, tr.project_id, t.body, t.by_user, t.at, null from public.report_comments t join public.tech_reports tr on tr.id = t.report_id;
grant select on public.v_thread to authenticated;

-- الإشعار: الإدارة + مهندس المشروع + صاحب العنصر (المكلّف/المقدّم) عدا الكاتب
create or replace function public.comments_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare who uuid[] := public.admins(); lbl text := ''; lnk text := '#/open/' || new.kind || '/' || new.ref_id; pid uuid := new.project_id; o uuid;
begin
  if new.kind = 'task' then select assignee_id, project_id, 'مهمة: ' || title into o, pid, lbl from public.tasks where id = new.ref_id;
  elsif new.kind = 'submittal' then select created_by, project_id, 'اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || title into o, pid, lbl from public.submittals where id = new.ref_id;
  elsif new.kind = 'payment' then select created_by, project_id, 'مستخلص رقم ' || no into o, pid, lbl from public.payments where id = new.ref_id;
  elsif new.kind = 'change' then select created_by, project_id, 'أمر تغيير رقم ' || no into o, pid, lbl from public.change_orders where id = new.ref_id;
  elsif new.kind = 'leave' then select user_id, null, 'طلب إجازة #' || id into o, pid, lbl from public.leaves where id = new.ref_id; who := who || (select delegate_id from public.leaves where id = new.ref_id);
  elsif new.kind = 'boq' then select created_by, project_id, 'جدول كميات: ' || name into o, pid, lbl from public.boqs where id = new.ref_id;
  elsif new.kind = 'project' then select engineer_id, id, name into o, pid, lbl from public.projects where id::text = new.ref_id::text;
  end if;
  if pid is not null then who := who || array[public.proj_eng(pid)]; if new.project_id is null then new.project_id := pid; end if; end if;
  who := who || array[o];
  perform public.notify(who, 'comment', 'متابعة من ' || coalesce(public.pname(new.by_user), '') || ' على ' || lbl, left(new.body, 160), lnk);
  return new;
end $$;
drop trigger if exists comments_ai on public.comments;
create trigger comments_ai before insert on public.comments for each row execute function public.comments_ai();
-- متابعات الطلبات تُشعر أيضاً (صاحب الطلب والإدارة)
create or replace function public.request_replies_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.requests where id = new.request_id;
  perform public.notify(public.admins() || array[r.created_by, public.proj_eng(r.project_id)], 'comment', 'متابعة من ' || coalesce(public.pname(new.by_user), '') || ' على طلب: ' || r.title, left(new.body, 160), '#/open/request/' || r.id);
  return new;
end $$;
drop trigger if exists request_replies_ai on public.request_replies;
create trigger request_replies_ai after insert on public.request_replies for each row execute function public.request_replies_ai();

-- آخر نشاط للمشروع يشمل كل المتابعات
create or replace view public.v_project_activity with (security_invoker = true) as
select p.id as project_id,
  greatest(p.updated_at,
    coalesce((select max(u.created_at) from public.project_updates u where u.project_id = p.id), p.created_at),
    coalesce((select max(l.at) from public.project_stage_log l where l.project_id = p.id), p.created_at),
    coalesce((select max(t.updated_at) from public.tasks t where t.project_id = p.id), p.created_at),
    coalesce((select max(r.updated_at) from public.requests r where r.project_id = p.id), p.created_at),
    coalesce((select max(c.updated_at) from public.challenges c where c.project_id = p.id), p.created_at),
    coalesce((select max(b.updated_at) from public.boqs b where b.project_id = p.id), p.created_at),
    coalesce((select max(v.at) from public.v_thread v where v.project_id = p.id), p.created_at),
    coalesce((select max(coalesce(t.published_at, t.created_at)) from public.tech_reports t where t.project_id = p.id), p.created_at)
  ) as last_activity
from public.projects p;
grant select on public.v_project_activity to authenticated;

-- نشاط المستخدم يشمل المتابعات (تُعاد الصياغة هنا لأن 0017 تعيد إنشاء العرض في كل نشر)
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
  union all select a.by_user, a.at, 'schedule_update', 'تحديث إنجاز: ' || coalesce(a.new_data->>'name', '') || ' → ' || coalesce(a.new_data->>'pct', '') || '%', (a.new_data->>'project_id')::uuid, '#/project/' || (a.new_data->>'project_id') || '/schedule', null, a.id::text from public.audit_log a where a.table_name = 'schedule_items' and a.action = 'UPDATE' and a.by_user is not null and (a.old_data->>'pct') is distinct from (a.new_data->>'pct')
  union all select c.by_user, c.at, 'comment', 'متابعة على ' || case c.kind when 'task' then 'مهمة' when 'submittal' then 'اعتماد' when 'payment' then 'مستخلص' when 'change' then 'أمر تغيير' when 'leave' then 'إجازة' when 'boq' then 'جدول كميات' else 'مشروع' end || ': ' || left(c.body, 80), c.project_id, '#/open/' || c.kind || '/' || c.ref_id, null, c.id::text from public.comments c where c.by_user is not null
  union all select x.by_user, x.at, 'request_reply', 'متابعة طلب: ' || left(x.body, 80), r.project_id, '#/open/request/' || r.id, x.status_after, x.id::text from public.request_replies x join public.requests r on r.id = x.request_id where x.by_user is not null;
grant select on public.v_user_activity to authenticated;
