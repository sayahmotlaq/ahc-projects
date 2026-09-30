-- ===== تقويم الاشتراك (iCal): رمز لكل مستخدم + دالة تُرجع أحداثه =====

alter table public.profiles add column if not exists cal_token text;
create unique index if not exists profiles_cal_token_idx on public.profiles(cal_token) where cal_token is not null;

-- إنشاء/إعادة إنشاء رمز التقويم للمستخدم الحالي
create or replace function public.my_cal_token(p_reset boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then return null; end if;
  select cal_token into t from public.profiles where id = auth.uid();
  if t is null or p_reset then
    t := encode(gen_random_bytes(18), 'hex');
    update public.profiles set cal_token = t where id = auth.uid();
  end if;
  return t;
end $$;
revoke all on function public.my_cal_token(boolean) from public;
grant execute on function public.my_cal_token(boolean) to authenticated;

-- أحداث التقويم لصاحب الرمز (تُستدعى من دالة الحافة بمفتاح الخدمة)
create or replace function public.cal_feed(p_token text)
returns table (uid text, kind text, title text, descr text, on_date date, url text, done boolean, owner_name text)
language plpgsql security definer set search_path = public as $$
declare u uuid; r text; nm text; all_p boolean;
begin
  if p_token is null or length(p_token) < 16 then return; end if;
  select id, role, full_name into u, r, nm from public.profiles where cal_token = p_token and role not in ('pending', 'disabled');
  if u is null then return; end if;
  all_p := r <> 'engineer';
  return query
  -- PA: كل المشاريع (الأحداث الرئيسية تظهر للجميع لأن العمل جماعي) · P: مشاريع المستخدم (التفاصيل)
  with PA as (
    select * from public.projects p where p.archived = false
  ), P as (
    select * from PA p where all_p or p.engineer_id = u
  )
  -- المهام
  select 'task-' || t.id, 'task', case when t.status = 'done' then '✓ ' else '' end || 'مهمة: ' || t.title,
         coalesce(p.name, '') || case when t.assignee_id is not null then E'\nالمكلّف: ' || coalesce(public.pname(t.assignee_id), '') else '' end || case when t.details is not null and t.details <> '' then E'\n' || left(t.details, 300) else '' end,
         coalesce(case when t.status = 'done' then t.done_at::date end, t.due_date), '#/project/' || t.project_id || '/tasks', t.status = 'done', nm
  from public.tasks t left join public.projects p on p.id = t.project_id
  where t.status <> 'cancelled' and (t.assignee_id = u or all_p)
    and coalesce(case when t.status = 'done' then t.done_at::date end, t.due_date) is not null
    and (t.status <> 'done' or t.done_at > now() - interval '60 days')
  union all
  -- المعالم
  select 'ms-' || s.id, 'milestone', case when s.actual_end is not null then '✓ ' else '◆ ' end || 'معلم: ' || s.name, p.name || case when s.note is not null and s.note <> '' then E'\n' || s.note else '' end,
         coalesce(s.actual_end, s.planned_end), '#/project/' || s.project_id || '/schedule', s.actual_end is not null, nm
  from public.schedule_items s join PA p on p.id = s.project_id where s.kind = 'milestone' and coalesce(s.actual_end, s.planned_end) is not null
  union all
  -- تواريخ المشروع
  select 'p-start-' || p.id, 'project', 'المباشرة: ' || p.name, coalesce(p.facility, ''), p.start_date, '#/project/' || p.id, false, nm from PA p where p.start_date is not null
  union all
  select 'p-end-' || p.id, 'project', 'الانتهاء التعاقدي' || case when p.revised_end_date is not null and p.revised_end_date <> p.end_date then ' (المعدّل)' else '' end || ': ' || p.name, coalesce(p.facility, '') || case when p.contractor is not null then E'\nالمقاول: ' || p.contractor else '' end, coalesce(p.revised_end_date, p.end_date), '#/project/' || p.id, false, nm from PA p where coalesce(p.revised_end_date, p.end_date) is not null and p.stage in ('award', 'execution')
  union all
  select 'p-tender-' || p.id, 'project', 'الطرح: ' || p.name, coalesce(p.facility, ''), p.tender_date, '#/project/' || p.id, false, nm from PA p where p.tender_date is not null and p.stage in ('design', 'tender')
  union all
  select 'p-award-' || p.id, 'project', 'الترسية: ' || p.name, coalesce(p.facility, ''), p.award_date, '#/project/' || p.id, false, nm from PA p where p.award_date is not null and p.stage in ('tender', 'award')
  union all
  select 'p-ho-' || p.id, 'project', 'الاستلام الابتدائي: ' || p.name, coalesce(p.facility, ''), p.handover_initial_date, '#/project/' || p.id || '/closeout', false, nm from PA p where p.handover_initial_date is not null
  union all
  select 'p-warr-' || p.id, 'project', 'انتهاء فترة الضمان: ' || p.name, 'جولة فحص العيوب قبل الانتهاء', p.warranty_end, '#/project/' || p.id || '/closeout', false, nm from PA p where p.warranty_end is not null and p.stage in ('handover', 'warranty')
  union all
  select 'p-ret-' || p.id, 'project', 'الإفراج عن المحتجز: ' || p.name, '', p.retention_release_date, '#/project/' || p.id || '/closeout', false, nm from PA p where p.retention_release_date is not null and p.stage in ('handover', 'warranty')
  union all
  -- المستندات: انتهاء ضمانات وتأمين، ومهل الرد على الخطابات
  select 'doc-' || d.id, 'document', case d.category when 'bank_guarantee' then 'انتهاء ضمان بنكي: ' when 'insurance' then 'انتهاء وثيقة تأمين: ' else 'انتهاء: ' end || d.title, p.name || case when d.amount is not null then E'\nالمبلغ: ' || to_char(d.amount, 'FM999,999,999,990') || ' ر.س' else '' end, d.expiry_date, '#/project/' || d.project_id || '/docs', false, nm
  from public.documents d join P p on p.id = d.project_id where d.expiry_date is not null
  union all
  select 'docr-' || d.id, 'document', 'مهلة الرد على خطاب: ' || d.title, p.name || case when d.party is not null then E'\n' || d.party else '' end, d.reply_due, '#/project/' || d.project_id || '/docs', d.replied_on is not null, nm
  from public.documents d join P p on p.id = d.project_id where d.reply_due is not null and (d.replied_on is null or d.replied_on > current_date - 30)
  union all
  -- الاعتمادات
  select 'sub-' || s.id, 'submittal', 'مهلة الرد على اعتماد SUB-' || lpad(s.no::text, 3, '0') || ': ' || s.title, p.name, s.due_on, '#/project/' || s.project_id || '/submittals', s.status = 'decided', nm
  from public.submittals s join P p on p.id = s.project_id where s.due_on is not null and (s.status <> 'decided' or s.due_on > current_date - 30)
  union all
  -- المستخلصات المصروفة
  select 'pay-' || y.id, 'payment', 'صرف مستخلص رقم ' || y.no || ': ' || p.name, 'الصافي ' || to_char(coalesce(y.net_amount, 0), 'FM999,999,999,990') || ' ر.س', y.paid_on, '#/project/' || y.project_id || '/payments', true, nm
  from public.payments y join P p on p.id = y.project_id where y.status = 'paid' and y.paid_on is not null and y.paid_on > current_date - 180
  union all
  -- التحديات
  select 'ch-' || c.id, 'challenge', case when c.status = 'مغلق' then '✓ ' else '⚠ ' end || 'معالجة تحدٍ: ' || c.title, p.name || case when c.action is not null and c.action <> '' then E'\n' || left(c.action, 200) else '' end, c.due_date, '#/challenges?id=' || c.id, c.status = 'مغلق', nm
  from public.challenges c join P p on p.id = c.project_id where c.due_date is not null and (c.status <> 'مغلق' or c.closed_at > now() - interval '30 days')
  union all
  -- الاجتماعات
  select 'mt-' || t.id, 'meeting', 'اجتماع: ' || t.title, p.name, t.report_date, '#/treport/' || t.id, t.report_date < current_date, nm
  from public.tech_reports t join PA p on p.id = t.project_id where t.kind = 'meeting' and t.status <> 'draft' and t.report_date is not null and t.report_date > current_date - 60;
end $$;
revoke all on function public.cal_feed(text) from public;
grant execute on function public.cal_feed(text) to service_role;
