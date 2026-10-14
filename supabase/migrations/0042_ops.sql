-- 0042: المحرّك التشغيلي لإدارة الخدمات الفنية — بلاغات وطلبات وأعمال كل الأقسام في سجل واحد مترابط
-- كل عنصر: قسم مالك، منشأة وموقع، أولوية ومهلة (R-17)، إجراء وخطوة من الدليل، إجراء متخذ إلزامي مع كل تحديث،
-- وإحالات بين الأقسام (عنصر أب ← عناصر أبناء في أقسام أخرى). قابل لإعادة التشغيل في كل نشر.

-- ---------- 1) الأدوار والانتماء للأقسام
-- tech: موظف قسم فني (يعمل على أعمال قسمه) · requester: مُبلّغ من المنشأة (يرفع البلاغات ويتابع بلاغاته فقط)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','engineer','viewer','finance','clerk','facility','tech','requester','pending','disabled'));
alter table public.profiles add column if not exists unit text references public.gov_units(code) on update cascade on delete set null;
alter table public.profiles add column if not exists facility_id bigint references public.facilities(id) on delete set null;
update public.profiles set unit = 'PRJ' where unit is null and role in ('engineer','clerk');

-- لا يغيّر المستخدم قسمه أو منشأته بنفسه (الإدارة فقط)
create or replace function public.profiles_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then new.unit := old.unit; new.facility_id := old.facility_id; end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

create or replace function public.my_unit() returns text language sql stable security definer set search_path = public as $$ select unit from public.profiles where id = auth.uid() $$;
-- من يقرأ الأعمال التشغيلية: كل من يقرأ المنصة + موظفو الأقسام الفنية
create or replace function public.ops_read() returns boolean language sql stable set search_path = public as $$ select public.can_read() or public.my_role() in ('facility','tech') $$;
-- هل المستخدم من فريق القسم؟ (دور «مرافق وصيانة» بلا قسم محدد يعمل على المرافق والصيانة والأمن والسلامة)
create or replace function public.ops_staff(u text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('engineer','clerk','facility','tech')
    and (p.unit = u or (p.role = 'facility' and p.unit is null and u in ('FAC','MNT','SAF')))) $$;
-- أعضاء القسم (للإشعارات)
create or replace function public.unit_members(u text) returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role in ('engineer','clerk','facility','tech')
    and (unit = u or (role = 'facility' and unit is null and u in ('FAC','MNT','SAF'))) $$;

-- دور «مرافق وصيانة» وموظفو الأقسام يقرؤون متابعة الأنظمة
create or replace function public.can_fm() returns boolean language sql stable set search_path = public as $$ select public.can_read() or public.my_role() in ('facility','tech') $$;

-- قراءة الحوكمة والمنشآت والأسماء لموظفي الأقسام والمبلّغين
do $$ declare t text; begin
  foreach t in array array['gov_units','gov_handoffs','gov_rules','gov_activities','gov_processes','gov_router','gov_faq','facilities'] loop
    execute format('drop policy if exists p_ops_read on public.%I', t);
    execute format('create policy p_ops_read on public.%I for select using (public.my_role() in (''tech'',''requester''))', t);
  end loop; end $$;
drop policy if exists p_fm_read on public.profiles;
create policy p_fm_read on public.profiles for select using (public.my_role() in ('facility','tech') and role not in ('pending','disabled'));

-- ---------- 2) أنواع الأعمال (كتالوج الطلبات لكل قسم؛ يُدار من الموقع)
create table if not exists public.ops_kinds (
  code text primary key,
  unit text not null references public.gov_units(code) on update cascade,
  name text not null, short text default '', icon text default '•',
  descr text default '',
  proc text default '',                 -- الإجراء الحاكم في الدليل
  intake boolean default true,          -- يظهر في «مركز البلاغات» لأي مستخدم
  prio text default 'p3',               -- الأولوية المقترحة
  fields jsonb default '[]',            -- حقول النموذج الخاصة: [{k,l,t:text|textarea|select|number|date,o:[],req}]
  sort int default 0, active boolean default true
);

-- ---------- 3) الأعمال
create table if not exists public.ops_items (
  id bigserial primary key,
  ref text unique,
  kind text not null references public.ops_kinds(code) on update cascade,
  unit text not null references public.gov_units(code) on update cascade,
  facility_id bigint references public.facilities(id) on delete set null,
  location text default '', asset text default '',
  title text not null, details text default '',
  priority text not null default 'p3' check (priority in ('p1','p2','p3','p4')),
  status text not null default 'new' check (status in ('new','accepted','in_progress','on_hold','verify','done','cancelled')),
  proc text default '', step int,
  assignee_id uuid references auth.users(id), assignee_name text default '',
  requester_id uuid references auth.users(id), requester_name text default '', requester_phone text default '',
  source text default 'portal' check (source in ('portal','phone','round','ppm','item','fm','project','other')),
  parent_id bigint references public.ops_items(id) on delete set null,
  fm_obs_id bigint references public.fm_obs(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  data jsonb default '{}',
  due_at timestamptz,
  accepted_at timestamptz, started_at timestamptz, resolved_at timestamptz,
  closed_at timestamptz, closed_by uuid references auth.users(id), close_note text default '',
  last_action text default '', last_action_at timestamptz, last_action_by uuid references auth.users(id),
  rating int check (rating between 1 and 5), feedback text default '',
  created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists ops_items_unit on public.ops_items(unit, status);
create index if not exists ops_items_fac on public.ops_items(facility_id);
create index if not exists ops_items_parent on public.ops_items(parent_id);
create index if not exists ops_items_fm on public.ops_items(fm_obs_id);
create table if not exists public.ops_log (
  id bigserial primary key,
  item_id bigint not null references public.ops_items(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','change','handoff')),
  body text not null,
  by_user uuid references auth.users(id), at timestamptz default now()
);
create index if not exists ops_log_item on public.ops_log(item_id);

-- المهلة من الأولوية (R-17): طارئ ساعتان، عاجل 24 ساعة، عادي 5 أيام عمل (7 أيام)، مخطط 30 يوماً
create or replace function public.ops_sla(p text) returns interval language sql immutable as $$
  select case p when 'p1' then interval '2 hours' when 'p2' then interval '24 hours' when 'p3' then interval '7 days' else interval '30 days' end $$;

-- ---------- 4) الصلاحيات
alter table public.ops_kinds enable row level security;
alter table public.ops_items enable row level security;
alter table public.ops_log enable row level security;
grant select, insert, update, delete on public.ops_kinds, public.ops_items, public.ops_log to authenticated;
grant usage, select on sequence public.ops_items_id_seq, public.ops_log_id_seq to authenticated;
drop policy if exists p_read on public.ops_kinds; create policy p_read on public.ops_kinds for select using (auth.uid() is not null);
drop policy if exists p_admin on public.ops_kinds; create policy p_admin on public.ops_kinds for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists p_read on public.ops_items;
create policy p_read on public.ops_items for select using (public.ops_read() or created_by = auth.uid() or requester_id = auth.uid());
drop policy if exists p_ins on public.ops_items;
create policy p_ins on public.ops_items for insert with check ((public.ops_read() or public.my_role() = 'requester') and coalesce(created_by, auth.uid()) = auth.uid());
-- التحديث: فريق القسم المالك، والمرافق (الاستقبال الموحد R-05 وإعادة التوجيه)، والمكلّف، وصاحب البلاغ (بحدود يفرضها المحفّز)
drop policy if exists p_upd on public.ops_items;
create policy p_upd on public.ops_items for update
  using (public.ops_staff(unit) or public.ops_staff('FAC') or assignee_id = auth.uid() or created_by = auth.uid() or requester_id = auth.uid())
  with check (public.ops_read() or public.my_role() = 'requester');
drop policy if exists p_del on public.ops_items; create policy p_del on public.ops_items for delete using (public.is_admin());

drop policy if exists p_read on public.ops_log;
create policy p_read on public.ops_log for select using (public.ops_read() or exists (select 1 from public.ops_items i where i.id = item_id and (i.created_by = auth.uid() or i.requester_id = auth.uid())));
drop policy if exists p_ins on public.ops_log;
create policy p_ins on public.ops_log for insert with check (by_user = auth.uid() and kind = 'note' and (public.ops_read() or exists (select 1 from public.ops_items i where i.id = item_id and (i.created_by = auth.uid() or i.requester_id = auth.uid()))));
drop policy if exists p_del on public.ops_log; create policy p_del on public.ops_log for delete using (public.is_admin() or (by_user = auth.uid() and kind = 'note'));

-- المرفقات والصور: المرجع ops:<id> والمسار attach/ops_<id>/…
drop policy if exists p_ops_read on public.attachments;
create policy p_ops_read on public.attachments for select using (ref like 'ops:%' and (public.my_role() in ('facility','tech') or exists (select 1 from public.ops_items i where 'ops:' || i.id = ref and (i.created_by = auth.uid() or i.requester_id = auth.uid()))));
drop policy if exists p_ops_ins on public.attachments;
create policy p_ops_ins on public.attachments for insert with check (ref like 'ops:%' and by_user = auth.uid() and public.my_role() in ('facility','tech','requester'));
do $$ begin
  drop policy if exists pf_ops_read on storage.objects;
  create policy pf_ops_read on storage.objects for select to authenticated using (bucket_id = 'project-files' and name like 'attach/ops\_%' and public.my_role() in ('facility','tech','requester'));
  drop policy if exists pf_ops_ins on storage.objects;
  create policy pf_ops_ins on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and name like 'attach/ops\_%' and public.my_role() in ('facility','tech','requester'));
exception when others then null; end $$;

-- ---------- 5) المحفّزات
create or replace function public.ops_biu() returns trigger language plpgsql security definer set search_path = public as $$
declare k record; staff boolean; a jsonb; b jsonb;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    select * into k from public.ops_kinds where code = new.kind;
    new.created_by := coalesce(new.created_by, auth.uid());
    new.unit := coalesce(nullif(new.unit, ''), k.unit);
    new.proc := coalesce(nullif(new.proc, ''), k.proc, '');
    new.step := coalesce(new.step, case when new.proc <> '' then 1 end);
    if new.source in ('portal','phone') and new.requester_id is null and new.requester_name = '' then new.requester_id := auth.uid(); end if;
    new.due_at := coalesce(new.due_at, now() + public.ops_sla(new.priority));
    new.ref := new.unit || '-' || to_char(now(), 'YY') || '-' || lpad(new.id::text, 5, '0');
    if new.last_action <> '' then new.last_action_at := now(); new.last_action_by := auth.uid(); end if;
    if new.status not in ('new') then new.accepted_at := now(); end if;
    return new;
  end if;
  -- صاحب البلاغ من خارج فريق القسم: إلغاء بلاغه الجديد، تأكيد المعالجة أو رفضها، التقييم، وإضافة متابعات فقط
  staff := auth.uid() is null or public.ops_staff(old.unit) or public.ops_staff('FAC') or coalesce(old.assignee_id = auth.uid(), false);
  if not staff then
    a := to_jsonb(new) - array['status','last_action','last_action_at','last_action_by','rating','feedback','updated_at','closed_at','closed_by','close_note','resolved_at'];
    b := to_jsonb(old) - array['status','last_action','last_action_at','last_action_by','rating','feedback','updated_at','closed_at','closed_by','close_note','resolved_at'];
    if a <> b then raise exception 'يمكنك متابعة بلاغك وتأكيد معالجته وتقييمه فقط؛ التعديل لفريق القسم المختص'; end if;
    if new.status is distinct from old.status and not ((old.status = 'new' and new.status = 'cancelled') or (old.status = 'verify' and new.status in ('done','in_progress'))) then
      raise exception 'لا يمكنك نقل البلاغ إلى هذه الحالة'; end if;
  end if;
  -- كل تغيير للحالة أو الخطوة أو القسم يلزمه ذكر المعالجة أو الإجراء المتخذ
  if (new.status is distinct from old.status or new.step is distinct from old.step or new.unit is distinct from old.unit)
     and coalesce(new.last_action, '') = coalesce(old.last_action, '') then
    raise exception 'يلزم ذكر المعالجة أو الإجراء المتخذ مع كل تحديث للحالة أو الخطوة';
  end if;
  if coalesce(new.last_action, '') <> coalesce(old.last_action, '') then new.last_action_at := now(); new.last_action_by := auth.uid(); end if;
  if new.priority is distinct from old.priority and new.due_at is not distinct from old.due_at then new.due_at := old.created_at + public.ops_sla(new.priority); end if;
  -- إعادة التوجيه لقسم آخر: يأخذ نوع الاستقبال لذلك القسم وإجراءه الحاكم من الخطوة الأولى
  if new.unit is distinct from old.unit then
    if new.kind = old.kind then new.kind := coalesce((select code from public.ops_kinds where unit = new.unit and active order by intake desc, sort limit 1), new.kind); end if;
    if new.proc is not distinct from old.proc then new.proc := coalesce((select nullif(proc, '') from public.ops_kinds where code = new.kind), new.proc); new.step := 1; end if;
  end if;
  if new.status <> 'new' and old.status = 'new' then new.accepted_at := coalesce(new.accepted_at, now()); end if;
  if new.status = 'in_progress' then new.started_at := coalesce(new.started_at, now()); end if;
  if new.status in ('verify','done') then new.resolved_at := coalesce(new.resolved_at, now()); end if;
  if new.status in ('done','cancelled') and old.status not in ('done','cancelled') then
    new.closed_at := now(); new.closed_by := auth.uid(); new.close_note := coalesce(nullif(new.close_note, ''), new.last_action);
  end if;
  if new.status not in ('done','cancelled') then new.closed_at := null; new.closed_by := null; end if;
  if new.status in ('new','accepted','in_progress','on_hold') then new.resolved_at := null; end if;
  return new;
end $$;
drop trigger if exists ops_biu on public.ops_items;
create trigger ops_biu before insert or update on public.ops_items for each row execute function public.ops_biu();

create or replace function public.ops_aiu() returns trigger language plpgsql security definer set search_path = public as $$
declare st jsonb := '{"new":"جديد","accepted":"مستلم","in_progress":"قيد التنفيذ","on_hold":"معلّق","verify":"بانتظار التأكيد","done":"مكتمل","cancelled":"ملغى"}';
  pr jsonb := '{"p1":"طارئ","p2":"عاجل","p3":"عادي","p4":"مخطط"}';
  fac text; lnk text; parts text[] := '{}'; un text; pu text; who uuid[];
begin
  -- تحديث «آخر إجراء» القادم من متابعة مكتوبة لا يُسجَّل مرة ثانية
  if tg_op = 'UPDATE' and current_setting('ops.note', true) = '1' then return new; end if;
  select name into fac from public.facilities where id = new.facility_id;
  lnk := '#/ops/list?id=' || new.id;
  if tg_op = 'INSERT' then
    if new.last_action <> '' then insert into public.ops_log(item_id, kind, body, by_user) values (new.id, 'change', 'الإجراء المتخذ: ' || new.last_action, auth.uid()); end if;
    who := public.unit_members(new.unit) || array[new.assignee_id];
    if new.priority = 'p1' then who := who || public.admins(); end if;
    perform public.notify(who, 'ops', (pr->>new.priority) || ' · ' || new.title, coalesce(fac, '') || ' · ' || new.ref, lnk);
    if new.parent_id is not null then
      select short into un from public.gov_units where code = new.unit;
      insert into public.ops_log(item_id, kind, body, by_user) values (new.parent_id, 'handoff', 'أُحيل إلى ' || coalesce(un, new.unit) || ': ' || new.ref || ' — ' || new.title, auth.uid());
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then parts := parts || ('الحالة: ' || (st->>old.status) || ' ← ' || (st->>new.status)); end if;
  if new.step is distinct from old.step then parts := parts || ('الخطوة: ' || coalesce(old.step::text, '—') || ' ← ' || coalesce(new.step::text, '—')); end if;
  if new.unit is distinct from old.unit then
    select short into pu from public.gov_units where code = old.unit; select short into un from public.gov_units where code = new.unit;
    parts := parts || ('أُعيد توجيهه: ' || coalesce(pu, old.unit) || ' ← ' || coalesce(un, new.unit)); end if;
  if new.priority is distinct from old.priority then parts := parts || ('الأولوية: ' || (pr->>old.priority) || ' ← ' || (pr->>new.priority)); end if;
  if new.assignee_id is distinct from old.assignee_id or new.assignee_name is distinct from old.assignee_name then parts := parts || ('المكلّف: ' || coalesce((select full_name from public.profiles where id = new.assignee_id), nullif(new.assignee_name, ''), '—')); end if;
  if new.due_at is distinct from old.due_at then parts := parts || ('الموعد: ' || to_char(new.due_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI')); end if;
  if new.project_id is distinct from old.project_id then parts := parts || ('المشروع: ' || coalesce(public.proj_name(new.project_id), '—')); end if;
  if new.rating is distinct from old.rating and new.rating is not null then parts := parts || ('تقييم صاحب البلاغ: ' || new.rating || '/5' || case when new.feedback <> '' then ' — ' || new.feedback else '' end); end if;
  if coalesce(new.last_action, '') <> coalesce(old.last_action, '') then parts := parts || ('الإجراء المتخذ: ' || new.last_action); end if;
  if array_length(parts, 1) > 0 then
    insert into public.ops_log(item_id, kind, body, by_user) values (new.id, 'change', array_to_string(parts, ' · '), auth.uid());
  end if;
  if new.unit is distinct from old.unit then
    perform public.notify(public.unit_members(new.unit), 'ops', 'أُحيل إلى قسمك: ' || new.title, coalesce(fac, '') || ' · ' || new.ref, lnk);
  end if;
  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify(array[new.assignee_id], 'ops', 'كُلّفت بعمل: ' || new.title, coalesce(fac, '') || ' · ' || new.ref, lnk);
  end if;
  if new.status is distinct from old.status then
    perform public.notify(array[new.requester_id, new.created_by, new.assignee_id], 'ops', (st->>new.status) || ': ' || new.title,
      coalesce(nullif(new.last_action, ''), coalesce(fac, '')), lnk);
    -- اكتمال عنصر أبناء: يُبلَّغ فريق العنصر الأب
    if new.parent_id is not null and new.status in ('done','cancelled') then
      select short into un from public.gov_units where code = new.unit;
      insert into public.ops_log(item_id, kind, body, by_user) values (new.parent_id, 'handoff', coalesce(un, new.unit) || ' — ' || (st->>new.status) || ': ' || new.ref || ' — ' || coalesce(nullif(new.last_action, ''), new.title), auth.uid());
      perform public.notify(public.unit_members((select unit from public.ops_items where id = new.parent_id)) || array[(select assignee_id from public.ops_items where id = new.parent_id)],
        'ops', 'اكتمل جزء محال: ' || new.title, new.ref, '#/ops/list?id=' || new.parent_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ops_aiu on public.ops_items;
create trigger ops_aiu after insert or update on public.ops_items for each row execute function public.ops_aiu();

-- المتابعة المكتوبة تُعدّ إجراءً متخذاً وتُبلّغ الأطراف
create or replace function public.ops_log_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if new.kind <> 'note' then return new; end if;
  select * into o from public.ops_items where id = new.item_id;
  perform set_config('ops.note', '1', true);
  update public.ops_items set last_action = new.body where id = new.item_id;
  perform set_config('ops.note', '', true);
  perform public.notify(public.unit_members(o.unit) || array[o.assignee_id, o.created_by, o.requester_id], 'ops', 'متابعة: ' || o.title, left(new.body, 140), '#/ops/list?id=' || o.id);
  return new;
end $$;
drop trigger if exists ops_log_ai on public.ops_log;
create trigger ops_log_ai after insert on public.ops_log for each row execute function public.ops_log_ai();

-- ---------- 6) الملخص الصباحي لكل قسم: الأعمال المتأخرة والجديدة غير المستلمة
create or replace function public.ops_daily() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select i.unit, u.short,
      count(*) filter (where i.due_at < now()) as late,
      count(*) filter (where i.status = 'new' and i.created_at < now() - interval '1 day') as unacc,
      count(*) filter (where i.priority in ('p1','p2')) as urgent
    from public.ops_items i join public.gov_units u on u.code = i.unit
    where i.status not in ('done','cancelled') group by i.unit, u.short loop
    if r.late + r.unacc > 0 then
      perform public.notify(public.unit_members(r.unit), 'ops', 'أعمال قسم ' || r.short || ' تحتاج انتباهاً',
        concat_ws(' · ', case when r.late > 0 then r.late || ' متأخرة عن مهلتها' end, case when r.unacc > 0 then r.unacc || ' جديدة لم تُستلم منذ يوم' end, case when r.urgent > 0 then r.urgent || ' طارئة أو عاجلة' end),
        '#/dept/' || r.unit || '/work?late=1');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ---------- 7) كتالوج الطلبات المبدئي: نوع استقبال لكل قسم (يُدار بعدها من الموقع)
insert into public.ops_kinds(code, unit, name, short, icon, descr, proc, intake, prio, fields, sort) values
 ('mnt', 'MNT', 'بلاغ صيانة', 'صيانة', '🔧', 'عطل في المبنى أو أنظمته: كهرباء، تكييف، سباكة، أبواب، مصاعد، غازات طبية…', 'G-05', true, 'p3',
  '[{"k":"system","l":"المجال","t":"select","o":["كهرباء","تكييف وتهوية","سباكة وصرف","نجارة وأبواب ونوافذ","دهانات وتشطيبات","مصاعد","غازات طبية","أنظمة الحريق","أخرى"],"req":true},{"k":"impact","l":"الأثر على التشغيل","t":"select","o":["لا يؤثر على التشغيل","يؤثر على راحة المرضى أو العاملين","يوقف غرفة أو خدمة","خطر على السلامة"]}]', 10),
 ('bme', 'BME', 'بلاغ عطل جهاز طبي', 'جهاز طبي', '🩺', 'جهاز طبي متعطل أو يعمل بخلل، أو يحتاج معايرة', 'G-08', true, 'p2',
  '[{"k":"device","l":"الجهاز","t":"text","req":true},{"k":"asset_no","l":"رقم الأصل أو الرقم التسلسلي","t":"text"},{"k":"model","l":"الشركة والموديل","t":"text"},{"k":"state","l":"حالة الجهاز","t":"select","o":["يعمل مع خلل","متوقف ويوجد بديل","متوقف ولا يوجد بديل"],"req":true},{"k":"patient","l":"هل تأثر مريض بالعطل؟","t":"select","o":["لا","نعم"]}]', 20),
 ('it', 'IT', 'بلاغ تقني', 'تقني', '💻', 'أجهزة الحاسب والطابعات، الشبكة، الأنظمة السريرية، الحسابات والصلاحيات، الهاتف', 'T-01', true, 'p3',
  '[{"k":"cat","l":"التصنيف","t":"select","o":["جهاز حاسب أو طابعة","الشبكة والإنترنت","نظام سريري","البريد والحسابات والصلاحيات","الهاتف والاتصالات","أخرى"],"req":true},{"k":"asset_no","l":"رقم الجهاز (إن وجد)","t":"text"}]', 30),
 ('gen', 'GEN', 'طلب خدمات عامة', 'خدمات عامة', '🧹', 'نظافة، نقل أثاث، مكافحة حشرات، نفايات، خدمات مساندة', 'S-05', true, 'p3',
  '[{"k":"service","l":"الخدمة","t":"select","o":["نظافة","نقل أثاث أو تجهيزات غير طبية","مكافحة حشرات وقوارض","النفايات","أخرى"],"req":true}]', 40),
 ('saf', 'SAF', 'بلاغ أمن وسلامة', 'أمن وسلامة', '🛡️', 'حادث أو حادث وشيك، ملاحظة سلامة، خلل أمني، مواد خطرة', 'H-03', true, 'p2',
  '[{"k":"type","l":"النوع","t":"select","o":["حادث","حادث وشيك","ملاحظة سلامة","خلل أمني أو دخول غير مصرح","مواد خطرة"],"req":true},{"k":"injury","l":"هل توجد إصابات؟","t":"select","o":["لا","نعم"]},{"k":"when","l":"وقت الحدث","t":"datetime-local"}]', 50),
 ('fac', 'FAC', 'طلب مرافق ومساحات', 'مرافق', '🏢', 'تغيير استخدام مساحة، نقل قسم أو عيادة، إغلاق غرفة للصيانة، لافتات وإرشاد', 'G-12', true, 'p4',
  '[{"k":"type","l":"نوع الطلب","t":"select","o":["تغيير استخدام مساحة","نقل قسم أو عيادة","إغلاق غرفة أو منطقة للصيانة","لافتات وإرشاد","أخرى"],"req":true}]', 60),
 ('med', 'MED', 'طلب جهاز أو تجهيز طبي', 'تجهيز طبي', '🧰', 'احتياج جهاز طبي جديد أو إحلال جهاز قائم أو زيادة طاقة', 'E-01', true, 'p4',
  '[{"k":"device","l":"الجهاز المطلوب","t":"text","req":true},{"k":"qty","l":"العدد","t":"number"},{"k":"reason","l":"المبرر","t":"select","o":["خدمة جديدة","إحلال جهاز قائم","زيادة طاقة","متطلب اعتماد"],"req":true}]', 70),
 ('prj', 'PRJ', 'طلب مشروع أو دراسة', 'مشروع', '📐', 'احتياج يغيّر المساحة أو يتجاوز حدود الصيانة (R-01): تأهيل، توسعة، إنشاء', 'G-02', true, 'p4',
  '[{"k":"why","l":"لماذا هو مشروع؟ (R-01)","t":"select","o":["تغيير معماري أو إنشائي أو في استخدام المساحة","تكلفة تقديرية تتجاوز حد المشروع","يحتاج تصميماً أو طرحاً","يشمل أكثر من تخصص","مدة تتجاوز 30 يوماً","يمس الدفاع المدني أو مكافحة العدوى"],"req":true},{"k":"cost","l":"التكلفة التقديرية (إن عُرفت)","t":"number"}]', 80)
on conflict (code) do nothing;
