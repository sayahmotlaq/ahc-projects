-- 0046: توزيع الأدوار — دور «رئيس قسم»، وسجل الأدوار المعتمد مسبقاً (roster) يطبَّق تلقائياً عند تسجيل الموظف بإيميله،
-- ومدراء المرافق مرتبطون بمنشآتهم فتصلهم أعمالها وملاحظاتها. قابل لإعادة التشغيل في كل نشر.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','engineer','viewer','finance','clerk','facility','tech','head','requester','pending','disabled'));
alter table public.profiles add column if not exists fac_ids bigint[] default '{}';

-- رئيس القسم: يقرأ المنصة كاملة، ويعمل على أعمال قسمه كفريقه
create or replace function public.can_read() returns boolean language sql stable as $$ select public.my_role() in ('admin','engineer','viewer','finance','clerk','head') $$;
create or replace function public.ops_read() returns boolean language sql stable set search_path = public as $$ select public.can_read() or public.my_role() in ('facility','tech') $$;
create or replace function public.can_fm() returns boolean language sql stable set search_path = public as $$ select public.can_read() or public.my_role() in ('facility','tech') $$;
create or replace function public.ops_staff(u text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('engineer','clerk','facility','tech','head')
    and (p.unit = u or (p.role = 'facility' and p.unit is null and u in ('FAC','MNT','SAF')))) $$;
create or replace function public.unit_members(u text) returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role in ('engineer','clerk','facility','tech','head')
    and (unit = u or (role = 'facility' and unit is null and u in ('FAC','MNT','SAF'))) $$;
create or replace function public.fac_managers(f bigint) returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role not in ('pending','disabled') and f = any(fac_ids) $$;

-- ---------- سجل الأدوار المعتمد مسبقاً
create table if not exists public.role_roster (
  email text primary key,
  full_name text default '',
  role text not null check (role in ('admin','engineer','viewer','finance','clerk','facility','tech','head','requester')),
  unit text references public.gov_units(code) on update cascade on delete set null,
  fac_ids bigint[] default '{}',
  title text default '', note text default '',
  created_at timestamptz default now()
);
alter table public.role_roster enable row level security;
grant select, insert, update, delete on public.role_roster to authenticated;
drop policy if exists p_admin on public.role_roster; create policy p_admin on public.role_roster for all using (public.is_admin()) with check (public.is_admin());

-- عند إنشاء الملف الشخصي (التسجيل): إن كان الإيميل في السجل يأخذ دوره وقسمه ومنشآته مباشرة بدل «بانتظار الاعتماد»
create or replace function public.profiles_roster_bi() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.role_roster where email = lower(new.email);
  if r.email is not null and new.role = 'pending' then
    new.role := r.role; new.unit := coalesce(r.unit, new.unit); new.fac_ids := coalesce(r.fac_ids, '{}');
    if coalesce(r.title, '') <> '' then new.title := r.title; end if;
    if new.facility_id is null and array_length(r.fac_ids, 1) > 0 then new.facility_id := r.fac_ids[1]; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_roster_bi on public.profiles;
create trigger profiles_roster_bi before insert on public.profiles for each row execute function public.profiles_roster_bi();

-- عند إضافة سطر للسجل أو تعديله: يُطبَّق على صاحب الإيميل إن كان مسجلاً
create or replace function public.roster_apply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  update public.profiles set role = new.role, unit = coalesce(new.unit, unit), fac_ids = coalesce(new.fac_ids, '{}'),
    facility_id = coalesce(facility_id, new.fac_ids[1]), title = case when coalesce(new.title, '') <> '' then new.title else title end
    where lower(email) = new.email and role <> 'admin';
  return new;
end $$;
drop trigger if exists roster_apply on public.role_roster;
create trigger roster_apply before insert or update on public.role_roster for each row execute function public.roster_apply();

-- ---------- مدير المرفق يُبلَّغ بأعمال منشآته وملاحظات أنظمتها
create or replace function public.ops_fac_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare st jsonb := '{"new":"جديد","accepted":"مستلم","in_progress":"قيد التنفيذ","on_hold":"معلّق","verify":"بانتظار التأكيد","done":"مكتمل","cancelled":"ملغى"}'; m uuid[]; u text;
begin
  if new.facility_id is null then return new; end if;
  m := public.fac_managers(new.facility_id); if m = '{}' then return new; end if;
  select short into u from public.gov_units where code = new.unit;
  if tg_op = 'INSERT' then
    perform public.notify(m, 'ops', 'في منشأتك: ' || new.title, coalesce(u, '') || ' · ' || new.ref, '#/ops/list?id=' || new.id);
  elsif new.status is distinct from old.status and new.status in ('in_progress','verify','done','cancelled') then
    perform public.notify(m, 'ops', (st->>new.status) || ' في منشأتك: ' || new.title, coalesce(nullif(new.last_action, ''), new.ref), '#/ops/list?id=' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists ops_fac_notify on public.ops_items;
create trigger ops_fac_notify after insert or update on public.ops_items for each row execute function public.ops_fac_notify();

create or replace function public.fm_fac_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'import' then return new; end if;
  perform public.notify(public.fac_managers(new.facility_id), 'fm', 'ملاحظة على أنظمة منشأتك: ' || new.title, '', '#/fm/obs?id=' || new.id);
  return new;
end $$;
drop trigger if exists fm_fac_notify on public.fm_obs;
create trigger fm_fac_notify after insert on public.fm_obs for each row execute function public.fm_fac_notify();

-- ---------- مدراء المرافق (قائمة المستخدم 14 أكتوبر 2026): دور «مدير مرفق» في قسم المرافق مع منشآته
-- تُطابق المنشآت بأسمائها في المنصة؛ ما لا يطابق يبقى بلا ربط حتى يُضبط من الإدارة ← المستخدمون ← سجل الأدوار
insert into public.role_roster(email, full_name, role, unit, fac_ids, title)
select v.email, v.name, 'facility', 'FAC',
  coalesce((select array_agg(f.id order by f.id) from public.facilities f where exists (select 1 from unnest(v.pats) p where f.name like p)), '{}'), 'مدير مرفق'
from (values
  ('msaldulaym@moh.gov.sa', 'مهدي صالح الدوسري', array['%الملك فيصل%']),
  ('ahayalsaad@moh.gov.sa', 'احمد عايش السعد', array['%الولادة%']),
  ('amalabdulgader@moh.gov.sa', 'عبدالله محمد العبدالقادر', array['%الجبر للعيون%', '%الشيخ حسن%', '%أمراض الدم%']),
  ('malkishi@moh.gov.sa', 'محمد علي الكشي', array['%الملك فهد%', '%الأمير سلطان%']),
  ('aalghamdi500@moh.gov.sa', 'علي جمعان الغامدي', array['%سعود بن جلوي%', 'مستشفى العيون%']),
  ('yalmohammed@moh.gov.sa', 'يوسف طاهر المحمد', array['%العمران%', '%الجفر%']),
  ('aalnathiri@moh.gov.sa', 'علي عبدالله الناظري', array['%الصحة النفسية%']),
  ('aalanazi485@moh.gov.sa', 'عبدالله مدسوس العنزي', array['مركز صحي%', '%الرعاية الصحية الأولية%'])
) as v(email, name, pats)
on conflict (email) do nothing;

-- مستشفى الشيخ حسن (العفالق) لعبدالله العبدالقادر (يُضاف لمنشآته إن لم يكن مربوطاً)
update public.role_roster r set fac_ids = r.fac_ids || f.id from public.facilities f
  where r.email = 'amalabdulgader@moh.gov.sa' and f.name like '%الشيخ حسن%' and not f.id = any(r.fac_ids);
