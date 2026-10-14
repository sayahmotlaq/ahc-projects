-- 0038: متابعة أنظمة المنشآت (الجولة الشهرية + الملاحظات المرتبطة بدليل الإجراءات) ودور «مرافق وصيانة»
-- قابل لإعادة التشغيل في كل نشر.

-- ---------- دور جديد: facility (موظفو المرافق والصيانة والأمن والسلامة؛ يرون متابعة الأنظمة والحوكمة فقط)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','engineer','viewer','finance','clerk','facility','tech','requester','pending','disabled'));
create or replace function public.can_fm() returns boolean language sql stable set search_path = public as $$ select public.can_read() or public.my_role() = 'facility' $$;
create or replace function public.fm_write() returns boolean language sql stable set search_path = public as $$ select public.my_role() in ('admin','facility') $$;

-- يقرأ دور المرافق: الحوكمة، المنشآت، وأسماء زملائه والإدارة
do $$ declare t text; begin
  foreach t in array array['gov_units','gov_handoffs','gov_rules','gov_activities','gov_processes','gov_router','gov_faq','facilities'] loop
    execute format('drop policy if exists p_fm_read on public.%I', t);
    execute format('create policy p_fm_read on public.%I for select using (public.my_role() = ''facility'')', t);
  end loop; end $$;
drop policy if exists p_fm_read on public.profiles;
create policy p_fm_read on public.profiles for select using (public.my_role() = 'facility' and role in ('admin','facility'));

-- ---------- المنشآت الناقصة من ملف متابعة الأنظمة (الإحداثيات تُضبط من «الإدارة ← المرافق والخريطة»)
insert into public.facilities(name, kind, sort)
select v.name, v.kind, v.sort from (values
  ('مركز الكلى', 'center', 20), ('مركز الأمير سلطان لمعالجة أمراض وجراحة القلب', 'center', 21), ('مستشفى الجفر العام', 'hospital', 22),
  ('مركز أمراض الدم الوراثية', 'center', 23), ('مستشفى العفالق', 'hospital', 24)
) as v(name, kind, sort) where not exists (select 1 from public.facilities f where f.name = v.name);

-- ---------- سجل الأنظمة
create table if not exists public.fm_systems (
  code text primary key,
  name text not null, name_en text default '',
  grp text not null default 'system' check (grp in ('system','low','fire','area','compliance')),
  owner text references public.gov_units(code),
  partners jsonb default '[]',
  proc text default '',              -- الإجراء الحاكم في الدليل
  critical boolean default false,     -- نظام حرج: تعطله يُعامل طوارئ
  hint text default '',               -- ما الذي يُفحص
  sort int default 0, active boolean default true
);
-- الجولة الشهرية لكل منشأة
create table if not exists public.fm_rounds (
  id bigserial primary key,
  facility_id bigint not null references public.facilities(id) on delete cascade,
  period date not null,               -- أول يوم في الشهر
  status text not null default 'draft' check (status in ('draft','submitted')),
  note text default '',
  by_user uuid references auth.users(id), submitted_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (facility_id, period)
);
create table if not exists public.fm_checks (
  id bigserial primary key,
  round_id bigint not null references public.fm_rounds(id) on delete cascade,
  system_code text not null references public.fm_systems(code) on update cascade,
  status text not null check (status in ('good','attention','partial','down','na')),
  note text default '',
  checked_on date,
  unique (round_id, system_code)
);
-- الملاحظات: كل حالة غير سليمة تتحول إلى ملاحظة لها إجراء وخطوة ومسؤول وموعد
create table if not exists public.fm_obs (
  id bigserial primary key,
  facility_id bigint not null references public.facilities(id) on delete cascade,
  system_code text references public.fm_systems(code) on update cascade,
  title text not null, details text default '',
  severity text not null default 'attention' check (severity in ('attention','partial','down')),
  status text not null default 'open' check (status in ('open','in_progress','verify','closed')),
  proc text default '', step int,
  owner text references public.gov_units(code),
  assignee_id uuid references auth.users(id), assignee_name text default '',
  due_date date,
  project_id uuid references public.projects(id) on delete set null,
  source text default 'manual' check (source in ('round','manual','import')),
  round_id bigint references public.fm_rounds(id) on delete set null,
  created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now(),
  closed_at timestamptz, closed_by uuid references auth.users(id), close_note text default ''
);
create index if not exists fm_obs_fac on public.fm_obs(facility_id, status);
create table if not exists public.fm_obs_log (
  id bigserial primary key,
  obs_id bigint not null references public.fm_obs(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','change')),
  body text not null,
  by_user uuid references auth.users(id), at timestamptz default now()
);

-- آخر حالة لكل نظام في كل منشأة (من آخر جولة فيها النظام)
create or replace view public.v_fm_latest with (security_invoker = true) as
  select distinct on (r.facility_id, c.system_code) r.facility_id, c.system_code, c.status, c.note, c.checked_on, r.period, r.id as round_id, r.status as round_status
  from public.fm_checks c join public.fm_rounds r on r.id = c.round_id
  order by r.facility_id, c.system_code, r.period desc;

-- ---------- الصلاحيات
do $$ declare t text; begin
  foreach t in array array['fm_systems','fm_rounds','fm_checks','fm_obs','fm_obs_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('create policy p_read on public.%I for select using (public.can_fm())', t);
  end loop; end $$;
grant select on public.v_fm_latest to authenticated;
grant usage, select on sequence public.fm_rounds_id_seq, public.fm_checks_id_seq, public.fm_obs_id_seq, public.fm_obs_log_id_seq to authenticated;
drop policy if exists p_admin on public.fm_systems; create policy p_admin on public.fm_systems for all using (public.is_admin()) with check (public.is_admin());
do $$ declare t text; begin
  foreach t in array array['fm_rounds','fm_checks','fm_obs'] loop
    execute format('drop policy if exists p_write on public.%I', t);
    execute format('create policy p_write on public.%I for insert with check (public.fm_write())', t);
    execute format('drop policy if exists p_upd on public.%I', t);
    execute format('create policy p_upd on public.%I for update using (public.fm_write()) with check (public.fm_write())', t);
    execute format('drop policy if exists p_del on public.%I', t);
    execute format('create policy p_del on public.%I for delete using (public.is_admin())', t);
  end loop; end $$;
-- المتابعات: يضيفها كل من يقرأ (المهندس يتابع ملاحظة تحولت لمشروعه)، ويحذفها صاحبها أو الإدارة
drop policy if exists p_write on public.fm_obs_log; create policy p_write on public.fm_obs_log for insert with check (public.can_fm() and by_user = auth.uid());
drop policy if exists p_del on public.fm_obs_log; create policy p_del on public.fm_obs_log for delete using (public.is_admin() or (by_user = auth.uid() and kind = 'note'));

-- ---------- المحفّزات: الطوابع، سجل التغييرات، الإشعارات
create or replace function public.fm_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists fm_rounds_touch on public.fm_rounds; create trigger fm_rounds_touch before update on public.fm_rounds for each row execute function public.fm_touch();

create or replace function public.fm_obs_biu() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  if new.status = 'closed' and (tg_op = 'INSERT' or old.status <> 'closed') then new.closed_at := coalesce(new.closed_at, now()); new.closed_by := coalesce(new.closed_by, auth.uid()); end if;
  if new.status <> 'closed' then new.closed_at := null; new.closed_by := null; end if;
  return new;
end $$;
drop trigger if exists fm_obs_biu on public.fm_obs; create trigger fm_obs_biu before insert or update on public.fm_obs for each row execute function public.fm_obs_biu();

create or replace function public.fm_obs_aiu() returns trigger language plpgsql security definer set search_path = public as $$
declare st jsonb := '{"open":"مفتوحة","in_progress":"قيد المعالجة","verify":"بانتظار التحقق","closed":"مغلقة"}'; fac text; lnk text; parts text[] := '{}';
begin
  select name into fac from public.facilities where id = new.facility_id;
  lnk := '#/fm/obs?id=' || new.id;
  if tg_op = 'INSERT' then
    if new.source = 'import' then return new; end if;
    perform public.notify(public.admins() || array[new.assignee_id], 'fm', 'ملاحظة جديدة: ' || new.title, coalesce(fac, ''), lnk);
    return new;
  end if;
  if new.status is distinct from old.status then parts := parts || ('الحالة: ' || (st->>old.status) || ' ← ' || (st->>new.status)); end if;
  if new.step is distinct from old.step then parts := parts || ('الخطوة: ' || coalesce(old.step::text, '—') || ' ← ' || coalesce(new.step::text, '—')); end if;
  if new.proc is distinct from old.proc then parts := parts || ('الإجراء: ' || coalesce(nullif(old.proc, ''), '—') || ' ← ' || coalesce(nullif(new.proc, ''), '—')); end if;
  if new.due_date is distinct from old.due_date then parts := parts || ('الموعد: ' || coalesce(new.due_date::text, '—')); end if;
  if new.assignee_id is distinct from old.assignee_id or new.assignee_name is distinct from old.assignee_name then parts := parts || ('المسؤول: ' || coalesce((select full_name from public.profiles where id = new.assignee_id), nullif(new.assignee_name, ''), '—')); end if;
  if new.project_id is distinct from old.project_id then parts := parts || ('المشروع: ' || coalesce(public.proj_name(new.project_id), '—')); end if;
  if array_length(parts, 1) > 0 then
    insert into public.fm_obs_log(obs_id, kind, body, by_user) values (new.id, 'change', array_to_string(parts, ' · '), auth.uid());
  end if;
  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then
    perform public.notify(array[new.assignee_id], 'fm', 'كُلّفت بملاحظة: ' || new.title, coalesce(fac, ''), lnk);
  elsif new.status is distinct from old.status then
    perform public.notify(public.admins() || array[new.assignee_id, new.created_by], 'fm', (st->>new.status) || ': ' || new.title, coalesce(fac, ''), lnk);
  end if;
  return new;
end $$;
drop trigger if exists fm_obs_aiu on public.fm_obs; create trigger fm_obs_aiu after insert or update on public.fm_obs for each row execute function public.fm_obs_aiu();

create or replace function public.fm_log_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if new.kind <> 'note' then return new; end if;
  select * into o from public.fm_obs where id = new.obs_id;
  perform public.notify(array[o.assignee_id, o.created_by] || public.admins(), 'fm', 'متابعة على ملاحظة: ' || o.title, left(new.body, 140), '#/fm/obs?id=' || o.id);
  return new;
end $$;
drop trigger if exists fm_log_ai on public.fm_obs_log; create trigger fm_log_ai after insert on public.fm_obs_log for each row execute function public.fm_log_ai();

-- ---------- سجل الأنظمة (بذرة؛ يُدار بعدها من الموقع)
insert into public.fm_systems(code, name, name_en, grp, owner, partners, proc, critical, hint, sort) values
 ('HVAC', 'التبريد والتكييف المركزي', 'Chillers & Main HVAC', 'system', 'MNT', '[]', 'G-05', true, 'المبردات، وحدات مناولة الهواء، درجات الحرارة والرطوبة في المناطق الحرجة', 10),
 ('BOIL', 'الغلايات والسخانات', 'Boilers & Heaters', 'system', 'MNT', '[]', 'G-05', false, 'الغلايات، سخانات المياه، البخار للتعقيم', 20),
 ('MGAS', 'الغازات الطبية', 'Medical Gas System', 'system', 'MNT', '["BME","SAF"]', 'M-03', true, 'المصدر والخزانات، المنظمات، الضغوط، لوحات الإنذار', 30),
 ('GEN', 'مولدات الطوارئ', 'Diesel Emergency Generators', 'system', 'MNT', '[]', 'M-03', true, 'اختبار التحميل الشهري، الوقود، مفاتيح تحويل الأحمال', 40),
 ('UPS', 'أنظمة الطاقة غير المنقطعة (UPS)', 'Electrical UPS', 'system', 'MNT', '["IT"]', 'M-03', true, 'البطاريات، الحمل، زمن التشغيل الاحتياطي', 50),
 ('PWR', 'منظومة الطاقة (المحولات ولوحات التوزيع)', 'Power System', 'system', 'MNT', '[]', 'G-05', true, 'المحولات، لوحات الجهد المتوسط والمنخفض، القراءات الحرارية', 60),
 ('WATR', 'المياه والصرف', 'Water & Drainage', 'system', 'MNT', '[]', 'G-05', false, 'الخزانات، المضخات، جودة المياه، الصرف', 70),
 ('LIFT', 'المصاعد', 'Elevators', 'system', 'MNT', '[]', 'G-05', false, 'مصاعد المرضى والخدمة، شهادات الفحص', 80),
 ('MORG', 'ثلاجات الموتى', 'Morgue Refrigeration', 'system', 'MNT', '[]', 'G-05', false, 'درجات الحرارة، الإنذار', 90),
 ('NCS', 'نداء التمريض', 'Nurse Call System', 'low', 'MNT', '["IT"]', 'G-05', false, 'وحدات الغرف، لوحات المحطات، دورات المياه', 110),
 ('TEL', 'الهاتف والاتصالات', 'Telephone System', 'low', 'IT', '[]', 'G-09', false, 'السنترال، الخطوط الداخلية، خطوط الطوارئ', 120),
 ('CCTV', 'المراقبة بالكاميرات', 'CCTV', 'low', 'SAF', '["IT","MNT"]', 'H-05', false, 'الكاميرات، أجهزة التسجيل NVR، مدة الحفظ', 130),
 ('FFS', 'أنظمة الإطفاء', 'Fire Fighting System', 'fire', 'MNT', '["SAF"]', 'H-01', true, 'المضخات، الرشاشات، صناديق الحريق، الطفايات', 210),
 ('FAS', 'الإنذار من الحريق', 'Fire Alarm System', 'fire', 'MNT', '["SAF"]', 'H-01', true, 'لوحة الإنذار، الكواشف، نقاط الكسر، الأعطال المسجلة', 220),
 ('OR', 'غرف العمليات', 'Operating Rooms', 'area', 'BME', '["MNT"]', 'G-08', true, 'جاهزية الأجهزة، الضغط والتكييف، الغازات', 310),
 ('ER', 'قسم الطوارئ', 'Emergency Department', 'area', 'BME', '["MNT"]', 'G-08', true, 'جاهزية الأجهزة والمرافق المساندة', 320),
 ('ICU', 'العناية المركزة', 'ICU Rooms', 'area', 'BME', '["MNT"]', 'G-08', true, 'الأجهزة الداعمة للحياة، الغازات، الطاقة الاحتياطية', 330),
 ('RAD', 'الأشعة الرئيسية', 'Main Radiology Devices', 'area', 'BME', '["MED"]', 'G-08', false, 'أجهزة الأشعة الرئيسية وعقود خدمتها', 340),
 ('CBAHI', 'متطلبات سباهي للمرافق', 'CBAHI Compliance', 'compliance', 'FAC', '["SAF","MNT"]', 'F-02', false, 'ملاحظات آخر زيارة وخطة التصحيح', 410),
 ('CD', 'اشتراطات الدفاع المدني', 'Civil Defense Compliance', 'compliance', 'SAF', '["MNT","FAC"]', 'H-06', false, 'الترخيص، ملاحظات الزيارات، الفحوص الدورية', 420),
 ('ADA', 'الوصول الشامل لذوي الإعاقة', 'ADA Compliance', 'compliance', 'FAC', '["PRJ"]', 'G-02', false, 'المداخل، المنحدرات، دورات المياه، المواقف', 430)
on conflict (code) do nothing;
