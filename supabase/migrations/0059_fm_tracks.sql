-- 0059: «المتابعة» — مسارات متابعة متعددة لكل منشأة بنفس الترتيب: الأنظمة الحرجة (القائمة)، ملاحظات سباهي، الزائر السري،
-- الأجهزة الطبية، الأثاث والإكسسوارات، اللوحات والواجهات، التجديد والتطوير. كل مسار له بنوده (fm_systems.track) ومجموعاته وسلّم حالاته.
create table if not exists public.fm_tracks (
  code text primary key, name text not null, short text not null default '', icon text not null default 'pulse', color text not null default '1B6CA8',
  scale text not null default 'sys' check (scale in ('sys','cmp','cond','renew')), owner text references public.gov_units(code), proc text not null default '',
  intro text not null default '', groups jsonb not null default '[]'::jsonb, sort int not null default 0, active boolean not null default true);
alter table public.fm_tracks enable row level security;
drop policy if exists p_read on public.fm_tracks; create policy p_read on public.fm_tracks for select using (public.can_fm());
drop policy if exists p_admin on public.fm_tracks; create policy p_admin on public.fm_tracks for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.fm_tracks to authenticated;

alter table public.fm_systems add column if not exists track text not null default 'SYS';
alter table public.fm_systems drop constraint if exists fm_systems_grp_check;
create index if not exists fm_systems_track on public.fm_systems(track, sort);

alter table public.fm_rounds add column if not exists track text not null default 'SYS';
alter table public.fm_rounds drop constraint if exists fm_rounds_facility_id_period_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fm_rounds_fac_period_track_key') then
    alter table public.fm_rounds add constraint fm_rounds_fac_period_track_key unique (facility_id, period, track);
  end if;
end $$;

alter table public.fm_obs add column if not exists track text not null default 'SYS';
alter table public.fm_obs add column if not exists ref_no text not null default '';
alter table public.fm_obs add column if not exists visit_date date;
alter table public.fm_obs drop constraint if exists fm_obs_source_check;
alter table public.fm_obs add constraint fm_obs_source_check check (source in ('round','manual','import','visit','bulk'));
create index if not exists fm_obs_track on public.fm_obs(track);
-- مسار الملاحظة من بندها تلقائياً
create or replace function public.fm_obs_track() returns trigger language plpgsql as $f$
begin
  if new.system_code is not null then select coalesce(track, new.track) into new.track from public.fm_systems where code = new.system_code; end if;
  return new;
end $f$;
drop trigger if exists fm_obs_track on public.fm_obs;
create trigger fm_obs_track before insert or update of system_code on public.fm_obs for each row execute function public.fm_obs_track();
update public.fm_obs o set track = s.track from public.fm_systems s where s.code = o.system_code and o.track is distinct from s.track;

-- الإدخال المجمّع (لصق ملاحظات تقرير) لا يرسل إشعاراً لكل سطر
create or replace function public.fm_obs_aiu() returns trigger language plpgsql security definer set search_path = public as $f$
declare st jsonb := '{"open":"مفتوحة","in_progress":"قيد المعالجة","verify":"بانتظار التحقق","closed":"مغلقة"}'; fac text; lnk text; parts text[] := '{}';
begin
  select name into fac from public.facilities where id = new.facility_id;
  lnk := '#/fm/obs?id=' || new.id;
  if tg_op = 'INSERT' then
    if new.source in ('import','bulk') then return new; end if;
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
end
$f$;
create or replace function public.fm_fac_notify() returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if new.source in ('import','bulk') then return new; end if;
  perform public.notify(public.fac_managers(new.facility_id), 'fm', 'ملاحظة متابعة على منشأتك: ' || new.title, '', '#/fm/obs?id=' || new.id);
  return new;
end $f$;

do $$ begin
  if not exists (select 1 from public.seed_marks where key = 'fm_tracks_v1') then
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('SYS','الأنظمة الحرجة','الأنظمة','pulse','1B6CA8','sys','MNT','G-05','حالة الأنظمة الهندسية والحرجة في كل منشأة شهراً بشهر.','[{"k": "system", "l": "الأنظمة الهندسية"}, {"k": "low", "l": "التيار الخفيف"}, {"k": "fire", "l": "السلامة من الحريق"}, {"k": "area", "l": "المناطق الحرجة"}, {"k": "compliance", "l": "الامتثال"}]'::jsonb,10) on conflict (code) do nothing;
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('CBAHI','ملاحظات سباهي','سباهي','shieldok','2E8B57','cmp','SAF','F-04','ملاحظات زيارات سباهي والتقييم الذاتي على البيئة والمرافق، مجمّعة بالمحاور، وكل ملاحظة لها مسؤول وإجراء وموعد حتى إغلاقها.','[{"k": "fms", "l": "إدارة المرافق والسلامة"}, {"k": "ipc", "l": "مكافحة العدوى في البيئة"}, {"k": "doc", "l": "التوثيق والتدريب"}]'::jsonb,20) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-SAF','السلامة العامة وبيئة الرعاية','fms','SAF','F-02','الجولات، المخاطر، الحوادث',false,1200,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-SEC','الأمن وضبط الدخول','fms','SAF','H-05','المناطق الحساسة والبطاقات',false,1201,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-HAZ','المواد والنفايات الخطرة','fms','SAF','H-04','الجرد وبطاقات السلامة والتخزين',false,1202,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-FIRE','السلامة من الحريق','fms','SAF','H-01','الأنظمة والمخارج والتمارين',false,1203,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-MED','المعدات الطبية','fms','BME','B-02','السجل والصيانة والمعايرة',false,1204,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-UTL','أنظمة المرافق','fms','MNT','G-06','الصيانة الوقائية والاختبارات وخرائط الإغلاق',false,1205,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-EMR','إدارة الطوارئ','fms','SAF','H-02','الخطط والتمارين وتحليل قابلية التأثر',false,1206,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-ENV','نظافة البيئة والأسطح','ipc','GEN','S-01','النظافة والتطهير والأدوات',false,1207,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-WST','النفايات الطبية','ipc','GEN','S-02','الفرز والنقل والتخزين',false,1208,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-CON','العدوى أثناء الإنشاء والتجديد','ipc','PRJ','G-10','تقييم ICRA والحواجز',false,1209,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('CB-DOC','الخطط والسجلات والتدريب','doc','FAC','F-04','الخطط السبع، المحاضر، تدريب العاملين',false,1210,true,'CBAHI','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('MYST','ملاحظات الزائر السري','الزائر السري','user','6E59A5','cmp','FAC','G-01','ملاحظات الزائر السري على تجربة المراجع في كل منشأة، من المواقف حتى العيادة، تُحال للقسم المختص وتُغلق بالمعالجة.','[{"k": "out", "l": "الوصول والخارج"}, {"k": "in", "l": "داخل المنشأة"}, {"k": "svc", "l": "تجربة الخدمة"}]'::jsonb,30) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-PARK','المواقف والوصول','out','GEN','S-05','المواقف، مواقف ذوي الإعاقة، الممرات الخارجية',false,1300,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-SIGN','الإرشاد واللوحات','out','FAC','G-05','وضوح الوصول للمدخل والأقسام',false,1301,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-ENT','المدخل والاستقبال','in','FAC','G-01','المدخل، الاستقبال، الإرشاد الداخلي',false,1302,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-WAIT','الانتظار','in','GEN','S-05','المقاعد، الراحة، الشاشات، الماء',false,1303,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-WC','دورات المياه','in','GEN','S-01','النظافة، المستهلكات، الأعطال',false,1304,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-CLEAN','النظافة العامة','in','GEN','S-01','الممرات والأرضيات والنفايات',false,1305,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-ENV','الراحة الحرارية والإضاءة','in','MNT','G-05','التكييف والإنارة والروائح',false,1306,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-ACC','الوصول الشامل','in','FAC','G-02','المنحدرات، الأبواب، دورات المياه المهيأة',false,1307,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-CLIN','العيادات وغرف الكشف','svc','FAC','G-05','التجهيز والخصوصية والنظافة',false,1308,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MS-STAFF','التعامل والتوجيه','svc','FAC','G-01','ملاحظات تخص التعامل تُحال لإدارة المنشأة',false,1309,true,'MYST','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('MED','الأجهزة الطبية','الأجهزة الطبية','steth','A6503B','sys','BME','G-08','جاهزية الأجهزة الطبية في كل منشأة حسب الفئة، وأي جهاز معطل له ملاحظة وأمر عمل للصيانة الطبية.','[{"k": "crit", "l": "أجهزة حرجة"}, {"k": "clin", "l": "أجهزة العيادات"}, {"k": "diag", "l": "التشخيص والمختبر"}, {"k": "sup", "l": "الدعم والتعقيم"}]'::jsonb,40) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-RESUS','أجهزة الإنعاش والصدمات الكهربائية','crit','BME','G-08','جاهزية يومية، البطارية والأقطاب',false,1400,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-MON','أجهزة مراقبة العلامات الحيوية','crit','BME','G-08','',false,1401,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-SUCT','أجهزة الشفط والأكسجين المحمول','crit','BME','G-08','',false,1402,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-CLIN','أجهزة العيادات (ضغط، ميزان، منظار)','clin','BME','G-08','',false,1403,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-DENT','كراسي ووحدات الأسنان','clin','BME','G-08','',false,1404,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-ECG','تخطيط القلب','diag','BME','G-08','',false,1405,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-XRAY','الأشعة والموجات فوق الصوتية','diag','BME','G-08','',false,1406,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-LAB','أجهزة المختبر','diag','BME','G-08','',false,1407,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-STER','أجهزة التعقيم','sup','BME','G-08','',false,1408,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('MD-FRIDGE','ثلاجات الأدوية واللقاحات','sup','BME','G-08','تسجيل الحرارة والإنذار',false,1409,true,'MED','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('FURN','الأثاث والإكسسوارات','الأثاث','box','C8962E','cond','GEN','S-04','حالة الأثاث والإكسسوارات في كل منشأة، وما يحتاج صيانة أو تجديداً أو استبدالاً.','[{"k": "furn", "l": "الأثاث"}, {"k": "acc", "l": "الإكسسوارات والتجهيزات"}]'::jsonb,50) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('FN-WAIT','أثاث الانتظار','furn','GEN','S-04','المقاعد وطاولات الانتظار',false,1500,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('FN-CLIN','أثاث العيادات وغرف الكشف','furn','GEN','S-04','المكاتب والكراسي وأسرّة الكشف',false,1501,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('FN-OFF','أثاث المكاتب الإدارية','furn','GEN','S-04','',false,1502,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('FN-REC','كاونترات الاستقبال والتمريض','furn','GEN','S-04','',false,1503,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('AC-DISP','موزعات الصابون والمعقم والمناديل','acc','GEN','S-05','',false,1504,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('AC-BIN','سلال النفايات بألوانها','acc','GEN','S-02','',false,1505,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('AC-CURT','ستائر الفصل','acc','GEN','S-05','مضادة للبكتيريا وجدول الاستبدال',false,1506,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('AC-SCREEN','شاشات النداء والانتظار','acc','IT','T-01','',false,1507,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('AC-CLOCK','الساعات واللوحات الداخلية','acc','GEN','S-05','',false,1508,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('AC-WC','إكسسوارات دورات المياه (مرايا، حمالات، مقابض دعم)','acc','GEN','S-05','',false,1509,true,'FURN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('SIGN','اللوحات والواجهات','اللوحات','flag','0E7C86','cond','FAC','G-05','لوحات الهوية والواجهات لكل مبنى: الحالة والإضاءة والمطابقة للهوية الموحدة.','[{"k": "id", "l": "لوحات الهوية"}, {"k": "way", "l": "الإرشاد الخارجي"}, {"k": "fac", "l": "الواجهة"}]'::jsonb,60) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-MAIN','اللوحة الرئيسية للواجهة','id','FAC','G-05','المطابقة للهوية الموحدة والتثبيت',false,1600,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-LIGHT','الحروف المضيئة والإضاءة الليلية','id','MNT','G-05','كل الحروف تعمل ليلاً',false,1601,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-ENT','لوحات المداخل والأقسام الخارجية','id','FAC','G-05','',false,1602,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-ROAD','لوحات الطرق والإرشاد الخارجي','way','FAC','G-05','',false,1603,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-PARK','لوحات المواقف وذوي الإعاقة','way','FAC','G-05','',false,1604,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-FAC','الواجهة والتشطيب الخارجي','fac','FAC','G-02','الدهان والتكسيات والنظافة',false,1605,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('SG-LAND','الساحة والتشجير','fac','GEN','S-05','',false,1606,true,'SIGN','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_tracks(code,name,short,icon,color,scale,owner,proc,intro,groups,sort) values ('RENEW','التجديد والتطوير','التجديد','sparkle','123B5C','renew','PRJ','G-02','متابعة تجديد العناصر في كل منشأة على المعيار والهوية الموحدة: ما جُدّد، وما قيد التنفيذ، وما مخطط، وما لم يبدأ.','[{"k": "int", "l": "الداخلي"}, {"k": "mep", "l": "الأنظمة والإنارة"}, {"k": "id", "l": "الهوية"}]'::jsonb,70) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-CNTR','تجديد الكاونترات','int','PRJ','G-02','الاستقبال والتمريض على النموذج المعتمد',false,1700,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-FLOOR','أرضيات الفينيل','int','PRJ','G-02','',false,1701,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-WC','دورات المياه','int','PRJ','G-02','',false,1702,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-WALL','الدهانات وحماية الجدران','int','PRJ','G-02','',false,1703,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-CEIL','الأسقف','int','PRJ','G-02','',false,1704,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-DOOR','الأبواب','int','PRJ','G-02','',false,1705,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-CLIN','العيادات على النموذج المعتمد','int','PRJ','G-02','',false,1706,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-LIGHT','الإنارة','mep','PRJ','G-02','',false,1707,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-HVAC','وحدات التكييف','mep','MNT','G-02','',false,1708,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-SIGN','اللوحات الموحدة','id','PRJ','G-02','',false,1709,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.fm_systems(code,name,grp,owner,proc,hint,critical,sort,active,track,partners) values ('RN-WAY','الإرشاد الداخلي وترميز الغرف','id','PRJ','G-02','',false,1710,true,'RENEW','[]'::jsonb) on conflict (code) do nothing;
    insert into public.seed_marks(key) values ('fm_tracks_v1');
  end if;
end $$;
