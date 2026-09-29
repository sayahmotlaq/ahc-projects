-- ===== أوامر التغيير والتمديدات + الإغلاق والضمان =====
-- قيمة العقد الأصلية تُحفظ منفصلة؛ الإجمالي = الأصلية + أوامر التغيير المعتمدة
alter table public.projects add column if not exists contract_base numeric(16,2);
update public.projects set contract_base = coalesce(contract_value,0) - coalesce(contract_extra,0) where contract_base is null and contract_value is not null;
alter table public.projects add column if not exists handover_initial_date date;
alter table public.projects add column if not exists handover_final_date date;
alter table public.projects add column if not exists warranty_months int default 12;
alter table public.projects add column if not exists warranty_end date;
alter table public.projects add column if not exists retention_release_date date;
alter table public.projects add column if not exists contractor_rating jsonb;
alter table public.projects add column if not exists lessons text;

create table if not exists public.change_orders (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  no int not null default 1,
  kind text not null default 'cost' check (kind in ('cost','time','both')),
  title text not null, description text default '', reason text default '',
  amount numeric(16,2) default 0,   -- موجب زيادة / سالب تخفيض
  days int default 0,               -- أيام التمديد
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  requested_by text default '', requested_on date default current_date,
  decided_by uuid, decided_at timestamptz, decision_note text,
  document_id bigint references public.documents(id) on delete set null,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists change_orders_project_idx on public.change_orders(project_id);
drop trigger if exists touch_change_orders on public.change_orders; create trigger touch_change_orders before update on public.change_orders for each row execute function public.touch();
drop trigger if exists audit_change_orders on public.change_orders; create trigger audit_change_orders after insert or update or delete on public.change_orders for each row execute function public.audit();
alter table public.change_orders enable row level security;
drop policy if exists p_read on public.change_orders; drop policy if exists p_ins on public.change_orders; drop policy if exists p_upd on public.change_orders; drop policy if exists p_del on public.change_orders;
create policy p_read on public.change_orders for select using (public.can_read());
create policy p_ins on public.change_orders for insert with check (public.can_edit());
create policy p_upd on public.change_orders for update using (public.is_admin() or (public.can_edit() and status in ('draft','submitted','rejected'))) with check (public.can_edit());
create policy p_del on public.change_orders for delete using (public.is_admin() or (created_by = auth.uid() and status = 'draft'));
grant select, insert, update, delete on public.change_orders to authenticated;
grant usage, select on sequence public.change_orders_id_seq to authenticated;

-- القرار من صلاحية الإدارة
create or replace function public.guard_change_order() returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if new.status in ('approved','rejected') or new.decided_by is distinct from old.decided_by or new.decision_note is distinct from old.decision_note then raise exception 'اعتماد أمر التغيير من صلاحية الإدارة'; end if;
  return new;
end $$;
drop trigger if exists guard_change_order_trg on public.change_orders;
create trigger guard_change_order_trg before update on public.change_orders for each row execute function public.guard_change_order();

-- مزامنة العقد: الإضافي والمدة والانتهاء المعدّل من الأوامر المعتمدة
create or replace function public.sync_contract(pid uuid) returns void language plpgsql security definer set search_path = public as $$
declare a numeric; d int;
begin
  select coalesce(sum(amount),0), coalesce(sum(days),0) into a, d from public.change_orders where project_id = pid and status = 'approved';
  update public.projects set contract_extra = a, extra_days = d,
    contract_value = coalesce(contract_base, coalesce(contract_value,0) - coalesce(contract_extra,0)) + a,
    revised_end_date = case when end_date is not null and d > 0 then end_date + d else revised_end_date end
  where id = pid;
end $$;
create or replace function public.sync_contract_trg() returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.sync_contract(coalesce(new.project_id, old.project_id)); return coalesce(new, old); end $$;
drop trigger if exists sync_contract_after on public.change_orders;
create trigger sync_contract_after after insert or update or delete on public.change_orders for each row execute function public.sync_contract_trg();

-- إشعارات أوامر التغيير
create or replace function public.n_change_orders() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  t := 'أمر تغيير رقم ' || new.no || ' — ' || proj_name(new.project_id) || ': ' || new.title;
  if (tg_op = 'INSERT' and new.status = 'submitted') or (tg_op = 'UPDATE' and new.status = 'submitted' and old.status is distinct from 'submitted') then
    perform public.notify(public.admins(), 'change', 'أمر تغيير بانتظار اعتمادك: ' || t, case when new.amount <> 0 then to_char(new.amount, 'FMS999,999,999,990') || ' ر.س' else '' end || case when new.days <> 0 then ' · ' || new.days || ' يوم' else '' end, '#/project/' || new.project_id || '/changes');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved','rejected') then
    perform public.notify(array[new.created_by, proj_eng(new.project_id)], 'change', (case when new.status = 'approved' then 'اعتُمد ' else 'رُفض ' end) || t, coalesce(new.decision_note, ''), '#/project/' || new.project_id || '/changes');
  end if;
  return new;
end $$;
drop trigger if exists n_change_orders_trg on public.change_orders;
create trigger n_change_orders_trg after insert or update on public.change_orders for each row execute function public.n_change_orders();

-- ===== قائمة تحقق الإغلاق
create table if not exists public.closeout_items (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  sort int default 0, label text not null, done boolean default false, done_on date, note text default '', by_user uuid,
  updated_at timestamptz default now()
);
create index if not exists closeout_project_idx on public.closeout_items(project_id);
alter table public.closeout_items enable row level security;
drop policy if exists p_read on public.closeout_items; drop policy if exists p_all on public.closeout_items;
create policy p_read on public.closeout_items for select using (public.can_read());
create policy p_all on public.closeout_items for all using (public.can_edit()) with check (public.can_edit());
grant select, insert, update, delete on public.closeout_items to authenticated;
grant usage, select on sequence public.closeout_items_id_seq to authenticated;

-- تحديث تواريخ الضمان تلقائياً
create or replace function public.warranty_calc() returns trigger language plpgsql as $$
begin
  if new.handover_initial_date is not null then
    new.warranty_end := new.handover_initial_date + (coalesce(new.warranty_months, 12) || ' months')::interval;
    if new.retention_release_date is null or old.retention_release_date is not distinct from old.warranty_end then new.retention_release_date := new.warranty_end; end if;
  end if;
  return new;
end $$;
drop trigger if exists warranty_calc_trg on public.projects;
create trigger warranty_calc_trg before update on public.projects for each row execute function public.warranty_calc();

-- سجل الإنجازات: إضافة أوامر التغيير والإغلاق
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
  union all select by_user, updated_at, 'closeout', 'إغلاق: ' || label, project_id, '#/project/' || project_id || '/closeout', null, id::text from public.closeout_items where done and by_user is not null;
grant select on public.v_user_activity to authenticated;

-- الأوامر السابقة المستوردة من الإكسل: تُسجَّل كأمر تغيير معتمد واحد حتى لا تُمحى عند المزامنة
insert into public.change_orders(project_id, no, kind, title, description, amount, days, status, requested_on, decided_at)
select p.id, 0, case when coalesce(p.contract_extra,0) <> 0 and coalesce(p.extra_days,0) <> 0 then 'both' when coalesce(p.extra_days,0) <> 0 then 'time' else 'cost' end,
  'أوامر تغيير سابقة (مستوردة عند تشغيل المنصة)', 'قيمة إجمالية للأوامر المعتمدة قبل تشغيل الوحدة', coalesce(p.contract_extra,0), coalesce(p.extra_days,0), 'approved', current_date, now()
from public.projects p where (coalesce(p.contract_extra,0) <> 0 or coalesce(p.extra_days,0) <> 0) and not exists (select 1 from public.change_orders c where c.project_id = p.id);
