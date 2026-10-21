-- 0066: بطلب رئيس قسم المشاريع على جدول «مقطوعية — نموذج المسار الرابع» لمركز النعيم:
-- (1) حذف بند LS-52 «الأقواس والعناصر المعمارية للواجهات» (الواجهات صارت ألمنيوم وزجاج بلا هذه الإضافة)
-- (2) إلزام اللياسة (LS-57) والدهانات (LS-61) بتشكيلات الواجهات والنقشات حسب المخططات. مرة واحدة.
do $$ declare b uuid; begin
  if exists (select 1 from public.seed_marks where key = 'naeem_facade_edits') then return; end if;
  select bq.id into b from public.boqs bq join public.projects p on p.id = bq.project_id
    where p.name like '%النعيم%' and bq.name = 'مقطوعية — نموذج المسار الرابع' order by bq.created_at limit 1;
  if b is not null then
    delete from public.boq_lines where boq_id = b and kind = 'free' and (ls_code = 'LS-52' or title = 'الأقواس والعناصر المعمارية للواجهات');
    update public.boq_lines set descr = descr || ' ويشمل البند تنفيذ لياسة الواجهات الخارجية بالتشكيلات والنقشات والبروزات والحليات والفواصل الزخرفية كما في المخططات والرسومات المعمارية للواجهات، مع عمل عينة (Mock-up) لكل نوع لاعتمادها قبل التعميم.'
      where boq_id = b and kind = 'free' and (ls_code = 'LS-57' or title = 'اللياسة') and descr not like '%النقشات%';
    update public.boq_lines set descr = descr || ' ويشمل البند دهان الواجهات الخارجية بالألوان والملمس والنقشات والتأثيرات الزخرفية المحددة في المخططات والرسومات المعمارية للواجهات، مع عمل عينة (Mock-up) لكل نوع لاعتمادها قبل التعميم.'
      where boq_id = b and kind = 'free' and (ls_code = 'LS-61' or title = 'الدهانات الداخلية والخارجية') and descr not like '%النقشات%';
    update public.boqs set updated_at = now() where id = b;
  end if;
  insert into public.seed_marks (key) values ('naeem_facade_edits');
end $$;
