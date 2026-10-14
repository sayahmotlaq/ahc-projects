-- 0049: قسم الحركة — أسطول سيارات المقر، تسليم السيارات للموظفين واستلامها في نفس اليوم، دليل الإجراءات V-01..V-06،
-- القواعد R-37..R-41، نقاط التسليم، نماذج بلاغ عطل السيارة والحادث/المخالفة. قابل لإعادة التشغيل في كل نشر.

-- ---------- 1) القسم والطرف «الموظف المستخدم»
insert into public.gov_units(code, name, short, kind, color, mission, duties, sort) values
 ('TRN', 'قسم الحركة', 'الحركة', 'unit', '0E7C86',
  'إدارة أسطول سيارات المقر الرئيسي: تخصيص السيارات لمهام الموظفين وتسليمها واستلامها في نفس اليوم، وصيانتها ووقودها ووثائقها، ومتابعة الحوادث والمخالفات.',
  '["تسليم السيارات لموظفي الأقسام واستلامها بمحضر إلكتروني (العداد، الوقود، الحالة)", "سجل الأسطول ووثائقه: الاستمارة والتأمين والفحص الدوري وبطاقات الوقود", "الصيانة الدورية وإصلاح الأعطال والأضرار", "الحوادث والمخالفات المرورية وربطها بمستخدم السيارة وقتها", "تقرير شهري باستخدام الأسطول والتأخير والأعطال", "دليل الإجراءات: التسليم والاستلام، السجل والوثائق، الصيانة، الوقود، الحوادث والمخالفات، المهام الطويلة (V-01..V-06)"]'::jsonb, 10)
on conflict (code) do nothing;
insert into public.gov_units(code, name, short, kind, color, mission, sort) values
 ('EMP', 'الموظف المستخدم للسيارة', 'الموظف', 'ext', '8A94A0', 'موظف أي قسم يستلم سيارة من المقر لمهمة عمل.', 13)
on conflict (code) do nothing;
update public.gov_units set sort = 10 where code = 'TRN' and sort <> 10;

-- ---------- 2) الأسطول
create table if not exists public.vehicles (
  id bigserial primary key,
  plate text not null unique,                     -- رقم اللوحة كما في الاستمارة
  make text default '', model text default '', year int, color text default '',
  kind text not null default 'sedan' check (kind in ('sedan','suv','pickup','van','bus','other')),
  seats int,
  status text not null default 'available' check (status in ('available','out','maint','off')),
  odometer int not null default 0,
  reg_exp date, ins_exp date, insp_exp date,      -- الاستمارة، التأمين، الفحص الدوري
  service_km int, service_date date,              -- الصيانة القادمة بالعداد أو التاريخ
  fuel_card text default '', keys_loc text default '', notes text default '',
  sort int default 0, active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create sequence if not exists public.vehicle_trips_ref_seq;
create table if not exists public.vehicle_trips (
  id bigserial primary key,
  ref text unique,
  vehicle_id bigint references public.vehicles(id) on delete restrict,
  status text not null default 'requested' check (status in ('requested','out','returned','cancelled','rejected')),
  user_id uuid references public.profiles(id) on delete set null,   -- مستلم السيارة
  driver_name text not null default '', unit text references public.gov_units(code) on update cascade on delete set null, phone text default '',
  purpose text not null default '', dest text default '', facility_id bigint references public.facilities(id) on delete set null, passengers int,
  need_at timestamptz,                              -- وقت الخروج المطلوب
  expected_back timestamptz,                        -- موعد العودة المتوقع
  overnight boolean not null default false, overnight_by uuid,
  out_at timestamptz, out_by uuid, odo_out int, fuel_out int check (fuel_out between 0 and 8), chk_out jsonb default '{}', notes_out text default '',
  back_at timestamptz, back_by uuid, odo_back int, fuel_back int check (fuel_back between 0 and 8), chk_back jsonb default '{}', notes_back text default '',
  damage boolean not null default false, damage_note text default '',
  fuel_added numeric, fuel_cost numeric,
  ops_item_id bigint references public.ops_items(id) on delete set null,
  reason text default '',                          -- سبب الرفض أو الإلغاء
  created_by uuid default auth.uid(), created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index if not exists vehicle_trips_one_out on public.vehicle_trips(vehicle_id) where status = 'out';
create index if not exists vehicle_trips_status on public.vehicle_trips(status);
create index if not exists vehicle_trips_user on public.vehicle_trips(user_id);
create index if not exists vehicle_trips_out_at on public.vehicle_trips(out_at);

create or replace function public.trn_staff() returns boolean language sql stable security definer set search_path = public as $$ select public.ops_staff('TRN') $$;
create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(public.my_role() not in ('pending','disabled'), false) $$;

alter table public.vehicles enable row level security;
alter table public.vehicle_trips enable row level security;
grant select, insert, update, delete on public.vehicles, public.vehicle_trips to authenticated;
grant usage, select on sequence public.vehicles_id_seq, public.vehicle_trips_id_seq, public.vehicle_trips_ref_seq to authenticated;
drop policy if exists p_read on public.vehicles; create policy p_read on public.vehicles for select using (public.is_active_user());
drop policy if exists p_write on public.vehicles; create policy p_write on public.vehicles for all using (public.trn_staff()) with check (public.trn_staff());
drop policy if exists p_read on public.vehicle_trips; create policy p_read on public.vehicle_trips for select using (public.can_read() or public.trn_staff() or user_id = auth.uid() or created_by = auth.uid());
drop policy if exists p_ins on public.vehicle_trips; create policy p_ins on public.vehicle_trips for insert with check (public.is_active_user());
drop policy if exists p_upd on public.vehicle_trips; create policy p_upd on public.vehicle_trips for update using (public.trn_staff() or user_id = auth.uid() or created_by = auth.uid());
drop policy if exists p_del on public.vehicle_trips; create policy p_del on public.vehicle_trips for delete using (public.is_admin());

-- ---------- 3) قواعد الرحلة: من يغيّر ماذا، والتحقق عند التسليم والاستلام
create or replace function public.trip_biu() returns trigger language plpgsql security definer set search_path = public as $$
declare staff boolean := auth.uid() is null or public.trn_staff(); v record; p record;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.ref := 'TRP-' || to_char(now(), 'YY') || '-' || lpad(nextval('public.vehicle_trips_ref_seq')::text, 5, '0');
    if not staff then   -- الموظف يطلب لنفسه فقط
      if new.status <> 'requested' then raise exception 'تسليم السيارة يسجّله قسم الحركة'; end if;
      new.user_id := auth.uid(); new.vehicle_id := null; new.overnight_by := null;
    end if;
    if new.user_id is not null then
      select full_name, unit, phone into p from public.profiles where id = new.user_id;
      new.driver_name := coalesce(nullif(new.driver_name, ''), p.full_name, '');
      new.unit := coalesce(new.unit, p.unit);
    end if;
    if coalesce(trim(new.driver_name), '') = '' then raise exception 'اسم مستلم السيارة مطلوب'; end if;
    if coalesce(trim(new.purpose), '') = '' then raise exception 'غرض المهمة مطلوب'; end if;
  else
    if not staff then
      if old.status <> 'requested' then raise exception 'لا يمكن تعديل رحلة بعد تسليم السيارة؛ راجع قسم الحركة'; end if;
      if new.status not in ('requested','cancelled') then raise exception 'تسليم السيارة واستلامها يسجّلهما قسم الحركة'; end if;
      if new.vehicle_id is distinct from old.vehicle_id or new.overnight_by is distinct from old.overnight_by or new.user_id is distinct from old.user_id then raise exception 'هذا الحقل لقسم الحركة'; end if;
    end if;
    if old.status in ('returned','cancelled','rejected') and new.status is distinct from old.status then raise exception 'الرحلة مغلقة'; end if;
  end if;

  if new.overnight and new.overnight_by is null and staff and auth.uid() is not null then new.overnight_by := auth.uid(); end if;

  -- التسليم
  if new.status = 'out' and (tg_op = 'INSERT' or old.status <> 'out') then
    if new.vehicle_id is null then raise exception 'اختر السيارة'; end if;
    select * into v from public.vehicles where id = new.vehicle_id for update;
    if not v.active or v.status <> 'available' then raise exception 'السيارة % غير متاحة الآن', v.plate; end if;
    if (v.reg_exp is not null and v.reg_exp < current_date) or (v.ins_exp is not null and v.ins_exp < current_date) or (v.insp_exp is not null and v.insp_exp < current_date) then
      raise exception 'لا تُسلَّم السيارة %: وثيقة منتهية (الاستمارة أو التأمين أو الفحص الدوري) — R-41', v.plate; end if;
    if new.odo_out is null or new.fuel_out is null then raise exception 'سجّل العداد ومستوى الوقود عند التسليم'; end if;
    if new.odo_out < v.odometer then raise exception 'عداد التسليم (%) أقل من آخر عداد مسجّل للسيارة (%)', new.odo_out, v.odometer; end if;
    new.out_at := coalesce(new.out_at, now()); new.out_by := coalesce(new.out_by, auth.uid());
    new.expected_back := coalesce(new.expected_back, greatest(date_trunc('day', now() at time zone 'Asia/Riyadh') at time zone 'Asia/Riyadh' + interval '15 hours 30 minutes', now() + interval '1 hour'));
  end if;
  -- الاستلام
  if new.status = 'returned' and tg_op = 'UPDATE' and old.status = 'out' then
    if new.odo_back is null or new.fuel_back is null then raise exception 'سجّل العداد ومستوى الوقود عند الاستلام'; end if;
    if new.odo_back < new.odo_out then raise exception 'عداد الاستلام (%) أقل من عداد التسليم (%)', new.odo_back, new.odo_out; end if;
    if new.damage and coalesce(trim(new.damage_note), '') = '' then raise exception 'صف الضرر أو العطل'; end if;
    new.back_at := coalesce(new.back_at, now()); new.back_by := coalesce(new.back_by, auth.uid());
  end if;
  if new.status = 'returned' and tg_op = 'UPDATE' and old.status = 'requested' then raise exception 'لم تُسلَّم السيارة بعد'; end if;
  return new;
end $$;
drop trigger if exists trip_biu on public.vehicle_trips;
create trigger trip_biu before insert or update on public.vehicle_trips for each row execute function public.trip_biu();

-- بعد التغيير: حالة السيارة وعدادها، بلاغ عطل تلقائي عند الضرر، والإشعارات
create or replace function public.trip_aiu() returns trigger language plpgsql security definer set search_path = public as $$
declare v record; oid bigint; st text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if new.vehicle_id is not null then select * into v from public.vehicles where id = new.vehicle_id; end if;
  if new.status = 'out' and st is distinct from 'out' then
    update public.vehicles set status = 'out', odometer = greatest(odometer, new.odo_out), updated_at = now() where id = new.vehicle_id;
    perform public.notify(array[new.user_id], 'fleet', 'استلمت السيارة ' || v.plate, 'العودة المتوقعة ' || to_char(new.expected_back at time zone 'Asia/Riyadh', 'HH24:MI') || ' — ' || new.purpose, '#/fleet');
  elsif new.status = 'returned' and st = 'out' then
    update public.vehicles set status = case when new.damage then 'maint' else 'available' end, odometer = greatest(odometer, new.odo_back), updated_at = now() where id = new.vehicle_id;
    if new.damage and new.ops_item_id is null then
      insert into public.ops_items(kind, unit, title, details, priority, status, source, asset, requester_name, data, created_by)
        values ('vfix', 'TRN', 'ضرر أو عطل في السيارة ' || v.plate, new.damage_note || E'\nاكتُشف عند الاستلام من ' || new.driver_name || ' (' || new.ref || ')', 'p3', 'new', 'other', v.plate, new.driver_name,
          jsonb_build_object('vehicle', v.plate, 'odo', new.odo_back, 'trip', new.ref), auth.uid())
        returning id into oid;
      update public.vehicle_trips set ops_item_id = oid where id = new.id;
      perform public.notify(public.unit_members('TRN'), 'fleet', 'ضرر في السيارة ' || v.plate, 'عند الاستلام من ' || new.driver_name || ': ' || new.damage_note, '#/ops/list?id=' || oid);
    end if;
    perform public.notify(array[new.user_id], 'fleet', 'تم استلام السيارة ' || v.plate || ' منك', 'شكراً لك — ' || (new.odo_back - new.odo_out) || ' كم', '#/fleet');
  elsif new.status = 'requested' and tg_op = 'INSERT' then
    perform public.notify(public.unit_members('TRN'), 'fleet', 'طلب سيارة: ' || new.driver_name, new.purpose || coalesce(' — ' || nullif(new.dest, ''), '') || coalesce(' · ' || to_char(new.need_at at time zone 'Asia/Riyadh', 'DD/MM HH24:MI'), ''), '#/dept/TRN/fleet');
  elsif new.status in ('rejected','cancelled') and st = 'requested' then
    if new.status = 'rejected' then perform public.notify(array[new.user_id], 'fleet', 'تعذّر توفير سيارة لطلبك', coalesce(nullif(new.reason, ''), new.purpose), '#/fleet'); end if;
  end if;
  return new;
end $$;
drop trigger if exists trip_aiu on public.vehicle_trips;
create trigger trip_aiu after insert or update of status on public.vehicle_trips for each row execute function public.trip_aiu();

create or replace function public.vehicles_bu() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.plate := trim(new.plate);
  if tg_op = 'UPDATE' and new.status = 'available' and old.status = 'out' and exists (select 1 from public.vehicle_trips where vehicle_id = new.id and status = 'out') then
    raise exception 'السيارة مسلَّمة لموظف؛ سجّل استلامها أولاً'; end if;
  return new; end $$;
drop trigger if exists vehicles_bu on public.vehicles;
create trigger vehicles_bu before insert or update on public.vehicles for each row execute function public.vehicles_bu();

-- التنبيه اليومي: مساءً الرحلات التي لم تعد بعد موعدها؛ صباح الأحد الوثائق التي تنتهي خلال 30 يوماً والصيانة المستحقة
create or replace function public.fleet_daily(p_kind text default 'evening') returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; d int; s int;
begin
  if p_kind = 'evening' then
    for r in select t.*, v.plate from public.vehicle_trips t join public.vehicles v on v.id = t.vehicle_id where t.status = 'out' and t.expected_back < now() and not t.overnight loop
      perform public.notify(array[r.user_id], 'fleet', 'لم تُعد السيارة ' || r.plate || ' بعد', 'كان موعد العودة ' || to_char(r.expected_back at time zone 'Asia/Riyadh', 'HH24:MI') || ' — أعدها لقسم الحركة أو اطلب تمديداً', '#/fleet');
      n := n + 1;
    end loop;
    if n > 0 then perform public.notify(public.unit_members('TRN'), 'fleet', n || ' سيارة لم تعد بعد موعدها', 'تابعها من لوحة الحركة', '#/dept/TRN/fleet'); end if;
  elsif extract(dow from now() at time zone 'Asia/Riyadh') = 0 then
    select count(*) into d from public.vehicles where active and least(coalesce(reg_exp, '9999-01-01'), coalesce(ins_exp, '9999-01-01'), coalesce(insp_exp, '9999-01-01')) < current_date + 30;
    select count(*) into s from public.vehicles where active and (service_date < current_date + 7 or (service_km is not null and odometer >= service_km - 500));
    if d + s > 0 then
      perform public.notify(public.unit_members('TRN'), 'fleet', 'الأسطول يحتاج متابعة', concat_ws(' · ', case when d > 0 then d || ' سيارة وثائقها تنتهي خلال 30 يوماً' end, case when s > 0 then s || ' سيارة صيانتها مستحقة' end), '#/dept/TRN/vehicles');
      n := 1;
    end if;
  end if;
  return n;
end $$;

-- ---------- 4) نماذج القسم في محرك الأعمال
insert into public.ops_kinds(code, unit, name, short, icon, descr, proc, intake, prio, fields, sort) values
 ('vfix', 'TRN', 'بلاغ عطل أو ضرر في سيارة', 'عطل سيارة', 'car', 'عطل أو ضرر في سيارة من الأسطول: يوقفها عن التسليم حتى إصلاحها (V-03)', 'V-03', false, 'p3',
  '[{"k":"vehicle","l":"السيارة (اللوحة)","t":"text","req":true},{"k":"odo","l":"العداد","t":"number"},{"k":"symptom","l":"نوع العطل","t":"select","o":["محرك أو قير","فرامل","إطارات","كهرباء وتكييف","هيكل أو صدمة","زجاج ومرايا","أخرى"],"req":true}]', 300),
 ('vacc', 'TRN', 'حادث أو مخالفة مرورية', 'حادث / مخالفة', 'alert', 'حادث لسيارة من الأسطول أو مخالفة مرورية عليها — يُربط بمستخدم السيارة وقتها (V-05)', 'V-05', true, 'p2',
  '[{"k":"vehicle","l":"السيارة (اللوحة)","t":"text","req":true},{"k":"type","l":"النوع","t":"select","o":["حادث مروري","مخالفة مرورية","تلف أثناء الوقوف","سرقة أو فقد"],"req":true},{"k":"when","l":"التاريخ والوقت","t":"datetime-local","req":true},{"k":"place","l":"المكان","t":"text"},{"k":"injury","l":"إصابات؟","t":"select","o":["لا","نعم"]},{"k":"najm","l":"رقم تقرير نجم / المخالفة","t":"text"}]', 310)
on conflict (code) do nothing;
update public.ops_kinds set close_fields = '[{"k":"by","l":"نُفّذ بواسطة","t":"select","o":["الوكالة","ورشة متعاقدة","الفريق الذاتي"],"req":true},{"k":"cost","l":"التكلفة (ر.س)","t":"number"},{"k":"odo","l":"العداد عند الإصلاح","t":"number"}]'::jsonb
  where code = 'vfix' and close_fields = '[]'::jsonb;
update public.ops_kinds set close_fields = '[{"k":"result","l":"النتيجة","t":"select","o":["سُددت المخالفة من مستخدم السيارة","أُصلح الضرر على التأمين","أُصلح الضرر على حساب المتسبب","حُفظت لعدم ثبوت المسؤولية"],"req":true},{"k":"driver","l":"مستخدم السيارة وقتها","t":"text","req":true}]'::jsonb
  where code = 'vacc' and close_fields = '[]'::jsonb;

-- ---------- 5) دليل الإجراءات V-
insert into public.gov_processes(code,title,owner,units,goal,trigger,inputs,outputs,kpi,steps,notes,sort) values
('V-01','تسليم سيارات المقر للمهام اليومية واستلامها','TRN','["EMP", "TRN", "DIR"]'::jsonb,
 'كل سيارة تخرج من المقر مسجلة باسم مستلمها ووجهتها وعدادها ووقودها، وتعود في اليوم نفسه بحالتها موثقة.',
 'حاجة موظف في أحد الأقسام للخروج لمهمة عمل: منشأة، موقع مشروع، جهة حكومية أو مورد.',
 'طلب السيارة (الغرض، الوجهة، وقت الخروج والعودة)، رخصة قيادة سارية.',
 'محضر تسليم واستلام إلكتروني لكل رحلة؛ سجل استخدام الأسطول؛ بلاغ عطل تلقائي عند اكتشاف ضرر.',
 'الرحلات المسجلة 100٪؛ العودة في اليوم نفسه ≥ 95٪؛ الأضرار المكتشفة عند الاستلام تُبلَّغ في اليوم نفسه 100٪.',
 '[{"unit": "EMP", "action": "طلب السيارة من المنصة (سيارات المقر ← طلب سيارة) بالغرض والوجهة ووقت الخروج والعودة المتوقع", "sla": "قبل الخروج بساعة على الأقل", "where": "المنصة — سيارات المقر", "kind": "step"}, {"unit": "TRN", "action": "تخصيص سيارة متاحة وثائقها سارية، والتحقق من رخصة المستلم؛ المبيت أو الخروج خارج المحافظة يتبع V-06", "sla": "30 دقيقة", "where": "لوحة الحركة", "kind": "decision"}, {"unit": "TRN", "action": "التسليم: فحص السيارة مع المستلم وتسجيل العداد ومستوى الوقود وقائمة التحقق (النظافة، الإطارات، الأضرار الظاهرة، الاستمارة والتأمين، بطاقة الوقود) ثم تسليم المفتاح", "sla": "عند الخروج", "where": "لوحة الحركة ← تسليم", "kind": "step"}, {"unit": "EMP", "action": "استخدام السيارة للمهمة المسجلة فقط، والإبلاغ فوراً عن أي حادث أو عطل (V-05)", "sla": "أثناء المهمة", "where": "—", "kind": "step"}, {"unit": "TRN", "action": "الاستلام: إعادة السيارة قبل نهاية الدوام، وفحصها مع المستلم وتسجيل العداد والوقود والتعبئة وأي ضرر أو ملاحظة", "sla": "اليوم نفسه", "where": "لوحة الحركة ← استلام", "kind": "step"}, {"unit": "TRN", "action": "عند وجود ضرر أو عطل: تتحول السيارة إلى «في الصيانة» ويُفتح بلاغ عطل تلقائياً (V-03) ويُوثّق الضرر بالصور", "sla": "فوري", "where": "تلقائي في المنصة", "kind": "decision"}, {"unit": "TRN", "action": "متابعة الرحلات التي لم تعد بعد موعدها (تنبيه تلقائي 3:30 م للمستلم والقسم)، وتقرير شهري بالاستخدام والتأخير لمدير الإدارة", "sla": "يومياً / شهرياً", "where": "لوحة الحركة", "kind": "step"}]'::jsonb,
 'رقم الرحلة TRP يُطبع في محضر التسليم والاستلام عند الحاجة لتوقيع ورقي.', 900),
('V-02','سجل الأسطول ووثائق السيارات','TRN','["TRN", "PROC", "FIN"]'::jsonb,
 'لكل سيارة سجل كامل ووثائق سارية، ولا تُسلَّم سيارة بوثيقة منتهية.',
 'استلام سيارة جديدة، أو اقتراب انتهاء وثيقة، أو الجرد الربع سنوي.',
 'بيانات السيارة: اللوحة، الموديل، العداد، الاستمارة، التأمين، الفحص الدوري، بطاقة الوقود.',
 'سجل أسطول محدث؛ تجديد الوثائق قبل انتهائها.',
 'سيارات بوثائق سارية 100٪؛ التجديد قبل الانتهاء ≥ 95٪.',
 '[{"unit": "TRN", "action": "تسجيل كل سيارة في المنصة بلوحتها وبياناتها ووثائقها ومكان مفاتيحها", "sla": "عند الاستلام", "where": "الحركة ← الأسطول", "kind": "step"}, {"unit": "TRN", "action": "مراجعة تنبيه الوثائق التي تنتهي خلال 30 يوماً (تنبيه أسبوعي تلقائي)", "sla": "أسبوعياً", "where": "الحركة ← الأسطول", "kind": "step"}, {"unit": "PROC", "action": "تجديد التأمين أو الاستمارة أو الفحص الدوري بطلب من الحركة", "sla": "قبل الانتهاء بأسبوعين", "where": "—", "kind": "step"}, {"unit": "TRN", "action": "إيقاف السيارة عن التسليم إن انتهت وثيقة قبل تجديدها (R-41)", "sla": "فوري", "where": "تلقائي في المنصة", "kind": "decision"}, {"unit": "TRN", "action": "جرد ربع سنوي: مطابقة السجل مع السيارات الفعلية وعداداتها ومفاتيحها", "sla": "كل 3 أشهر", "where": "—", "kind": "step"}]'::jsonb, '', 901),
('V-03','الصيانة الدورية وإصلاح السيارات','TRN','["TRN", "EMP", "PROC"]'::jsonb,
 'سيارات صالحة وآمنة: صيانة دورية في موعدها وإصلاح سريع للأعطال.',
 'موعد صيانة دورية (بالعداد أو الزمن)، أو عطل/ضرر مكتشف عند الاستلام أو من المستخدم.',
 'خطة الصيانة الدورية، بلاغ العطل، أمر الإصلاح.',
 'سيارة مُعادة للخدمة بعداد وموعد صيانة قادم محدث.',
 'الصيانة الدورية في موعدها ≥ 90٪؛ متوسط مدة توقف السيارة للإصلاح ≤ 5 أيام عمل.',
 '[{"unit": "TRN", "action": "خطة صيانة دورية لكل سيارة (كل 5,000–10,000 كم أو 6 أشهر) تولّد أمر العمل تلقائياً", "sla": "حسب الخطة", "where": "الحركة ← الأعمال المخططة", "kind": "step"}, {"unit": "EMP", "action": "الإبلاغ عن أي عطل يظهر أثناء الاستخدام عند إعادة السيارة", "sla": "عند الاستلام", "where": "محضر الاستلام", "kind": "step"}, {"unit": "TRN", "action": "إيقاف السيارة عن التسليم (في الصيانة) وتحديد جهة الإصلاح: الوكالة، ورشة متعاقدة، أو فريق ذاتي", "sla": "يوم", "where": "بلاغ عطل سيارة", "kind": "decision"}, {"unit": "TRN", "action": "متابعة الإصلاح واستلام السيارة وتجربتها", "sla": "5 أيام عمل", "where": "—", "kind": "step"}, {"unit": "TRN", "action": "إغلاق البلاغ بالتكلفة والعداد، وإعادة السيارة «متاحة» وتحديث موعد الصيانة القادمة", "sla": "عند الاستلام", "where": "الحركة ← الأسطول", "kind": "step"}]'::jsonb, '', 902),
('V-04','الوقود وبطاقات التعبئة','TRN','["TRN", "EMP", "FIN"]'::jsonb,
 'استهلاك وقود موثق ومعقول لكل سيارة.',
 'تعبئة أثناء مهمة، أو كشف بطاقات الوقود الشهري.',
 'بطاقة وقود لكل سيارة، الكمية والمبلغ عند الاستلام، الكيلومترات المقطوعة.',
 'سجل تعبئة لكل سيارة ومطابقة شهرية.',
 'المطابقة الشهرية منجزة 100٪؛ الاستهلاك غير الطبيعي يُفحص خلال أسبوع.',
 '[{"unit": "TRN", "action": "بطاقة وقود مخصصة لكل سيارة تُحفظ داخلها، ويُسجل رقمها في السجل", "sla": "—", "where": "الحركة ← الأسطول", "kind": "step"}, {"unit": "EMP", "action": "التعبئة بالبطاقة فقط، وتسليم الإيصال عند إعادة السيارة", "sla": "أثناء المهمة", "where": "—", "kind": "step"}, {"unit": "TRN", "action": "تسجيل اللترات والمبلغ في محضر الاستلام", "sla": "عند الاستلام", "where": "لوحة الحركة ← استلام", "kind": "step"}, {"unit": "TRN", "action": "مطابقة كشف البطاقات مع الكيلومترات شهرياً، وفحص أي استهلاك يزيد 20٪ عن معدل السيارة", "sla": "شهرياً", "where": "سجل الحركة", "kind": "decision"}]'::jsonb, '', 903),
('V-05','الحوادث والمخالفات المرورية','TRN','["EMP", "TRN", "SAF", "FIN"]'::jsonb,
 'كل حادث أو مخالفة تُوثّق وتُنسب لمستخدم السيارة وقتها وتُعالج دون أن تتعطل السيارة طويلاً.',
 'حادث مروري، تلف أثناء الوقوف، سرقة، أو وصول مخالفة مرورية على سيارة من الأسطول.',
 'تقرير نجم أو المرور، الصور، وقت الحادث أو المخالفة.',
 'بلاغ موثق، ومستخدم محدد من سجل الرحلات، وإصلاح أو سداد.',
 'الإبلاغ عن الحادث خلال ساعة 100٪؛ المخالفات تُنسب لمستخدمها خلال 3 أيام عمل.',
 '[{"unit": "EMP", "action": "عند الحادث: سلامة الأشخاص أولاً، ثم إبلاغ نجم أو المرور، وإبلاغ قسم الحركة فوراً", "sla": "فوري", "where": "هاتف + المنصة: حادث أو مخالفة", "kind": "step"}, {"unit": "TRN", "action": "تسجيل بلاغ «حادث أو مخالفة مرورية» بتقرير نجم والصور، وإيقاف السيارة إن تضررت", "sla": "خلال ساعة", "where": "المنصة", "kind": "step"}, {"unit": "SAF", "action": "إن وُجدت إصابة: متابعة الحادث بوصفه حادث سلامة", "sla": "فوري", "where": "—", "kind": "step"}, {"unit": "TRN", "action": "المخالفة: مطابقة وقتها مع سجل الرحلات لتحديد مستخدم السيارة وإبلاغه (R-40)", "sla": "3 أيام عمل", "where": "سجل الحركة", "kind": "decision"}, {"unit": "TRN", "action": "إصلاح الضرر (V-03) عبر التأمين أو المتسبب، وإغلاق البلاغ بالنتيجة", "sla": "حسب الحالة", "where": "—", "kind": "step"}]'::jsonb, '', 904),
('V-06','المهام الطويلة والمبيت والخروج خارج المحافظة','TRN','["EMP", "TRN", "DIR"]'::jsonb,
 'المهام التي تتجاوز اليوم أو المحافظة معتمدة مسبقاً وموعد عودتها معروف.',
 'مهمة تتطلب مبيت السيارة خارج المقر أو السفر خارج محافظة الأحساء.',
 'الطلب قبل يوم على الأقل، خطاب المهمة أو موافقة مدير القسم.',
 'رحلة مسجلة بمبيت معتمد وموعد عودة محدد.',
 'المبيت دون اعتماد مسبق = 0.',
 '[{"unit": "EMP", "action": "طلب السيارة قبل يوم على الأقل مع تحديد «مبيت» وموعد العودة وموافقة مدير قسمه", "sla": "قبل يوم", "where": "المنصة — طلب سيارة", "kind": "step"}, {"unit": "TRN", "action": "اعتماد المبيت من رئيس قسم الحركة، ومن مدير الإدارة إذا تجاوز 3 أيام", "sla": "يوم", "where": "لوحة الحركة", "kind": "decision"}, {"unit": "TRN", "action": "التسليم بمحضر كامل وتأكيد بيانات التواصل مع المستلم", "sla": "عند الخروج", "where": "لوحة الحركة", "kind": "step"}, {"unit": "TRN", "action": "متابعة يومية حتى العودة، والاستلام بمحضر كامل", "sla": "يومياً", "where": "لوحة الحركة", "kind": "step"}]'::jsonb, '', 905)
on conflict (code) do nothing;

insert into public.gov_rules(code,title,theme,statement,criteria,owner,process_code,note,sort) values
('R-37','لا خروج بلا محضر','الحركة','لا تخرج سيارة من المقر إلا بمحضر تسليم في المنصة باسم مستلمها ووجهته وعداده ووقوده.','["الرحلة مسجلة قبل تسليم المفتاح", "العداد والوقود وقائمة التحقق مكتملة", "الرخصة سارية"]'::jsonb,'TRN','V-01','',37),
('R-38','العودة في اليوم نفسه','الحركة','تعود السيارة قبل نهاية الدوام الرسمي ما لم يُعتمد المبيت مسبقاً.','["موعد العودة الافتراضي 3:30 م", "المبيت باعتماد مسبق فقط (V-06)", "تنبيه تلقائي عند التأخر"]'::jsonb,'TRN','V-06','',38),
('R-39','الحالة توثَّق عند الطرفين','الحركة','تُسجَّل حالة السيارة عند التسليم وعند الاستلام، وأي ضرر لم يُوثّق عند التسليم يُسأل عنه آخر مستلم.','["العداد ومستوى الوقود في الحالتين", "قائمة التحقق في الحالتين", "الضرر يُصوَّر ويفتح بلاغاً"]'::jsonb,'TRN','V-01','',39),
('R-40','المخالفة على مستخدم السيارة وقتها','الحركة','تُنسب المخالفات المرورية والأضرار لمستخدم السيارة في وقتها بالرجوع لسجل الرحلات.','["مطابقة الوقت مع سجل الرحلات", "إبلاغ المستخدم خلال 3 أيام عمل"]'::jsonb,'TRN','V-05','',40),
('R-41','لا سيارة بوثيقة منتهية','الحركة','لا تُسلَّم سيارة انتهت استمارتها أو تأمينها أو فحصها الدوري.','["المنصة تمنع التسليم تلقائياً", "تنبيه قبل الانتهاء بـ30 يوماً"]'::jsonb,'TRN','V-02','',41)
on conflict (code) do nothing;

insert into public.gov_activities(scope,grp,title,raci,sort) select 'units','ز. الحركة', x.t, x.r::jsonb, x.s from (values
 ('تسليم السيارات واستلامها (V-01)', '{"TRN": "R", "DIR": "I"}', 80),
 ('سجل الأسطول ووثائقه (V-02)', '{"TRN": "R", "DIR": "A"}', 81),
 ('صيانة السيارات وإصلاحها (V-03)', '{"TRN": "R", "DIR": "I"}', 82),
 ('الوقود ومطابقة البطاقات (V-04)', '{"TRN": "R", "DIR": "I"}', 83),
 ('الحوادث والمخالفات المرورية (V-05)', '{"TRN": "R", "SAF": "C", "DIR": "I"}', 84),
 ('اعتماد المبيت والمهام الطويلة (V-06)', '{"TRN": "R", "DIR": "A"}', 85)
) as x(t, r, s) where not exists (select 1 from public.gov_activities a where a.scope = 'units' and a.title = x.t);

insert into public.gov_handoffs(from_unit,to_unit,trigger,deliverable,sla,process_code,note,sort) select x.f, x.t, x.tr, x.d, x.sla, x.p, '', x.s from (values
 ('EMP', 'TRN', 'طلب سيارة لمهمة عمل', 'الغرض والوجهة ووقت الخروج والعودة', 'قبل الخروج بساعة', 'V-01', 60),
 ('TRN', 'EMP', 'تسليم السيارة', 'محضر التسليم: العداد والوقود والحالة', 'عند الخروج', 'V-01', 61),
 ('TRN', 'DIR', 'سيارة لم تعد بعد موعدها أو ضرر في سيارة', 'الرحلة والمستلم والضرر', 'اليوم نفسه', 'V-01', 62),
 ('TRN', 'SAF', 'حادث مروري فيه إصابة', 'تقرير الحادث', 'فوري', 'V-05', 63),
 ('TRN', 'PROC', 'تجديد وثائق السيارات أو إصلاح يحتاج شراء', 'الوثيقة أو أمر الإصلاح والتكلفة', 'قبل الانتهاء بأسبوعين', 'V-02', 64),
 ('TRN', 'FIN', 'مخالفة أو مطالبة تأمين', 'المخالفة ومستخدم السيارة وقتها', '3 أيام عمل', 'V-05', 65)
) as x(f, t, tr, d, sla, p, s) where not exists (select 1 from public.gov_handoffs h where h.from_unit = x.f and h.to_unit = x.t and h.trigger = x.tr);

insert into public.gov_faq(q,a,links,action,sort) select x.q, x.a, x.l::jsonb, '', x.s from (values
 ('كيف أطلب سيارة من المقر لمهمة؟', 'من «سيارات المقر» في المنصة ← طلب سيارة: الغرض والوجهة ووقت الخروج والعودة، قبل الخروج بساعة على الأقل. يخصص قسم الحركة السيارة ويسلمك إياها بمحضر (العداد والوقود والحالة)، وتعيدها في اليوم نفسه قبل 3:30 م (V-01، R-38).', '["V-01", "R-38"]', 40),
 ('ماذا أفعل إذا تعرضت السيارة لحادث؟', 'سلامة الأشخاص أولاً، ثم أبلغ نجم أو المرور، ثم أبلغ قسم الحركة فوراً وارفع «حادث أو مخالفة مرورية» من البلاغات (V-05).', '["V-05"]', 41),
 ('من يتحمل المخالفة المرورية على سيارة الإدارة؟', 'مستخدم السيارة في وقت المخالفة، ويُحدَّد من سجل الرحلات في المنصة (R-40).', '["R-40", "V-05"]', 42),
 ('هل يمكن أن أبيت بالسيارة أو أسافر بها خارج الأحساء؟', 'باعتماد مسبق فقط: اطلبها قبل يوم مع اختيار «مبيت» وموعد العودة، ويعتمدها رئيس قسم الحركة (V-06).', '["V-06"]', 43)
) as x(q, a, l, s) where not exists (select 1 from public.gov_faq f where f.q = x.q);

-- ---------- 6) صور التسليم والاستلام: المرجع trip:<id> والمسار attach/trip_<id>/…
drop policy if exists p_trip_read on public.attachments;
create policy p_trip_read on public.attachments for select using (ref like 'trip:%' and (public.trn_staff() or exists (select 1 from public.vehicle_trips t where 'trip:' || t.id = ref and t.user_id = auth.uid())));
drop policy if exists p_trip_ins on public.attachments;
create policy p_trip_ins on public.attachments for insert with check (ref like 'trip:%' and by_user = auth.uid() and public.trn_staff());
do $$ begin
  drop policy if exists pf_trip_read on storage.objects;
  create policy pf_trip_read on storage.objects for select to authenticated using (bucket_id = 'project-files' and name like 'attach/trip\_%' and public.is_active_user());
  drop policy if exists pf_trip_ins on storage.objects;
  create policy pf_trip_ins on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and name like 'attach/trip\_%' and public.trn_staff());
exception when others then null; end $$;
