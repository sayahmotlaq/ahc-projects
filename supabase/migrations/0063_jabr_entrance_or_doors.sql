-- 0063: استثناء بطلب رئيس قسم المشاريع — إضافة أبواب العمليات المحكمة (08 34 33) إلى جدول مواد دراسة مدخل الجبر، بكل خياراتها عدا المبطن بالرصاص.
do $$ declare ss uuid; begin
  if exists (select 1 from public.seed_marks where key = 'study_jabr_or_doors') then return; end if;
  select s.id into ss from public.spec_sets s join public.studies st on st.id = s.study_id
    where st.title like 'تطوير المدخل الرئيسي — مستشفى الجبر%' order by s.created_at limit 1;
  if ss is not null and exists (select 1 from public.items where code = '08 34 33') then
    insert into public.spec_lines (set_id, item_code, variants, submit, note, sort)
      values (ss, '08 34 33', coalesce((select array_agg(code order by code) from public.variants where item_code = '08 34 33' and coalesce(active, true) and ar not like '%رصاص%'), '{}'),
        '{sample,data,mockup}', 'استثناء ضمن هذا المشروع بطلب رئيس قسم المشاريع', 999)
      on conflict (set_id, item_code) do nothing;
  end if;
  insert into public.seed_marks (key) values ('study_jabr_or_doors');
end $$;
