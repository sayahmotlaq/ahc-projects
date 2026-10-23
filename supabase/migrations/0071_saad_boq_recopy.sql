-- 0071: (بطلب رئيس قسم المشاريع) نسخة جديدة من جدول كميات النعيم المحدّث إلى مشروع «سعد الحسين» مرة واحدة،
-- والنسخة السابقة هناك تُعلَّم «نسخة قديمة — للحذف» ولا تُحذف آلياً (يحذفها المستخدم من صفحة المشروع بعد المراجعة).
do $$ declare src record; dst uuid; nb uuid; begin
  if exists (select 1 from public.seed_marks where key = 'saad_boq_recopy_v1') then return; end if;
  select bq.* into src from public.boqs bq join public.projects p on p.id = bq.project_id
    where p.name like '%النعيم%' and bq.name = 'مقطوعية — نموذج المسار الرابع' order by bq.created_at limit 1;
  select id into dst from public.projects where name like '%سعد الحسين%' order by created_at limit 1;
  if src.id is null or dst is null then return; end if;
  update public.boqs set name = name || ' (نسخة قديمة — للحذف)', updated_at = now()
    where project_id = dst and name = src.name;
  insert into public.boqs (project_id, name, status, contingency, vat, factor, notes, created_by, pricing, hide_prices, study_id, handover)
    values (dst, src.name, 'draft', src.contingency, src.vat, src.factor, src.notes, src.created_by, src.pricing, src.hide_prices, null, src.handover)
    returning id into nb;
  insert into public.boq_lines (boq_id, variant_code, qty, loc, unit_price, sort, kind, title, descr, unit, div_code, ls_code, refs)
    select nb, variant_code, qty, loc, unit_price, sort, kind, title, descr, unit, div_code, ls_code, refs from public.boq_lines where boq_id = src.id order by id;
  insert into public.seed_marks (key) values ('saad_boq_recopy_v1');
end $$;
