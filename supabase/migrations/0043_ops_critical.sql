-- 0043: الأعمال التشغيلية الحرجة المترابطة بين الأقسام — سجل المواقع والغرف وحالتها (F-03، R-16)، إغلاق الموقع وإعادة فتحه (F-01)،
-- تصريح العمل (M-01)، تعطيل أنظمة الحريق (H-01)، الإيقاف المخطط للمرافق (M-02)؛ مع «بوابات اعتماد» لأقسام أخرى و«قائمة تحقق» قبل الإغلاق.
-- قابل لإعادة التشغيل في كل نشر.

-- ---------- 1) سجل المواقع والغرف
create table if not exists public.fac_locations (
  id bigserial primary key,
  facility_id bigint not null references public.facilities(id) on delete cascade,
  code text not null, name text default '', building text default '', floor text default '',
  kind text default '', critical boolean default false,
  status text not null default 'operational' check (status in ('operational','closed','restricted','out')),
  status_note text default '', status_since timestamptz default now(), status_item bigint,
  active boolean default true, sort int default 0,
  created_at timestamptz default now(),
  unique (facility_id, code)
);
alter table public.fac_locations enable row level security;
grant select, insert, update, delete on public.fac_locations to authenticated;
grant usage, select on sequence public.fac_locations_id_seq to authenticated;
drop policy if exists p_read on public.fac_locations; create policy p_read on public.fac_locations for select using (public.ops_read() or public.my_role() = 'requester');
drop policy if exists p_ins on public.fac_locations; create policy p_ins on public.fac_locations for insert with check (public.ops_staff('FAC'));
drop policy if exists p_upd on public.fac_locations; create policy p_upd on public.fac_locations for update using (public.ops_staff('FAC')) with check (public.ops_staff('FAC'));
drop policy if exists p_del on public.fac_locations; create policy p_del on public.fac_locations for delete using (public.is_admin());

alter table public.ops_items add column if not exists location_id bigint references public.fac_locations(id) on delete set null;
create index if not exists ops_items_loc on public.ops_items(location_id);

-- ---------- 2) بوابات الاعتماد وقوائم التحقق وأثر العمل على الموقع
alter table public.ops_kinds add column if not exists gates jsonb default '[]';      -- [{k,unit,l,before}] اعتماد قسم آخر قبل الوصول لحالة
alter table public.ops_kinds add column if not exists checklist jsonb default '[]';  -- [{k,l}] بنود يلزم إكمالها قبل «مكتمل»
alter table public.ops_kinds add column if not exists effect text default '';         -- closure | impair | shutdown | permit

create or replace function public.ops_rank(s text) returns int language sql immutable as $$
  select case s when 'new' then 0 when 'accepted' then 1 when 'in_progress' then 2 when 'on_hold' then 2 when 'verify' then 3 when 'done' then 4 else -1 end $$;

-- تحقق البوابات والقائمة عند تغيير الحالة (يُستدعى من ops_biu)
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
    for c in select * from jsonb_array_elements(coalesce(k.checklist, '[]')) loop
      if coalesce((n.data->'check'->>(c->>'k'))::boolean, false) = false then
        raise exception 'أكمل قائمة التحقق قبل الإغلاق: %', c->>'l';
      end if;
    end loop;
  end if;
end $$;

-- ops_biu: نُعيد تعريفه بإضافة تحقق البوابات والقائمة، وتجاوز حارس «صاحب البلاغ» عند اعتماد بوابة عبر الدالة ops_gate
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
    new.data := coalesce(new.data, '{}') - 'gates';   -- الاعتمادات لا تُكتب إلا عبر ops_gate
    if new.status not in ('new') then new.accepted_at := now(); perform public.ops_check_rules(new, 'new'); end if;
    if new.location_id is not null and coalesce(new.location, '') = '' then
      select concat_ws(' — ', nullif(code, ''), nullif(name, '')) into new.location from public.fac_locations where id = new.location_id;
    end if;
    return new;
  end if;
  staff := auth.uid() is null or current_setting('ops.gate', true) = '1' or public.ops_staff(old.unit) or public.ops_staff('FAC') or coalesce(old.assignee_id = auth.uid(), false);
  if not staff then
    a := to_jsonb(new) - array['status','last_action','last_action_at','last_action_by','rating','feedback','updated_at','closed_at','closed_by','close_note','resolved_at'];
    b := to_jsonb(old) - array['status','last_action','last_action_at','last_action_by','rating','feedback','updated_at','closed_at','closed_by','close_note','resolved_at'];
    if a <> b then raise exception 'يمكنك متابعة بلاغك وتأكيد معالجته وتقييمه فقط؛ التعديل لفريق القسم المختص'; end if;
    if new.status is distinct from old.status and not ((old.status = 'new' and new.status = 'cancelled') or (old.status = 'verify' and new.status in ('done','in_progress'))) then
      raise exception 'لا يمكنك نقل البلاغ إلى هذه الحالة'; end if;
  end if;
  if (new.status is distinct from old.status or new.step is distinct from old.step or new.unit is distinct from old.unit)
     and coalesce(new.last_action, '') = coalesce(old.last_action, '') then
    raise exception 'يلزم ذكر المعالجة أو الإجراء المتخذ مع كل تحديث للحالة أو الخطوة';
  end if;
  if current_setting('ops.gate', true) is distinct from '1' and (new.data->'gates') is distinct from (old.data->'gates') then
    new.data := jsonb_set(coalesce(new.data, '{}'), '{gates}', coalesce(old.data->'gates', '{}'));
    if (old.data->'gates') is null then new.data := new.data - 'gates'; end if;
  end if;
  perform public.ops_check_rules(new, old.status);
  if coalesce(new.last_action, '') <> coalesce(old.last_action, '') then new.last_action_at := now(); new.last_action_by := auth.uid(); end if;
  if new.priority is distinct from old.priority and new.due_at is not distinct from old.due_at then new.due_at := old.created_at + public.ops_sla(new.priority); end if;
  if new.unit is distinct from old.unit then
    if new.kind = old.kind then new.kind := coalesce((select code from public.ops_kinds where unit = new.unit and active order by intake desc, sort limit 1), new.kind); end if;
    if new.proc is not distinct from old.proc then new.proc := coalesce((select nullif(proc, '') from public.ops_kinds where code = new.kind), new.proc); new.step := 1; end if;
  end if;
  if new.location_id is distinct from old.location_id and new.location_id is not null and new.location is not distinct from old.location then
    select concat_ws(' — ', nullif(code, ''), nullif(name, '')) into new.location from public.fac_locations where id = new.location_id;
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

-- أثر العمل على حالة الموقع: الإغلاق ينفَّذ عند «قيد التنفيذ» ويُرفع عند «مكتمل» أو الإلغاء؛ تعطيل الحريق والإيقاف المخطط يجعلان الموقع «مقيداً»
create or replace function public.ops_effects() returns trigger language plpgsql security definer set search_path = public as $$
declare ef text;
begin
  if new.location_id is null then return new; end if;
  select effect into ef from public.ops_kinds where code = new.kind;
  if coalesce(ef, '') not in ('closure','impair','shutdown') then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'in_progress' then
    update public.fac_locations set status = case ef when 'closure' then 'closed' else 'restricted' end, status_note = new.title, status_since = now(), status_item = new.id where id = new.location_id;
  elsif new.status in ('done','cancelled') then
    update public.fac_locations set status = 'operational', status_note = case when new.status = 'done' then 'أُعيد للتشغيل: ' || coalesce(nullif(new.last_action, ''), new.title) else '' end, status_since = now(), status_item = null
      where id = new.location_id and (status_item = new.id or status_item is null);
  end if;
  return new;
end $$;
drop trigger if exists ops_effects on public.ops_items;
create trigger ops_effects after insert or update on public.ops_items for each row execute function public.ops_effects();

-- طلب الاعتماد يصل لفريق القسم صاحب البوابة عند إنشاء العمل
create or replace function public.ops_gates_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare g jsonb; fac text;
begin
  select name into fac from public.facilities where id = new.facility_id;
  for g in select * from jsonb_array_elements(coalesce((select gates from public.ops_kinds where code = new.kind), '[]')) loop
    perform public.notify(public.unit_members(g->>'unit') || case when g->>'unit' in ('DIR','EXEC') then public.admins() else '{}'::uuid[] end,
      'ops', 'مطلوب اعتمادك: ' || (g->>'l'), new.title || ' · ' || coalesce(fac, '') || ' · ' || new.ref, '#/ops/list?id=' || new.id);
  end loop;
  return new;
end $$;
drop trigger if exists ops_gates_ai on public.ops_items;
create trigger ops_gates_ai after insert on public.ops_items for each row execute function public.ops_gates_ai();

-- اعتماد بوابة: لفريق القسم صاحب البوابة (أو الإدارة) فقط
create or replace function public.ops_gate(p_id bigint, p_key text, p_note text default '') returns void language plpgsql security definer set search_path = public as $$
declare i record; g jsonb; who text;
begin
  select * into i from public.ops_items where id = p_id;
  if i.id is null then raise exception 'العمل غير موجود'; end if;
  select x into g from jsonb_array_elements(coalesce((select gates from public.ops_kinds where code = i.kind), '[]')) x where x->>'k' = p_key;
  if g is null then raise exception 'بوابة غير معروفة'; end if;
  if not public.ops_staff(g->>'unit') then raise exception 'الاعتماد لفريق % أو الإدارة', coalesce((select short from public.gov_units where code = g->>'unit'), g->>'unit'); end if;
  select full_name into who from public.profiles where id = auth.uid();
  perform set_config('ops.gate', '1', true);
  update public.ops_items set data = jsonb_set(coalesce(data, '{}'), '{gates}', coalesce(data->'gates', '{}') || jsonb_build_object(p_key, jsonb_build_object('by', auth.uid(), 'name', who, 'at', now(), 'note', coalesce(p_note, ''))))
    where id = p_id;
  perform set_config('ops.gate', '', true);
  insert into public.ops_log(item_id, kind, body, by_user) values (p_id, 'handoff', '✓ ' || (g->>'l') || ' — ' || coalesce(who, '') || case when coalesce(p_note, '') <> '' then ': ' || p_note else '' end, auth.uid());
  perform public.notify(public.unit_members(i.unit) || array[i.assignee_id, i.created_by], 'ops', 'اعتُمد: ' || (g->>'l'), i.title || ' · ' || i.ref, '#/ops/list?id=' || i.id);
end $$;
grant execute on function public.ops_gate(bigint, text, text) to authenticated;

-- ---------- 3) أنواع الأعمال الحرجة (نماذج لفرق الأقسام؛ لا تظهر في كتالوج المُبلّغين)
insert into public.ops_kinds(code, unit, name, short, icon, descr, proc, intake, prio, fields, sort) values
 ('closure', 'FAC', 'إغلاق موقع للصيانة وإعادة فتحه', 'إغلاق', '🚧', 'إغلاق غرفة أو عيادة أو منطقة بإشعار وبديل تشغيلي، وإعادة فتحها بمحضر (F-01، R-11، R-12)', 'F-01', false, 'p4',
  '[{"k":"reason","l":"سبب الإغلاق","t":"select","o":["صيانة تصحيحية","صيانة مخططة","مشروع تأهيل","مكافحة عدوى","سلامة","أخرى"],"req":true},{"k":"from","l":"بداية الإغلاق","t":"datetime-local","req":true},{"k":"to","l":"إعادة الفتح المتوقعة","t":"datetime-local","req":true},{"k":"alt","l":"البديل التشغيلي (أين تُقدَّم الخدمة أثناء الإغلاق)","t":"textarea","req":true},{"k":"icra","l":"تقييم مكافحة العدوى (ICRA)","t":"select","o":["لا يلزم","الفئة I","الفئة II","الفئة III","الفئة IV"]},{"k":"level","l":"مستوى الاعتماد (R-12)","t":"select","o":["المرافق مع مدير المنشأة (حتى يومين)","مدير الإدارة (3–14 يوماً أو منطقة حرجة)","الإدارة التنفيذية (أكثر من 14 يوماً أو قسم كامل)"],"req":true}]', 110),
 ('permit', 'MNT', 'تصريح عمل', 'تصريح', '📝', 'أعمال عالية الخطورة: ساخنة، عزل كهربائي، أماكن محصورة، ارتفاعات، فتح أسقف في مناطق المرضى (M-01، R-13)', 'M-01', false, 'p3',
  '[{"k":"wtype","l":"نوع العمل","t":"select","o":["أعمال ساخنة (لحام أو قطع)","عزل كهربائي (LOTO)","أماكن محصورة","عمل على ارتفاع","فتح أسقف في منطقة مرضى (ICRA)","أعمال على السطح أو الواجهات","أخرى"],"req":true},{"k":"contractor","l":"المنفّذ (المقاول أو الفريق)","t":"text","req":true},{"k":"from","l":"من","t":"datetime-local","req":true},{"k":"to","l":"إلى","t":"datetime-local","req":true},{"k":"workers","l":"عدد العاملين","t":"number"},{"k":"isolation","l":"نقاط العزل والإجراءات الوقائية","t":"textarea","req":true}]', 120),
 ('impair', 'SAF', 'تعطيل نظام حريق', 'تعطيل حريق', '🔥', 'تعطيل كلي أو جزئي لنظام إنذار أو إطفاء، مع الإجراءات البديلة (ILSM) حتى إعادته (H-01، R-14)', 'H-01', false, 'p2',
  '[{"k":"system","l":"النظام","t":"select","o":["الإنذار من الحريق","الرشاشات","مضخات الإطفاء","صناديق الحريق","أنظمة الإطفاء الخاصة"],"req":true},{"k":"area","l":"المنطقة المتأثرة","t":"text","req":true},{"k":"from","l":"بداية التعطيل","t":"datetime-local","req":true},{"k":"to","l":"الإعادة المتوقعة","t":"datetime-local","req":true},{"k":"why","l":"السبب","t":"select","o":["صيانة مخططة","عطل","أعمال مشروع"],"req":true},{"k":"ilsm","l":"الإجراءات البديلة (مراقبة حريق، طفايات إضافية، إبلاغ…)","t":"textarea","req":true}]', 130),
 ('shutdown', 'MNT', 'إيقاف مخطط لمرفق حيوي', 'إيقاف مخطط', '⏻', 'إيقاف الكهرباء أو المياه أو التكييف أو الغازات الطبية لمنطقة، بإشعار مسبق 72 ساعة (7 أيام للمناطق الحرجة) (M-02، R-15)', 'M-02', false, 'p4',
  '[{"k":"utility","l":"المرفق","t":"select","o":["الكهرباء","المياه","التكييف","الغازات الطبية","البخار","الشبكة والاتصالات"],"req":true},{"k":"areas","l":"المناطق المتأثرة","t":"textarea","req":true},{"k":"from","l":"بداية الإيقاف","t":"datetime-local","req":true},{"k":"to","l":"نهاية الإيقاف","t":"datetime-local","req":true},{"k":"backup","l":"البديل أثناء الإيقاف","t":"textarea"}]', 140)
on conflict (code) do nothing;
-- البوابات والقوائم والأثر (تُحدَّث في كل نشر ما لم تُعدَّل من الموقع)
update public.ops_kinds set effect = 'closure',
  gates = '[{"k":"approve","unit":"FAC","l":"اعتماد الإغلاق حسب مستوى الصلاحية (R-12)","before":"in_progress"},{"k":"saf","unit":"SAF","l":"تقييم الأمن والسلامة قبل الإغلاق","before":"in_progress"}]',
  checklist = '[{"k":"work","l":"اكتملت الأعمال وسُلّم الموقع بقائمة فحص"},{"k":"clean","l":"التنظيف النهائي"},{"k":"ic","l":"إجازة مكافحة العدوى بالمنشأة"},{"k":"safety","l":"جولة السلامة: المخارج والإطفاء والكهرباء"},{"k":"equip","l":"إعادة الأجهزة والتقنية والأثاث وتشغيلها"},{"k":"handover","l":"محضر إعادة الفتح موقّع من المنشأة"}]'
  where code = 'closure' and gates = '[]'::jsonb;
update public.ops_kinds set effect = 'permit',
  gates = '[{"k":"saf","unit":"SAF","l":"اعتماد الأمن والسلامة للتصريح","before":"in_progress"}]',
  checklist = '[{"k":"restore","l":"إزالة العزل وإعادة الأنظمة للخدمة"},{"k":"site","l":"تنظيف الموقع وتسليمه"},{"k":"watch","l":"مراقبة ما بعد الأعمال الساخنة 60 دقيقة (إن وُجدت)"}]'
  where code = 'permit' and gates = '[]'::jsonb;
update public.ops_kinds set effect = 'impair',
  gates = '[{"k":"saf","unit":"SAF","l":"اعتماد الإجراءات البديلة (ILSM)","before":"in_progress"}]',
  checklist = '[{"k":"test","l":"اختبار النظام بعد الإعادة وتوثيقه"},{"k":"notify","l":"إبلاغ المنشأة (والدفاع المدني إن لزم) بإعادة النظام"}]'
  where code = 'impair' and gates = '[]'::jsonb;
update public.ops_kinds set effect = 'shutdown',
  gates = '[{"k":"fac","unit":"FAC","l":"تنسيق المرافق مع المنشأة وإشعارها","before":"in_progress"}]',
  checklist = '[{"k":"restore","l":"إعادة التشغيل والتحقق من سلامة المرفق"},{"k":"notify","l":"إبلاغ المنشأة بانتهاء الإيقاف"}]'
  where code = 'shutdown' and gates = '[]'::jsonb;
