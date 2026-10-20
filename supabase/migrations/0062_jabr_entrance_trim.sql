-- 0062: تنقيح جدول المواد في دراسة «تطوير المدخل الرئيسي — مستشفى الجبر» حسب طبيعة المشروع (تطوير داخلي لمدخل وردهات واستقبال)
-- يحذف البنود غير اللازمة (أبواب الجراج والإشعاع والعمليات والرنين، المصاعد الجديدة، الأرضيات الخاصة…) ويستبعد الخيارات غير الملائمة.
-- مرة واحدة (seed_marks)؛ لا يمس ما عدّله المستخدم بعد ذلك.
do $$ declare ss uuid; keep text[] := array['08 11 16','08 12 16','08 14 19','08 14 23','08 31 16','08 41 13','08 41 26','08 42 13','08 42 26','08 42 29','08 56 19','08 71 13','08 71 16','08 71 19','08 71 21','08 71 23','08 71 26','08 71 29','08 71 33','08 71 39','08 74 13','08 81 13','08 81 16','08 87 13','08 87 26','09 05 61','09 21 16','09 21 33','09 21 36','09 22 26','09 23 16','09 29 10','09 29 13','09 29 16','09 29 19','09 29 29','09 29 33','09 30 19','09 30 23','09 30 33','09 30 36','09 30 43','09 51 13','09 51 33','09 53 23','09 53 26','09 54 23','09 54 26','09 54 33','09 54 36','09 54 43','09 65 13','09 65 16','09 65 19','09 66 16','09 66 23','09 75 13','09 77 33','09 77 43','09 77 53','09 78 13','09 78 16','09 78 23','09 91 23','09 94 13','09 96 66','10 14 16','10 14 23','10 14 29','10 14 33','10 14 36','10 14 46','10 14 56','10 14 63','10 14 66','10 14 73','10 26 13','10 26 16','10 26 19','10 26 23','10 26 33','10 26 46','10 28 21','10 28 26','12 35 71','12 36 40','12 36 61','12 36 63','12 48 13','12 48 16','14 27 13','14 27 16','14 27 19','14 27 23','14 28 16','14 28 23','26 51 16','26 51 19','26 51 23','26 51 33','26 52 13','26 52 16']; begin
  if exists (select 1 from public.seed_marks where key = 'study_jabr_entrance_trim') then return; end if;
  select s.id into ss from public.spec_sets s join public.studies st on st.id = s.study_id
    where st.title like 'تطوير المدخل الرئيسي — مستشفى الجبر%' order by s.created_at limit 1;
  if ss is not null then
    delete from public.spec_lines where set_id = ss and not (item_code = any(keep));
    insert into public.spec_lines (set_id, item_code, variants, submit, sort)
      select ss, c, '{}', '{sample,data}', 0 from unnest(keep) c where exists (select 1 from public.items i where i.code = c) on conflict do nothing;
    update public.spec_lines l set variants = coalesce((select array_agg(v.code order by v.code) from public.variants v
        where v.item_code = l.item_code and coalesce(v.active, true)
          and v.ar !~ '(غرف المعدات|الكهرباء|للانفجار|المختبر|الكيماويات|المطابخ|المغاسل|العمليات|رصاص|الرنين|الغازات)'), '{}')
      where l.set_id = ss;
    update public.spec_lines l set sort = o.n from (select id, row_number() over (order by item_code) n from public.spec_lines where set_id = ss) o where o.id = l.id;
    update public.spec_sets set notes = 'نطاق المشروع: تطوير داخلي وتشطيبات للمدخل الرئيسي والردهات والاستقبال. لا تُورَّد أي مادة قبل اعتمادها كتابياً. المواصفات الفنية التفصيلية لكل بند من المرجع الفني الموحد جزء لا يتجزأ من هذا الجدول.' where id = ss;
  end if;
  insert into public.seed_marks (key) values ('study_jabr_entrance_trim');
end $$;
