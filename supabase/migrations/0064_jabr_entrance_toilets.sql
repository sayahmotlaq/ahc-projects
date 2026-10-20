-- 0064: بطلب رئيس قسم المشاريع — مشروع مدخل الجبر يشمل إنشاء دورات مياه جديدة وتأهيل بعضها؛ تُضاف بنود دورات المياه
-- (التشطيبات الرطبة والعزل المائي، الفواصل والإكسسوارات، الأطقم الصحية والخلاطات والتمديدات، الشفاطات، إنارة المناطق الرطبة) بكل خياراتها،
-- ويُعاد خيار دهان الأسقف المضاد للعفن للحمامات. مرة واحدة (seed_marks).
do $$ declare ss uuid; add text[] := array['07 16 13','08 16 19','09 25 13','09 28 13','09 28 16','09 30 13','09 34 13','10 21 13','10 21 14','10 28 13','10 28 14','10 28 15','10 28 16','10 28 17','10 28 18','10 28 21','10 28 22','10 28 23','10 28 24','10 28 29','22 11 16','22 13 16','22 13 19','22 42 13','22 42 16','22 42 39','22 42 43','23 34 23','26 51 29']; begin
  if exists (select 1 from public.seed_marks where key = 'study_jabr_toilets') then return; end if;
  select s.id into ss from public.spec_sets s join public.studies st on st.id = s.study_id
    where st.title like 'تطوير المدخل الرئيسي — مستشفى الجبر%' order by s.created_at limit 1;
  if ss is not null then
    insert into public.spec_lines (set_id, item_code, variants, submit, note, sort)
      select ss, i.code, coalesce((select array_agg(v.code order by v.code) from public.variants v where v.item_code = i.code and coalesce(v.active, true)
          and v.ar !~ '(للانفجار|المختبر|الكيماويات|العمليات|رصاص|الرنين|High Bay|المستودعات)'), '{}'),
        '{sample,data}', 'دورات المياه (إنشاء جديد وتأهيل)', 2000 + row_number() over (order by i.code)
      from public.items i where i.code = any(add)
      on conflict (set_id, item_code) do nothing;
    update public.spec_lines set variants = (select array_agg(distinct x order by x) from unnest(variants || array['09 91 23-08']) x)
      where set_id = ss and item_code = '09 91 23' and exists (select 1 from public.variants where code = '09 91 23-08');
    update public.spec_sets set notes = 'نطاق المشروع: تطوير داخلي وتشطيبات للمدخل الرئيسي والردهات والاستقبال، وإنشاء دورات مياه جديدة وتأهيل بعضها. لا تُورَّد أي مادة قبل اعتمادها كتابياً. المواصفات الفنية التفصيلية لكل بند من المرجع الفني الموحد جزء لا يتجزأ من هذا الجدول.' where id = ss;
  end if;
  insert into public.seed_marks (key) values ('study_jabr_toilets');
end $$;
