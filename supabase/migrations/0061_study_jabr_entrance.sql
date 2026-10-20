-- 0061: دراسة «تطوير المدخل الرئيسي — مستشفى الجبر للعيون والأنف والأذن والحنجرة» بطلب رئيس قسم المشاريع
-- تُنشأ مرة واحدة (seed_marks)؛ إن حُذفت من المنصة لا تُعاد. تضم: جدول مواد ومواصفات (كل بنود التشطيبات والأبواب والمصاعد والإنارة واللوحات وحصائر المداخل)
-- وجدول كميات مقطوعية مسودة من نطاق «تطوير مدخل رئيسي».
do $$ declare st uuid; ss uuid; b uuid; f bigint; fname text; codes text[]; begin
  if exists (select 1 from public.seed_marks where key = 'study_jabr_entrance') then return; end if;
  select id, name into f, fname from public.facilities where name like '%الجبر للعيون%' order by id limit 1;
  insert into public.studies (title, facility, facility_id, kind, status, notes)
    values ('تطوير المدخل الرئيسي — مستشفى الجبر للعيون والأنف والأذن والحنجرة', coalesce(fname, 'مستشفى الجبر للعيون والأنف والأذن والحنجرة'), f, 'تطوير وتأهيل', 'draft',
      'دراسة تطوير المدخل الرئيسي: جدول المواد والمواصفات المعتمدة للمقاول (تُحذف البنود غير اللازمة وتُعبأ المصنّعون لاحقاً)، وجدول كميات مقطوعية مسودة من نطاق «تطوير مدخل رئيسي».')
    returning id into st;

  -- جدول المواد والمواصفات: كل البنود الفعالة في الأقسام المختارة بكل خياراتها
  insert into public.spec_sets (study_id, name, status, notes)
    values (st, 'جدول المواد والمواصفات المعتمدة — المدخل الرئيسي', 'draft',
      'لا تُورَّد أي مادة قبل اعتمادها كتابياً. المواصفات الفنية التفصيلية لكل بند من المرجع الفني الموحد جزء لا يتجزأ من هذا الجدول.')
    returning id into ss;
  insert into public.spec_lines (set_id, item_code, variants, submit, sort)
    select ss, i.code,
      coalesce((select array_agg(v.code order by v.code) from public.variants v where v.item_code = i.code and coalesce(v.active, true)), '{}'),
      '{sample,data}', (row_number() over (order by i.code))::int
    from public.items i
    where coalesce(i.active, true) and (
      (i.section_code like '08%' and left(i.section_code, 5) not in ('08 44', '08 62', '08 63', '08 91', '08 92', '08 95'))
      or i.section_code like '09%'
      or left(i.section_code, 5) in ('10 14', '10 21', '10 26', '10 28', '12 35', '12 36', '12 48', '14 21', '14 24', '14 26', '14 27', '14 28', '26 51', '26 52'))
    on conflict do nothing;

  -- جدول كميات مقطوعية مسودة من نطاق «تطوير مدخل رئيسي» + LS-40
  select t.codes into codes from public.ls_templates t where t.name = 'تطوير مدخل رئيسي' and coalesce(t.active, true) limit 1;
  if codes is not null then
    if not ('LS-40' = any(codes)) then codes := array_append(codes, 'LS-40'); end if;
    insert into public.boqs (study_id, name, status, pricing, hide_prices, contingency, vat, factor, notes)
      values (st, 'تقديري — مقطوعية', 'draft', 'lumpsum', true, 5, 15, 1, $q$1. الأسعار مقطوعية شاملة جميع أعمال التوريد والتنفيذ والمواد والعمالة والمعدات والنقل والاختبار والتشغيل والتسليم والضمان.
2. يُرجع إلى المخططات والمواصفات الفنية للتفاصيل، وتُعدّ زيارة الموقع والاطلاع على طبيعة الأعمال القائمة إلزامية قبل التسعير.
3. تشمل الأسعار حماية المناطق التشغيلية المجاورة والالتزام بمتطلبات مكافحة العدوى والسلامة والعمل خارج أوقات الذروة عند الطلب.
4. أي أعمال لازمة لإنجاز النطاق كاملاً جاهزاً للاستخدام تُعدّ مشمولة في المقطوعية ولو لم تُذكر صراحةً.
5. على المقاول إعداد الرسومات التنفيذية (Shop Drawings) لجميع الأعمال، وإعداد التصاميم التكميلية حيث لا تكفي المخططات المرفقة أو تخلو من التفاصيل (الكهرباء والإنارة، توزيع الأثاث، التكييف، التيار الخفيف وغيرها) بمهندسين مختصين وعلى حسابه، واعتمادها قبل التنفيذ، وتسليم مخططات كما نُفِّذ؛ وكل ذلك مشمول في السعر.
6. المواد وفق «جدول المواد والمواصفات المعتمدة — المدخل الرئيسي» المرفق بهذه الدراسة.$q$)
      returning id into b;
    insert into public.boq_lines (boq_id, kind, title, descr, unit, qty, div_code, sort)
      select b, 'free', i.title, i.descr, i.unit, 1, i.div_code, i.sort
      from public.ls_items i where i.code = any(codes) and coalesce(i.active, true);
  end if;

  insert into public.seed_marks (key) values ('study_jabr_entrance');
end $$;
