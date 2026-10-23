-- 0072 (بطلب رئيس قسم المشاريع 23 أكتوبر):
-- (1) معيار الشاشات يُلحق ببند LS-85 في جدولي النعيم وسعد الحسين، ومراجع المواصفات تُكمَّل في الجدولين من القائمة.
-- (2) قائمة بنود المقطوعية تُحدَّث من جدول النعيم المعتمد (العنوان والنص والوحدة) — عدا أي بند يذكر «النعيم» نصاً (خاص بالمشروع)؛ والنتيجة في settings.ls_sync_log.
-- (3) معيار الشاشات في قاعدة حوكمة R-46 (المرافق) وفي أدلة: معايير التصميم، التشغيل والصيانة، مستخدمي المنشأة، المقاول.
do $$ declare nb uuid; sbq uuid; up text[]; sk text[];
  std text := 'ويلتزم المقاول بمعيار تجمع الأحساء الصحي للشاشات الرقمية AAHC-FM-STD-DIGITAL-SIGNAGE-001: شاشات عرض تجارية مصممة للتشغيل المتواصل (Samsung QMC أو ما يعادلها المعتمد، وQHC للمناطق عالية الإضاءة) بدقة 4K UHD كحد أدنى، ولا يُقبل التلفزيون المنزلي في المناطق العامة؛ وربط شاشات المناطق العامة بمنصة Navori بمشغّل مدمج أو خارجي؛ ومقبسان كهربائيان خلف كل شاشة (أحدهما على الطوارئ/UPS حيث أمكن) ونقطة شبكة سلكية RJ45؛ وإخفاء جميع الكابلات خلف الشاشة أو في مجارٍ معتمدة؛ والمقاسات وارتفاعات التركيب حسب جداول المعيار.';
begin
  if exists (select 1 from public.seed_marks where key = 'ls_sync_naeem_v1') then return; end if;
  select bq.id into nb from public.boqs bq join public.projects p on p.id = bq.project_id
    where p.name like '%النعيم%' and bq.name = 'مقطوعية — نموذج المسار الرابع' order by bq.created_at limit 1;
  select bq.id into sbq from public.boqs bq join public.projects p on p.id = bq.project_id
    where p.name like '%سعد الحسين%' and bq.name = 'مقطوعية — نموذج المسار الرابع' order by bq.created_at desc limit 1;
  if nb is null then return; end if;
  -- (1)
  update public.boq_lines set descr = descr || ' ' || std where boq_id in (nb, sbq) and ls_code = 'LS-85' and position('AAHC-FM-STD-DIGITAL-SIGNAGE-001' in coalesce(descr, '')) = 0;
  update public.boq_lines l set refs = i.refs from public.ls_items i
    where l.boq_id in (nb, sbq) and l.ls_code = i.code and coalesce(array_length(l.refs, 1), 0) = 0 and coalesce(array_length(i.refs, 1), 0) > 0;
  -- (2)
  select array_agg(l.ls_code order by l.ls_code) into sk from public.boq_lines l where l.boq_id = nb and l.ls_code is not null and position('النعيم' in coalesce(l.descr, '') || coalesce(l.title, '')) > 0;
  with s as (update public.ls_items i set title = l.title, descr = l.descr, unit = coalesce(nullif(l.unit, ''), i.unit), updated_at = now()
      from public.boq_lines l where l.boq_id = nb and l.ls_code = i.code and position('النعيم' in coalesce(l.descr, '') || coalesce(l.title, '')) = 0
        and (i.descr is distinct from l.descr or i.title is distinct from l.title) returning i.code)
    select array_agg(code order by code) into up from s;
  insert into public.settings(key, value, updated_at) values ('ls_sync_log', jsonb_build_object('at', now(), 'updated', coalesce(up, '{}'), 'skipped_project_specific', coalesce(sk, '{}')), now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  -- (3) الأدلة
  update public.manual_templates m set sections = (select jsonb_agg(case
      when e->>'key' = 'systems' and m.code = 'design' then jsonb_set(e, '{body}', to_jsonb((e->>'body') || E'\n- الشاشات الرقمية والتلفزيونات: وفق معيار التجمع AAHC-FM-STD-DIGITAL-SIGNAGE-001 — شاشات تجارية للتشغيل المتواصل (Samsung QMC القياسي، وQHC للإضاءة العالية، وQBC للمناطق الإدارية غير الحرجة) بدقة 4K، ولا تلفزيون منزلي في المناطق العامة؛ مقبسان كهربائيان خلف كل شاشة (أحدهما على الطوارئ/UPS حيث أمكن) ونقطة شبكة سلكية، وكابلات مخفية؛ وربط شاشات المناطق العامة بمنصة Navori؛ والمقاسات وارتفاعات منتصف الشاشة حسب جداول المعيار (مثلاً: الانتظار الصغيرة 43–55 بوصة على 1.5–1.7 م، والردهة الرئيسية 65–75 بوصة على 1.7–2.0 م). المعيار في المكتبة الفنية (R-46).'))
      when e->>'key' = 'checklist' and m.code = 'design' then jsonb_set(e, '{body}', to_jsonb((e->>'body') || E'\n| مواقع الشاشات ومقاساتها وارتفاعاتها ونقاط الكهرباء والشبكة على معيار التجمع (R-46) | |'))
      when e->>'key' = 'docs' and m.code = 'om' then jsonb_set(e, '{body}', to_jsonb((e->>'body') || E'\n- جدول مواقع الشاشات الرقمية (الموقع، الموديل، المقاس، الارتفاع) وربطها بمنصة Navori — اشتراط التسليم HO-26 ومعيار التجمع للشاشات (R-46). أي شاشة جديدة أو مستبدلة تُركَّب على المعيار نفسه.'))
      when e->>'key' = 'approve' and m.code = 'user' then jsonb_set(e, '{body}', to_jsonb((e->>'body') || E'\n- تركيب شاشة أو تلفزيون أو نقله: يُطلب عبر المنصة ويُركَّب على معيار التجمع للشاشات (R-46)؛ لا يُركَّب تلفزيون منزلي في المناطق العامة، ولا أسلاك ظاهرة أو تمديدات مؤقتة.'))
      when e->>'key' = 'quality' and m.code = 'contractor' then jsonb_set(e, '{body}', to_jsonb((e->>'body') || E'\n- الشاشات الرقمية والتلفزيونات تُورَّد وتُركَّب على معيار التجمع AAHC-FM-STD-DIGITAL-SIGNAGE-001 (R-46): الموديل المعتمد، والمقاس والارتفاع حسب الموقع، ومقبسان ونقطة شبكة خلف كل شاشة، وكابلات مخفية، وربط شاشات المناطق العامة بمنصة Navori.'))
      else e end order by o) from jsonb_array_elements(m.sections) with ordinality as t(e, o))
    where m.code in ('design', 'om', 'user', 'contractor');
  insert into public.seed_marks (key) values ('ls_sync_naeem_v1');
end $$;

-- قاعدة الحوكمة (خارج الحارس: لا تتكرر)
insert into public.gov_rules (code, title, theme, statement, criteria, owner, process_code, note, sort, active) values ('R-46', 'كل شاشة على معيار التجمع', 'إدارة المرافق',
  'كل شاشة عرض أو تلفزيون يُركَّب في منشآت التجمع — في مشروع أو بطلب منشأة — يلتزم بمعيار الشاشات الرقمية AAHC-FM-STD-DIGITAL-SIGNAGE-001: الشاشة التجارية المعتمدة، والمقاس والارتفاع حسب الموقع، ومقبسان ونقطة شبكة سلكية خلف الشاشة، وكابلات مخفية، وربط شاشات المناطق العامة بمنصة Navori. وأي خروج عنه بموافقة موثقة.',
  '["لا تلفزيون منزلي في المناطق العامة أو الحرجة", "الشاشات في المناطق العامة مربوطة بمنصة Navori", "مقبسان ونقطة شبكة سلكية خلف كل شاشة، واللاسلكي بموافقة تقنية المعلومات", "لا كابلات ظاهرة ولا تمديدات مؤقتة", "المقاس وارتفاع منتصف الشاشة حسب جداول المعيار", "الخروج عن المعيار بموافقة موثقة من إدارة المرافق"]'::jsonb,
  'FAC', '', 'المعيار في المكتبة الفنية ← معايير التجمع. الأقسام المساندة: تقنية المعلومات، الاتصال المؤسسي، المشاريع.', 46, true) on conflict (code) do nothing;
