-- 0044: سجل الأصول لكل قسم، والأعمال المخططة الدورية (صيانة وقائية، اختبارات دورية، معايرة) التي تولّد أوامر العمل تلقائياً،
-- ونماذج: استلام وقبول جهاز طبي، استدعاء فني، طلب صلاحيات، تقييم مقاول. قابل لإعادة التشغيل في كل نشر.

-- ---------- 1) سجل الأصول
create table if not exists public.assets (
  id bigserial primary key,
  code text not null unique,
  name text not null, category text default '',
  unit text not null references public.gov_units(code) on update cascade,
  facility_id bigint references public.facilities(id) on delete set null,
  location_id bigint references public.fac_locations(id) on delete set null,
  maker text default '', model text default '', serial text default '',
  install_date date, warranty_end date,
  criticality text default 'medium' check (criticality in ('high','medium','low')),
  status text not null default 'in_service' check (status in ('in_service','down','out','disposed')),
  value numeric, notes text default '', data jsonb default '{}',
  active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists assets_unit on public.assets(unit, facility_id);
alter table public.assets enable row level security;
grant select, insert, update, delete on public.assets to authenticated;
grant usage, select on sequence public.assets_id_seq to authenticated;
drop policy if exists p_read on public.assets; create policy p_read on public.assets for select using (public.ops_read());
drop policy if exists p_ins on public.assets; create policy p_ins on public.assets for insert with check (public.ops_staff(unit));
drop policy if exists p_upd on public.assets; create policy p_upd on public.assets for update using (public.ops_staff(unit)) with check (public.ops_staff(unit));
drop policy if exists p_del on public.assets; create policy p_del on public.assets for delete using (public.is_admin());
alter table public.ops_items add column if not exists asset_id bigint references public.assets(id) on delete set null;
create index if not exists ops_items_asset on public.ops_items(asset_id);

-- ---------- 2) الأعمال المخططة الدورية
create table if not exists public.ops_plans (
  id bigserial primary key,
  title text not null,
  unit text not null references public.gov_units(code) on update cascade,
  kind text not null default 'ppm' references public.ops_kinds(code) on update cascade,
  proc text default '',
  facility_id bigint references public.facilities(id) on delete cascade,
  location_id bigint references public.fac_locations(id) on delete set null,
  asset_id bigint references public.assets(id) on delete cascade,
  every int not null default 1 check (every > 0),
  per text not null default 'month' check (per in ('day','week','month','year')),
  next_due date not null,
  lead_days int not null default 7,
  priority text default 'p4',
  checklist jsonb default '[]',
  assignee_id uuid references auth.users(id), assignee_name text default '',
  notes text default '',
  active boolean default true, last_item bigint,
  created_by uuid references auth.users(id), created_at timestamptz default now()
);
alter table public.ops_plans enable row level security;
grant select, insert, update, delete on public.ops_plans to authenticated;
grant usage, select on sequence public.ops_plans_id_seq to authenticated;
drop policy if exists p_read on public.ops_plans; create policy p_read on public.ops_plans for select using (public.ops_read());
drop policy if exists p_ins on public.ops_plans; create policy p_ins on public.ops_plans for insert with check (public.ops_staff(unit));
drop policy if exists p_upd on public.ops_plans; create policy p_upd on public.ops_plans for update using (public.ops_staff(unit)) with check (public.ops_staff(unit));
drop policy if exists p_del on public.ops_plans; create policy p_del on public.ops_plans for delete using (public.ops_staff(unit));
alter table public.ops_items add column if not exists plan_id bigint references public.ops_plans(id) on delete set null;

create or replace function public.ops_step(d date, n int, per text) returns date language sql immutable as $$
  select (d + case per when 'day' then make_interval(days => n) when 'week' then make_interval(weeks => n) when 'month' then make_interval(months => n) else make_interval(years => n) end)::date $$;

-- توليد أوامر العمل المستحقة: لكل خطة حان موعدها (ناقص مهلة التحضير) ولا أمر مفتوح لها
create or replace function public.ops_generate() returns int language plpgsql security definer set search_path = public as $$
declare p record; n int := 0; nid bigint; lbl text;
begin
  if auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','engineer','clerk','facility','tech')) then
    raise exception 'غير مصرح'; end if;
  for p in select * from public.ops_plans where active and next_due - lead_days <= current_date loop
    if exists (select 1 from public.ops_items where plan_id = p.id and status not in ('done','cancelled')) then continue; end if;
    lbl := case p.per when 'day' then 'يومي' when 'week' then 'أسبوعي' when 'month' then 'شهري' else 'سنوي' end;
    insert into public.ops_items(kind, unit, proc, facility_id, location_id, asset_id, title, details, priority, status, source, plan_id, due_at, assignee_id, assignee_name, data, created_by)
    values (p.kind, p.unit, coalesce(nullif(p.proc, ''), (select proc from public.ops_kinds where code = p.kind)), p.facility_id, p.location_id, p.asset_id,
      p.title || ' — ' || to_char(p.next_due, 'YYYY-MM-DD'), coalesce(nullif(p.notes, ''), 'عمل مخطط (' || lbl || ' كل ' || p.every || ')'), coalesce(p.priority, 'p4'), 'accepted', 'ppm', p.id,
      (p.next_due + time '23:59') at time zone 'Asia/Riyadh', p.assignee_id, p.assignee_name,
      jsonb_build_object('due', p.next_due, 'plan_check', coalesce(p.checklist, '[]')), coalesce(p.created_by, auth.uid()))
    returning id into nid;
    update public.ops_plans set next_due = public.ops_step(next_due, every, per), last_item = nid where id = p.id;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.ops_generate() to authenticated;

-- قائمة التحقق: بنود النوع + بنود الخطة الدورية (plan_check)
create or replace function public.ops_check_rules(n public.ops_items, o_status text) returns void language plpgsql stable security definer set search_path = public as $$
declare k record; g jsonb; c jsonb; un text;
begin
  if n.status = 'cancelled' or n.status is not distinct from o_status then return; end if;
  select * into k from public.ops_kinds where code = n.kind;
  for g in select * from jsonb_array_elements(coalesce(k.gates, '[]')) loop
    if public.ops_rank(n.status) >= public.ops_rank(g->>'before') and (n.data->'gates'->(g->>'k')) is null then
      select short into un from public.gov_units where code = g->>'unit';
      raise exception 'يلزم «%» من %  قبل الانتقال إلى هذه المرحلة', g->>'l', coalesce(un, g->>'unit');
    end if;
  end loop;
  if n.status = 'done' then
    for c in select * from jsonb_array_elements(coalesce(k.checklist, '[]') || coalesce(n.data->'plan_check', '[]')) loop
      if coalesce((n.data->'check'->>(c->>'k'))::boolean, false) = false then
        raise exception 'أكمل قائمة التحقق قبل الإغلاق: %', c->>'l';
      end if;
    end loop;
  end if;
end $$;

-- عطل جهاز أو أصل متوقف يجعل حالة الأصل «متعطل» حتى يُغلق العمل
create or replace function public.ops_asset_fx() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.asset_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.kind in ('bme','mnt','it') and coalesce(new.data->>'state', new.data->>'impact', '') ~ '(متوقف|يوقف)' and new.status not in ('done','cancelled') then
    update public.assets set status = 'down', updated_at = now() where id = new.asset_id and status = 'in_service';
  elsif new.status = 'done' then
    update public.assets set status = 'in_service', updated_at = now() where id = new.asset_id and status = 'down'
      and not exists (select 1 from public.ops_items x where x.asset_id = new.asset_id and x.id <> new.id and x.status not in ('done','cancelled') and coalesce(x.data->>'state', x.data->>'impact', '') ~ '(متوقف|يوقف)');
  end if;
  return new;
end $$;
drop trigger if exists ops_asset_fx on public.ops_items;
create trigger ops_asset_fx after insert or update on public.ops_items for each row execute function public.ops_asset_fx();

-- ---------- 3) الأنواع
insert into public.ops_kinds(code, unit, name, short, icon, descr, proc, intake, prio, fields, sort) values
 ('ppm', 'MNT', 'عمل مخطط دوري', 'مخطط', '🗓️', 'صيانة وقائية، اختبار دوري، معايرة — تُولَّد تلقائياً من خطط القسم (G-06، M-03، B-02)', 'G-06', false, 'p4', '[]', 150),
 ('accept', 'MED', 'استلام وقبول جهاز طبي', 'استلام جهاز', '📦', 'توريد وتركيب واختبار قبول وتدريب واستلام جهاز طبي جديد (E-04، G-07)', 'E-04', false, 'p3',
  '[{"k":"device","l":"الجهاز","t":"text","req":true},{"k":"supplier","l":"المورّد","t":"text","req":true},{"k":"po","l":"رقم أمر الشراء أو العقد","t":"text"},{"k":"qty","l":"العدد","t":"number"},{"k":"warranty","l":"مدة الضمان","t":"text"}]', 160),
 ('recall', 'BME', 'استدعاء أو تنبيه فني لجهاز', 'استدعاء', '⚠️', 'استدعاء أو تنبيه سلامة من الهيئة أو الوكيل يشمل أجهزة في المنشآت (B-04)', 'B-04', false, 'p2',
  '[{"k":"device","l":"الجهاز والموديل","t":"text","req":true},{"k":"source","l":"المصدر","t":"select","o":["الهيئة العامة للغذاء والدواء","الشركة المصنّعة أو الوكيل","جهة أخرى"],"req":true},{"k":"ref","l":"رقم الاستدعاء","t":"text"},{"k":"action","l":"الإجراء المطلوب","t":"textarea","req":true}]', 170),
 ('access', 'IT', 'طلب حساب أو صلاحيات', 'صلاحيات', '🔑', 'منح أو تعديل أو سحب حساب وصلاحيات على الأنظمة (T-05، R-35)', 'T-05', true, 'p3',
  '[{"k":"person","l":"اسم الموظف","t":"text","req":true},{"k":"emp","l":"الرقم الوظيفي","t":"text"},{"k":"system","l":"النظام","t":"text","req":true},{"k":"action","l":"المطلوب","t":"select","o":["حساب جديد","تعديل صلاحيات","سحب الصلاحيات (مغادرة أو نقل)"],"req":true},{"k":"manager","l":"المدير المباشر المعتمد للطلب","t":"text","req":true}]', 35),
 ('ceval', 'GEN', 'تقييم أداء مقاول', 'تقييم مقاول', '⭐', 'تقييم شهري لمقاولي النظافة والخدمات والتشغيل والصيانة (S-01، M-04، R-18)', 'S-01', false, 'p4',
  '[{"k":"contractor","l":"المقاول","t":"text","req":true},{"k":"contract","l":"العقد أو الخدمة","t":"text","req":true},{"k":"period","l":"الشهر","t":"text","req":true},{"k":"q","l":"الجودة (1–5)","t":"number","req":true},{"k":"r","l":"سرعة الاستجابة (1–5)","t":"number","req":true},{"k":"s","l":"اكتمال العمالة والالتزام (1–5)","t":"number","req":true},{"k":"h","l":"السلامة والنظافة (1–5)","t":"number","req":true},{"k":"pen","l":"الحسميات أو الغرامات المقترحة","t":"textarea"}]', 180)
on conflict (code) do nothing;
update public.ops_kinds set effect = 'accept',
  gates = '[{"k":"bme","unit":"BME","l":"اختبار القبول الفني والسلامة الكهربائية","before":"verify"}]',
  checklist = '[{"k":"site","l":"جاهزية الموقع (المرافق والصيانة والتقنية)"},{"k":"inst","l":"التركيب والتشغيل التجريبي"},{"k":"train","l":"تدريب المستخدمين وفريق الصيانة الطبية"},{"k":"docs","l":"استلام الكتالوجات وشهادات الضمان"},{"k":"asset","l":"تسجيل الجهاز في سجل الأصول"}]'
  where code = 'accept' and gates = '[]'::jsonb;
update public.ops_kinds set checklist = '[{"k":"find","l":"حصر الأجهزة المتأثرة في كل المنشآت"},{"k":"act","l":"تنفيذ الإجراء المطلوب على كل جهاز"},{"k":"notify","l":"إبلاغ الأقسام المستخدمة والتوثيق"}]'
  where code = 'recall' and checklist = '[]'::jsonb;
update public.ops_kinds set checklist = '[{"k":"done","l":"نُفذ المطلوب على النظام"},{"k":"inform","l":"أُبلغ الموظف ومديره"}]' where code = 'access' and checklist = '[]'::jsonb;
