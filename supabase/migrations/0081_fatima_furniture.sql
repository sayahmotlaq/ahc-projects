-- 0081: (بطلب رئيس قسم المشاريع 27 أكتوبر) إدراج الأثاث غير الطبي LS-93 في جدول «مقطوعية — مركز فاطمة العفالق» وتصحيح الملاحظة العامة.
do $do$ declare b uuid; begin
  select id into b from public.boqs where name = 'مقطوعية — مركز فاطمة العفالق' order by created_at limit 1;
  if b is null or exists (select 1 from public.boq_lines where boq_id = b and ls_code = 'LS-93') then return; end if;
  insert into public.boq_lines (boq_id, qty, loc, sort, kind, title, descr, unit, div_code, ls_code, refs)
    select b, 1, $t$الأثاث غير الطبي لكامل المركز حسب المخططات وجداول الأثاث (SOW 12.1 — مستبعد في نطاق العمل وأُدرج في الجدول بقرار رئيس قسم المشاريع)، ويشمل أثاث غرفة الاجتماعات ومركز التدريب والمصلى والمقهى حيث وردت في المخططات.$t$, 645, 'free', title, descr, coalesce(nullif(unit, ''), 'مقطوعية'), div_code, code, refs from public.ls_items where code = 'LS-93';
  update public.boqs set notes = replace(notes, 'التجهيزات الطبية، والمعدات الكهربائية، والأثاث غير الطبي.', 'التجهيزات الطبية، والمعدات الكهربائية. أما الأثاث غير الطبي فمشمول في هذا الجدول بخلاف نطاق العمل.'), updated_at = now() where id = b;
end $do$;
