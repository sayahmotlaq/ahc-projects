-- 0045: تصحيح بيانات مشروع «توريد وتركيب مولد كهربائي احتياطي لمستشفى العيون» (بقرار المستخدم: كل المبالغ قبل الضريبة)
-- قيمة العقد 537,500 (كانت 618,125 شاملة الضريبة)، ونسبة حجز الضمان في مستخلصاته 10٪ (كانت 100٪ خطأً).
-- آمن لإعادة التشغيل: لا يمس إلا القيم الخاطئة نفسها، ولا يوقف النشر إن لم يجد المشروع.
do $$
declare pid uuid;
begin
  select id into pid from public.projects where name like '%مولد%' and name like '%العيون%' order by created_at limit 1;
  if pid is null then return; end if;
  update public.projects set contract_value = 537500 where id = pid and contract_value = 618125;
  if exists (select 1 from public.payments where project_id = pid and retention_pct = 100) then
    alter table public.payments disable trigger guard_payment_trg;
    update public.payments set retention_pct = 10 where project_id = pid and retention_pct = 100;
    alter table public.payments enable trigger guard_payment_trg;
  end if;
exception when others then
  begin alter table public.payments enable trigger guard_payment_trg; exception when others then null; end;
  raise notice 'تصحيح مشروع المولد لم يُطبَّق: %', sqlerrm;
end $$;

-- ---------- بيانات الإنجاز لكل نوع (تُطلب عند «أُنجز» أو «إغلاق»): سبب العطل، المنفّذ، القطع، التكلفة، تصنيف الحادث وسببه الجذري…
alter table public.ops_kinds add column if not exists close_fields jsonb default '[]';
update public.ops_kinds set close_fields = '[{"k":"cause","l":"سبب العطل","t":"select","o":["تآكل أو انتهاء العمر","سوء استخدام","عيب تركيب أو تصنيع","انقطاع مرفق","غير محدد"]},{"k":"by","l":"نُفّذ بواسطة","t":"select","o":["الفريق الذاتي","مقاول التشغيل والصيانة","الوكيل أو المورّد"],"req":true},{"k":"parts","l":"القطع المستخدمة","t":"text"},{"k":"cost","l":"التكلفة (ر.س قبل الضريبة)","t":"number"}]'
  where code = 'mnt' and close_fields = '[]'::jsonb;
update public.ops_kinds set close_fields = '[{"k":"cause","l":"سبب العطل","t":"select","o":["عطل فني","سوء استخدام","ملحقات أو مستهلكات","برمجيات أو ربط","غير محدد"]},{"k":"by","l":"نُفّذ بواسطة","t":"select","o":["الصيانة الطبية ذاتياً","الوكيل ضمن عقد الخدمة","الوكيل بأمر إصلاح"],"req":true},{"k":"parts","l":"القطع المستخدمة","t":"text"},{"k":"cost","l":"التكلفة (ر.س قبل الضريبة)","t":"number"}]'
  where code = 'bme' and close_fields = '[]'::jsonb;
update public.ops_kinds set close_fields = '[{"k":"res","l":"طريقة الحل","t":"select","o":["عن بُعد","زيارة ميدانية","استبدال جهاز أو قطعة","تصعيد للمورّد"],"req":true}]' where code = 'it' and close_fields = '[]'::jsonb;
update public.ops_kinds set close_fields = '[{"k":"class","l":"تصنيف الحدث","t":"select","o":["وشيك بلا ضرر","بسيط","متوسط","جسيم"],"req":true},{"k":"root","l":"السبب الجذري","t":"textarea","req":true},{"k":"prevent","l":"الإجراء الوقائي لمنع التكرار","t":"textarea"}]' where code = 'saf' and close_fields = '[]'::jsonb;
update public.ops_kinds set close_fields = '[{"k":"by","l":"نُفّذ بواسطة","t":"select","o":["الفريق الذاتي","المقاول"]}]' where code = 'gen' and close_fields = '[]'::jsonb;
update public.ops_kinds set close_fields = '[{"k":"result","l":"النتيجة","t":"select","o":["مطابق","مطابق بملاحظات","غير مطابق — يلزم إصلاح"],"req":true},{"k":"cost","l":"التكلفة (ر.س قبل الضريبة)","t":"number"}]' where code = 'ppm' and close_fields = '[]'::jsonb;
