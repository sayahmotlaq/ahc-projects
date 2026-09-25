-- مركز الإشعارات + اشتراكات إشعارات الجهاز (Web Push)
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null,
  kind text not null default 'info',
  title text not null, body text default '', link text default '',
  read_at timestamptz, pushed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at, id desc);

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null,
  endpoint text unique not null, p256dh text not null, auth text not null,
  ua text default '', created_at timestamptz default now(), last_ok timestamptz
);
create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
alter table public.profiles add column if not exists notify_prefs jsonb default '{}'::jsonb;

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
drop policy if exists n_read on public.notifications; drop policy if exists n_upd on public.notifications; drop policy if exists n_del on public.notifications;
create policy n_read on public.notifications for select using (user_id = auth.uid());
create policy n_upd on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy n_del on public.notifications for delete using (user_id = auth.uid());
drop policy if exists ps_all on public.push_subscriptions;
create policy ps_all on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant usage, select on sequence public.notifications_id_seq, public.push_subscriptions_id_seq to authenticated;

-- أسرار الخادم (غير مكشوفة عبر الـ API)
create schema if not exists private;
create table if not exists private.secrets (key text primary key, value text);
revoke all on schema private from public, anon, authenticated;
revoke all on private.secrets from public, anon, authenticated;

-- ===== مولّد الإشعارات
create or replace function public.admins() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'admin' $$;
create or replace function public.finance_users() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role = 'finance' $$;
create or replace function public.pname(p_id uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select full_name from public.profiles where id = p_id), '') $$;
create or replace function public.notify(p_users uuid[], p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if p_users is null then return; end if;
  for u in select distinct x from unnest(p_users) x where x is not null and x is distinct from auth.uid() loop
    insert into public.notifications(user_id, kind, title, body, link) values (u, p_kind, left(p_title, 140), left(coalesce(p_body, ''), 300), coalesce(p_link, ''));
  end loop;
end $$;
create or replace function public.proj_name(p_id uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.projects where id = p_id), '') $$;
create or replace function public.proj_eng(p_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  select engineer_id from public.projects where id = p_id $$;

-- المهام
create or replace function public.n_tasks() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.assignee_id is not null then perform public.notify(array[new.assignee_id], 'task', 'مهمة جديدة: ' || new.title, proj_name(new.project_id) || case when new.due_date is not null then ' · الموعد ' || to_char(new.due_date, 'YYYY-MM-DD') else '' end, '#/project/' || new.project_id || '/tasks'); end if;
  else
    if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then perform public.notify(array[new.assignee_id], 'task', 'كُلفت بمهمة: ' || new.title, proj_name(new.project_id), '#/project/' || new.project_id || '/tasks'); end if;
    if new.status is distinct from old.status and new.status in ('done', 'in_progress') then perform public.notify(public.admins(), 'task', (case when new.status = 'done' then 'أُنجزت مهمة: ' else 'بدأ العمل على مهمة: ' end) || new.title, proj_name(new.project_id) || ' · ' || pname(auth.uid()), '#/project/' || new.project_id || '/tasks'); end if;
  end if;
  return new;
end $$;
drop trigger if exists n_tasks_trg on public.tasks; create trigger n_tasks_trg after insert or update on public.tasks for each row execute function public.n_tasks();

-- الطلبات
create or replace function public.n_requests() returns trigger language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if tg_op = 'INSERT' then
    perform public.notify(public.admins(), 'request', 'طلب جديد: ' || new.title, proj_name(new.project_id) || ' · ' || pname(new.created_by), '#/project/' || new.project_id || '/requests');
  elsif new.status is distinct from old.status then
    st := case new.status when 'in_review' then 'قيد المراجعة' when 'approved' then 'معتمد' when 'rejected' then 'مرفوض' when 'done' then 'منفذ' else new.status end;
    perform public.notify(array[new.created_by], 'request', 'طلبك «' || new.title || '»: ' || st, coalesce(new.response, ''), '#/project/' || new.project_id || '/requests');
  end if;
  return new;
end $$;
drop trigger if exists n_requests_trg on public.requests; create trigger n_requests_trg after insert or update on public.requests for each row execute function public.n_requests();

-- التقارير الفنية والتعليقات
create or replace function public.n_treports() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'published') or (tg_op = 'UPDATE' and new.status = 'published' and old.status is distinct from 'published') then
    perform public.notify(public.admins(), 'treport', 'تقرير فني جديد: ' || new.title, proj_name(new.project_id) || ' · ' || pname(new.created_by), '#/treport/' || new.id);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('reviewed', 'returned') then
    perform public.notify(array[new.created_by], 'treport', case when new.status = 'reviewed' then 'تمت مراجعة تقريرك: ' else 'أُعيد تقريرك للتعديل: ' end || new.title, coalesce(new.review_note, ''), '#/treport/' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists n_treports_trg on public.tech_reports; create trigger n_treports_trg after insert or update on public.tech_reports for each row execute function public.n_treports();
create or replace function public.n_report_comments() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; users uuid[];
begin
  select * into r from public.tech_reports where id = new.report_id;
  select coalesce(array_agg(distinct by_user), '{}') into users from public.report_comments where report_id = new.report_id;
  users := users || r.created_by;
  if r.created_by = new.by_user then users := users || public.admins(); end if;
  perform public.notify(users, 'comment', 'تعليق على تقرير: ' || r.title, pname(new.by_user) || ': ' || left(new.body, 120), '#/treport/' || r.id);
  return new;
end $$;
drop trigger if exists n_report_comments_trg on public.report_comments; create trigger n_report_comments_trg after insert on public.report_comments for each row execute function public.n_report_comments();

-- المستخلصات
create or replace function public.n_payments() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    t := 'مستخلص رقم ' || new.no || ' — ' || proj_name(new.project_id);
    if new.status = 'submitted' then perform public.notify(public.admins(), 'payment', 'مستخلص مقدَّم للاعتماد: ' || t, 'الصافي ' || to_char(new.net_amount, 'FM999,999,999,990.00') || ' ر.س', '#/project/' || new.project_id || '/payments');
    elsif new.status = 'finance' then perform public.notify(public.finance_users() || array[new.created_by], 'payment', 'أُحيل للمالية: ' || t, 'الصافي ' || to_char(new.net_amount, 'FM999,999,999,990.00') || ' ر.س', '#/project/' || new.project_id || '/payments');
    elsif new.status = 'paid' then perform public.notify(public.admins() || array[new.created_by], 'payment', 'تم صرف: ' || t, coalesce('أمر الدفع ' || nullif(new.payment_order_no, ''), ''), '#/project/' || new.project_id || '/payments');
    elsif new.status in ('approved', 'rejected') then perform public.notify(array[new.created_by], 'payment', (case when new.status = 'approved' then 'اعتُمد ' else 'رُفض / أُعيد ' end) || t, coalesce(new.reject_reason, ''), '#/project/' || new.project_id || '/payments');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists n_payments_trg on public.payments; create trigger n_payments_trg after update on public.payments for each row execute function public.n_payments();

-- الاعتمادات
create or replace function public.n_submittals() returns trigger language plpgsql security definer set search_path = public as $$
declare t text;
begin
  t := 'SUB-' || lpad(new.no::text, 3, '0') || case when new.rev > 0 then '-R' || new.rev else '' end || ' ' || new.title;
  if tg_op = 'INSERT' then
    perform public.notify(public.admins() || array[proj_eng(new.project_id)], 'submittal', 'طلب اعتماد جديد: ' || t, proj_name(new.project_id) || ' · موعد الرد ' || coalesce(to_char(new.due_on, 'YYYY-MM-DD'), ''), '#/project/' || new.project_id || '/submittals');
  elsif new.status is distinct from old.status then
    if new.status = 'reviewed' then perform public.notify(public.admins(), 'submittal', 'اعتماد بانتظار قرارك: ' || t, 'توصية المهندس: ' || coalesce(new.engineer_recommend, ''), '#/project/' || new.project_id || '/submittals');
    elsif new.status = 'decided' then perform public.notify(array[new.created_by, proj_eng(new.project_id)], 'submittal', 'صدر القرار على ' || t, case new.decision when 'approved' then 'معتمد (A)' when 'approved_notes' then 'معتمد بملاحظات (B)' when 'resubmit' then 'أعد التقديم (C)' else 'مرفوض (D)' end || coalesce(' — ' || nullif(new.decision_note, ''), ''), '#/project/' || new.project_id || '/submittals');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists n_submittals_trg on public.submittals; create trigger n_submittals_trg after insert or update on public.submittals for each row execute function public.n_submittals();

-- التحديات الحرجة وتغيير المراحل
create or replace function public.n_challenges() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.severity in ('عالية', 'حرجة') then perform public.notify(public.admins() || array[proj_eng(new.project_id)], 'challenge', 'تحدٍ ' || new.severity || ': ' || new.title, proj_name(new.project_id), '#/project/' || new.project_id || '/challenges'); end if;
  return new;
end $$;
drop trigger if exists n_challenges_trg on public.challenges; create trigger n_challenges_trg after insert on public.challenges for each row execute function public.n_challenges();
create or replace function public.n_stage() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(public.admins() || array[proj_eng(new.project_id)], 'stage', 'تغيّرت مرحلة ' || proj_name(new.project_id), coalesce(new.from_stage, '') || ' ← ' || new.to_stage || coalesce(' — ' || nullif(new.note, ''), ''), '#/project/' || new.project_id || '/log');
  return new;
end $$;
drop trigger if exists n_stage_trg on public.project_stage_log; create trigger n_stage_trg after insert on public.project_stage_log for each row execute function public.n_stage();

-- المشاريع الراكدة (تُستدعى يومياً من جدولة النشر)
create or replace function public.notify_stale_projects() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select p.id, p.name, p.engineer_id, coalesce(a.last_activity, p.updated_at) as last from public.projects p left join public.v_project_activity a on a.project_id = p.id
           where p.archived = false and p.stage not in ('closed', 'cancelled') and coalesce(a.last_activity, p.updated_at) < now() - interval '14 days' loop
    if not exists (select 1 from public.notifications where kind = 'stale' and link = '#/project/' || r.id || '/overview' and created_at > now() - interval '7 days') then
      perform public.notify(public.admins() || array[r.engineer_id], 'stale', 'مشروع بلا تحديث: ' || r.name, 'آخر نشاط ' || to_char(r.last, 'YYYY-MM-DD'), '#/project/' || r.id || '/overview'); n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- دفع الإشعار إلى دالة الإرسال (Web Push) عبر pg_net إن كان مضبوطاً
do $$ begin create extension if not exists pg_net with schema extensions; exception when others then raise notice 'pg_net: %', sqlerrm; end $$;
create or replace function public.push_notification() returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare url text; sec text;
begin
  select value into url from private.secrets where key = 'push_url';
  select value into sec from private.secrets where key = 'push_secret';
  if url is null or sec is null then return new; end if;
  perform net.http_post(url := url, headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', sec),
    body := jsonb_build_object('id', new.id, 'user_id', new.user_id, 'kind', new.kind, 'title', new.title, 'body', new.body, 'link', new.link), timeout_milliseconds := 5000);
  return new;
exception when others then return new;
end $$;
drop trigger if exists push_notification_trg on public.notifications; create trigger push_notification_trg after insert on public.notifications for each row execute function public.push_notification();
