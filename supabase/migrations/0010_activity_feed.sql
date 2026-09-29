-- سجل الإنجازات: كل ما يفعله المستخدم في المنصة (يُبنى تلقائياً من الجداول)
alter table public.tasks add column if not exists created_by uuid;
alter table public.projects add column if not exists created_by uuid;
create or replace view public.v_user_activity with (security_invoker = true) as
  select created_by as user_id, coalesce(published_at, created_at) as at, 'treport' as kind,
         case kind when 'meeting' then 'محضر اجتماع: ' else 'تقرير فني: ' end || title as title, project_id, '#/treport/' || id as link,
         case when status = 'reviewed' then 'reviewed' when status = 'returned' then 'returned' else status end as outcome, id::text as ref
  from public.tech_reports where status <> 'draft'
  union all
  select created_by, created_at, 'update', 'تحديث (' || coalesce(kind, 'note') || '): ' || left(body, 100), project_id, '#/project/' || project_id || '/updates', null, id::text from public.project_updates
  union all
  select created_by, created_at, 'payment', 'إعداد مستخلص رقم ' || no, project_id, '#/project/' || project_id || '/payments', status, id::text from public.payments
  union all
  select created_by, created_at, 'submittal', 'طلب اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || title, project_id, '#/project/' || project_id || '/submittals', decision, id::text from public.submittals
  union all
  select engineer_by, engineer_at, 'submittal_review', 'مراجعة اعتماد SUB-' || lpad(no::text, 3, '0') || ' (' || coalesce(engineer_recommend, '') || ')', project_id, '#/project/' || project_id || '/submittals',
         case when decision is null then null when (engineer_recommend = 'approve' and decision = 'approved') or (engineer_recommend = 'approve_notes' and decision = 'approved_notes') or (engineer_recommend = 'resubmit' and decision = 'resubmit') or (engineer_recommend = 'reject' and decision = 'rejected') then 'agreed' else 'changed' end, id::text
  from public.submittals where engineer_at is not null
  union all
  select decided_by, decided_at, 'submittal_decision', 'قرار اعتماد SUB-' || lpad(no::text, 3, '0') || ': ' || coalesce(decision, ''), project_id, '#/project/' || project_id || '/submittals', decision, id::text from public.submittals where decided_at is not null
  union all
  select assignee_id, done_at, 'task_done', 'إنجاز مهمة: ' || title, project_id, '#/project/' || project_id || '/tasks',
         case when due_date is null then 'no_due' when done_at::date <= due_date then 'on_time' else 'late' end, id::text
  from public.tasks where status = 'done' and done_at is not null and assignee_id is not null
  union all
  select created_by, created_at, 'task_created', 'تكليف بمهمة: ' || title, project_id, '#/project/' || project_id || '/tasks', null, id::text from public.tasks where created_by is not null
  union all
  select created_by, created_at, 'challenge', 'رصد تحدٍ (' || severity || '): ' || title, project_id, '#/project/' || project_id || '/challenges', status, id::text from public.challenges
  union all
  select by_user, at, 'stage', 'نقل المشروع إلى مرحلة ' || to_stage, project_id, '#/project/' || project_id || '/log', null, id::text from public.project_stage_log where by_user is not null
  union all
  select created_by, created_at, 'request', 'طلب للإدارة: ' || title, project_id, '#/project/' || project_id || '/requests', status, id::text from public.requests
  union all
  select responded_by, responded_at, 'request_response', 'الرد على طلب: ' || title, project_id, '#/project/' || project_id || '/requests', status, id::text from public.requests where responded_at is not null
  union all
  select created_by, created_at, 'document', 'تسجيل مستند (' || category || '): ' || title, project_id, '#/project/' || project_id || '/docs', null, id::text from public.documents
  union all
  select r.created_by, r.created_at, 'drawing', 'رفع مخطط ' || coalesce(d.dwg_no, '') || ' مراجعة ' || r.rev, d.project_id, '#/project/' || d.project_id || '/drawings', r.status, r.id::text from public.drawing_revisions r join public.drawings d on d.id = r.drawing_id
  union all
  select created_by, created_at, 'boq', 'إعداد جدول كميات: ' || name, project_id, '#/project/' || project_id || '/boq', status, id::text from public.boqs
  union all
  select by_user, at, 'comment', 'تعليق على تقرير', (select project_id from public.tech_reports t where t.id = c.report_id), '#/treport/' || report_id, null, id::text from public.report_comments c
  union all
  select created_by, created_at, 'project', 'إنشاء مشروع: ' || name, id, '#/project/' || id, null, id::text from public.projects where created_by is not null;
grant select on public.v_user_activity to authenticated;

insert into public.settings(key, value) values ('perf_leaderboard', 'false'::jsonb) on conflict (key) do nothing;
