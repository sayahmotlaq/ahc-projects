-- 0040: متابعة أنظمة المنشآت (2): إلزام ذكر الإجراء المتخذ مع كل تحديث، مؤشر «بلا تحديث»، مرفقات الملاحظات لدور المرافق،
-- رابط مشاركة التقرير الشهري مع ملاحظات الجهة التنفيذية، والملخص اليومي لفريق المرافق. قابل لإعادة التشغيل.

-- ---------- 1) آخر إجراء متخذ
alter table public.fm_obs add column if not exists last_action text default '';
alter table public.fm_obs add column if not exists last_action_at timestamptz;
alter table public.fm_obs add column if not exists last_action_by uuid references auth.users(id);
update public.fm_obs set last_action_at = case when source = 'import' then created_at else coalesce(updated_at, created_at) end where last_action_at is null;
update public.fm_obs set last_action = details where source = 'import' and coalesce(last_action, '') = '' and coalesce(details, '') <> '';

-- لا يتغير الحال ولا الخطوة إلا بذكر المعالجة أو الإجراء المتخذ (نص جديد غير السابق)
create or replace function public.fm_obs_biu() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.last_action_at := coalesce(new.last_action_at, new.created_at, now());
    if coalesce(new.last_action, '') <> '' then new.last_action_by := coalesce(new.last_action_by, auth.uid()); end if;
  else
    if (new.status is distinct from old.status or new.step is distinct from old.step)
       and (coalesce(btrim(new.last_action), '') = '' or new.last_action is not distinct from old.last_action) then
      raise exception 'يلزم ذكر المعالجة أو الإجراء المتخذ عند تحديث حالة الملاحظة أو خطوتها' using errcode = 'P0001';
    end if;
    if new.last_action is distinct from old.last_action then new.last_action_at := now(); new.last_action_by := auth.uid(); end if;
  end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then
    new.closed_at := coalesce(new.closed_at, now()); new.closed_by := coalesce(new.closed_by, auth.uid());
    if coalesce(new.close_note, '') = '' then new.close_note := coalesce(new.last_action, ''); end if;
  end if;
  if new.status <> 'closed' then new.closed_at := null; new.closed_by := null; end if;
  return new;
end $$;

create or replace function public.fm_obs_aiu() returns trigger language plpgsql security definer set search_path = public as $$
declare st jsonb := '{"open":"مفتوحة","in_progress":"قيد المعالجة","verify":"بانتظار التحقق","closed":"مغلقة"}'; fac text; lnk text; parts text[] := '{}'; moved boolean;
begin
  select name into fac from public.facilities where id = new.facility_id;
  lnk := '#/fm/obs?id=' || new.id;
  if tg_op = 'INSERT' then
    if new.source = 'import' then return new; end if;
    perform public.notify(public.admins() || array[new.assignee_id], 'fm', 'ملاحظة جديدة: ' || new.title, coalesce(fac, ''), lnk);
    return new;
  end if;
  moved := new.status is distinct from old.status or new.step is distinct from old.step;
  if new.status is distinct from old.status then parts := parts || ('الحالة: ' || (st->>old.status) || ' ← ' || (st->>new.status)); end if;
  if new.step is distinct from old.step then parts := parts || ('الخطوة: ' || coalesce(old.step::text, '—') || ' ← ' || coalesce(new.step::text, '—')); end if;
  if new.proc is distinct from old.proc then parts := parts || ('الإجراء الحاكم: ' || coalesce(nullif(old.proc, ''), '—') || ' ← ' || coalesce(nullif(new.proc, ''), '—')); end if;
  if new.due_date is distinct from old.due_date then parts := parts || ('الموعد: ' || coalesce(new.due_date::text, '—')); end if;
  if new.assignee_id is distinct from old.assignee_id or new.assignee_name is distinct from old.assignee_name then parts := parts || ('المسؤول: ' || coalesce((select full_name from public.profiles where id = new.assignee_id), nullif(new.assignee_name, ''), '—')); end if;
  if new.project_id is distinct from old.project_id then parts := parts || ('المشروع: ' || coalesce(public.proj_name(new.project_id), '—')); end if;
  if array_length(parts, 1) > 0 then
    insert into public.fm_obs_log(obs_id, kind, body, by_user) values (new.id, 'change',
      array_to_string(parts, ' · ') || case when moved and new.last_action is distinct from old.last_action then E'\nالإجراء المتخذ: ' || new.last_action else '' end, auth.uid());
  end if;
  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify(array[new.assignee_id], 'fm', 'كُلّفت بملاحظة: ' || new.title, coalesce(fac, ''), lnk);
  elsif new.status is distinct from old.status then
    perform public.notify(public.admins() || array[new.assignee_id, new.created_by], 'fm', (st->>new.status) || ': ' || new.title, coalesce(fac, '') || ' — ' || left(coalesce(new.last_action, ''), 120), lnk);
  end if;
  return new;
end $$;

-- كل متابعة مكتوبة تُعد تحديثاً: تصبح «آخر إجراء» للملاحظة
create or replace function public.fm_log_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if new.kind <> 'note' then return new; end if;
  update public.fm_obs set last_action = new.body where id = new.obs_id returning * into o;
  perform public.notify(array[o.assignee_id, o.created_by] || public.admins(), 'fm', 'متابعة على ملاحظة: ' || o.title, left(new.body, 140), '#/fm/obs?id=' || o.id);
  return new;
end $$;

-- ---------- 2) مرفقات الملاحظات وصورها لدور المرافق (المرجع fmobs:<id>، المسار attach/fmobs_<id>/…)
drop policy if exists p_fm_read on public.attachments;
create policy p_fm_read on public.attachments for select using (public.my_role() = 'facility' and ref like 'fmobs:%');
drop policy if exists p_fm_ins on public.attachments;
create policy p_fm_ins on public.attachments for insert with check (public.my_role() = 'facility' and ref like 'fmobs:%' and by_user = auth.uid());
do $$ begin
  drop policy if exists pf_fm_read on storage.objects;
  create policy pf_fm_read on storage.objects for select to authenticated using (bucket_id = 'project-files' and name like 'attach/fmobs\_%' and public.my_role() = 'facility');
  drop policy if exists pf_fm_ins on storage.objects;
  create policy pf_fm_ins on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and name like 'attach/fmobs\_%' and public.my_role() = 'facility');
exception when others then null; end $$;

-- ---------- 3) رابط مشاركة التقرير الشهري (إصدار مجمّد) + ملاحظات الجهة التنفيذية
create table if not exists public.fm_shares (
  id bigserial primary key,
  token text not null unique,
  period date not null,
  title text not null default 'تقرير حالة الأنظمة الحرجة في المنشآت',
  data jsonb not null,
  pin text,
  expires_at timestamptz not null default now() + interval '45 days',
  revoked boolean not null default false,
  views int not null default 0, last_viewed_at timestamptz,
  created_by uuid, created_at timestamptz default now()
);
create table if not exists public.fm_share_notes (
  id bigserial primary key,
  share_id bigint not null references public.fm_shares(id) on delete cascade,
  name text not null, role_title text default '', body text not null,
  ref text default '', ref_title text default '',
  seen boolean not null default false, created_at timestamptz default now()
);
do $$ declare t text; begin
  foreach t in array array['fm_shares','fm_share_notes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists p_admin on public.%I', t);
    execute format('create policy p_admin on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop; end $$;
grant usage, select on sequence public.fm_shares_id_seq, public.fm_share_notes_id_seq to authenticated;

create or replace function public.get_fm_share(p_token text, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_token is null or length(p_token) < 16 then return jsonb_build_object('error', 'bad_token'); end if;
  select * into r from public.fm_shares where token = p_token;
  if not found or r.revoked then return jsonb_build_object('error', 'not_found'); end if;
  if r.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if r.pin is not null and r.pin <> coalesce(p_pin, '') then return jsonb_build_object('error', 'pin'); end if;
  update public.fm_shares set views = views + 1, last_viewed_at = now() where id = r.id;
  return jsonb_build_object('id', r.id, 'title', r.title, 'period', r.period, 'issued', r.created_at, 'expires', r.expires_at, 'data', r.data);
end $$;
revoke all on function public.get_fm_share(text, text) from public;
grant execute on function public.get_fm_share(text, text) to anon, authenticated;

create or replace function public.add_fm_share_note(p_token text, p_name text, p_role text, p_body text, p_ref text default '', p_ref_title text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_name text := left(coalesce(btrim(p_name), ''), 80); v_body text := left(coalesce(btrim(p_body), ''), 1500);
begin
  select * into r from public.fm_shares where token = p_token and not revoked and expires_at > now();
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_name = '' or v_body = '' then return jsonb_build_object('error', 'empty'); end if;
  if (select count(*) from public.fm_share_notes where share_id = r.id and created_at > now() - interval '1 hour') >= 20 then return jsonb_build_object('error', 'rate'); end if;
  insert into public.fm_share_notes(share_id, name, role_title, body, ref, ref_title) values (r.id, v_name, left(coalesce(p_role, ''), 80), v_body, left(coalesce(p_ref, ''), 60), left(coalesce(p_ref_title, ''), 200));
  perform public.notify(public.admins(), 'fm', 'ملاحظة على تقرير الأنظمة من ' || v_name, left(v_body, 200), '#/fm/report?notes=1');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.add_fm_share_note(text, text, text, text, text, text) from public;
grant execute on function public.add_fm_share_note(text, text, text, text, text, text) to anon, authenticated;

-- ---------- 4) الملخص اليومي لفريق المرافق (يُستدعى صباحاً من الخطوة اليومية)
create or replace function public.fm_daily(p_stale_days int default 7) returns int language plpgsql security definer set search_path = public as $$
declare u record; n int := 0; t_late int; t_stale int; m_late int; m_stale int; m_open int; missing int; body text; cm date := date_trunc('month', now())::date;
begin
  select count(*) filter (where due_date < current_date), count(*) filter (where last_action_at < now() - make_interval(days => p_stale_days))
    into t_late, t_stale from public.fm_obs where status <> 'closed';
  select count(*) into missing from public.facilities f where f.active and exists (select 1 from public.fm_rounds r where r.facility_id = f.id)
    and not exists (select 1 from public.fm_rounds r where r.facility_id = f.id and r.period = cm and r.status = 'submitted');
  for u in select id, role from public.profiles where role in ('admin', 'facility') loop
    if exists (select 1 from public.notifications where user_id = u.id and kind = 'fm' and link = '#/fm/obs?due=1' and created_at > now() - interval '20 hours') then continue; end if;
    select count(*), count(*) filter (where due_date < current_date), count(*) filter (where last_action_at < now() - make_interval(days => p_stale_days))
      into m_open, m_late, m_stale from public.fm_obs where status <> 'closed' and assignee_id = u.id;
    body := '';
    if m_open > 0 then body := body || 'مكلّف بـ ' || m_open || ' ملاحظة' || case when m_late > 0 then '، منها ' || m_late || ' متأخرة' else '' end || case when m_stale > 0 then '، و' || m_stale || ' بلا تحديث منذ ' || p_stale_days || ' أيام' else '' end || '. '; end if;
    if t_late + t_stale > 0 then body := body || 'على مستوى الإدارة: ' || t_late || ' متأخرة، ' || t_stale || ' بلا تحديث. '; end if;
    if missing > 0 and extract(day from now()) >= 3 then body := body || missing || ' منشأة لم تُعتمد جولة هذا الشهر.'; end if;
    if body = '' then continue; end if;
    perform public.notify(array[u.id], 'fm', 'متابعة الأنظمة اليوم', body, '#/fm/obs?due=1');
    n := n + 1;
  end loop;
  return n;
end $$;
