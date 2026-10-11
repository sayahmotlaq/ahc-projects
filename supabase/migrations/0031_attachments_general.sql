-- ===== حزمة 59: مرفقات عامة (PDF وملفات) لأي عنصر · طلبات عامة بلا مشروع · حذف/تعديل التقارير الفنية لصاحبها · تحسينات أمان من فاحص Supabase =====

-- ---------- 1) المرفقات: ملفات مرتبطة بأي عنصر عبر مفتاح نصي ref مثل treport:12 أو thread:c-55 أو request:7 أو task:3 أو challenge:9
create table if not exists public.attachments (
  id bigserial primary key,
  ref text not null,
  project_id uuid references public.projects(id) on delete set null,
  name text not null, path text not null, size int default 0, mime text default '',
  by_user uuid, at timestamptz default now()
);
create index if not exists attachments_ref_idx on public.attachments(ref);
alter table public.attachments enable row level security;
grant select, insert, update, delete on public.attachments to authenticated;
grant usage, select on sequence public.attachments_id_seq to authenticated;
drop policy if exists p_read on public.attachments; create policy p_read on public.attachments for select using (public.can_read());
drop policy if exists p_ins on public.attachments; create policy p_ins on public.attachments for insert with check (public.can_read() and by_user = auth.uid());
drop policy if exists p_del on public.attachments; create policy p_del on public.attachments for delete using (public.is_admin() or by_user = auth.uid());
-- الرفع إلى حاوية project-files تحت المسار attach/ (سياسات الحاوية موجودة من 0007 وتسمح للمهندس والإدارة؛ نسمح للجميع ممن يقرأ بالرفع تحت attach/)
do $$ begin
  drop policy if exists pf_ins_attach on storage.objects;
  create policy pf_ins_attach on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and name like 'attach/%' and public.can_read());
exception when others then null; end $$;

-- ---------- 2) الطلبات العامة (بلا مشروع): العمود يقبل null أصلاً؛ نضبط الإشعار والروابط
create or replace function public.n_requests() returns trigger language plpgsql security definer set search_path = public as $$
declare st text; lnk text;
begin
  lnk := case when new.project_id is null then '#/open/request/' || new.id else '#/project/' || new.project_id || '/requests' end;
  if tg_op = 'INSERT' then
    perform public.notify(public.admins(), 'request', 'طلب جديد: ' || new.title, coalesce(proj_name(new.project_id), 'طلب عام') || ' · ' || coalesce(pname(new.created_by), ''), lnk);
  elsif new.status is distinct from old.status then
    st := case new.status when 'in_review' then 'قيد المراجعة' when 'approved' then 'معتمد' when 'rejected' then 'مرفوض' when 'done' then 'منفذ' else new.status end;
    perform public.notify(array[new.created_by], 'request', 'طلبك «' || new.title || '»: ' || st, coalesce(new.response, ''), lnk);
  end if;
  return new;
end $$;

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
  union all select created_by, created_at, 'request', 'طلب للإدارة: ' || title, project_id, case when project_id is null then '#/open/request/' || id else '#/project/' || project_id || '/requests' end, status, id::text from public.requests
  union all select responded_by, responded_at, 'request_response', 'الرد على طلب: ' || title, project_id, case when project_id is null then '#/open/request/' || id else '#/project/' || project_id || '/requests' end, status, id::text from public.requests where responded_at is not null
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

-- ---------- 3) التقارير الفنية: صاحب التقرير يحذفه ما لم يكن قد رُوجع (كان الحذف للمسودة فقط)
drop policy if exists p_del on public.tech_reports;
create policy p_del on public.tech_reports for delete using (public.is_admin() or (created_by = auth.uid() and status <> 'reviewed'));

-- ---------- 4) أمان: تثبيت search_path للدوال (تحذير فاحص Supabase) و v_dashboard بصلاحيات المستعلِم
do $$ declare f text; begin
  foreach f in array array['audit()','brief_items_touch_fn()','briefs_touch()','calc_payment()','can_docs()','can_edit()','can_read()','challenge_close_stamp()','guard_change_order()','guard_payment()','guard_request_update()','guard_submittal()','guard_task_update()','guard_tech_report()','is_admin()','is_finance()','norm_name(text)','sync_paid_project()','touch()','track_price()','warranty_calc()'] loop
    begin execute format('alter function public.%s set search_path = public', f); exception when others then null; end;
  end loop;
end $$;
alter view public.v_dashboard set (security_invoker = true);
-- v_leaves_cal تبقى security definer عمداً: تقويم الفريق يعرض الإجازات المعتمدة للجميع بينما جدول leaves خاص بصاحبه وبديله.
