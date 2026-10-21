-- 0067: الملاحظات العامة الافتراضية لجداول الكميات = الملاحظات الإحدى عشرة المعتمدة في جدول النعيم (بطلب رئيس قسم المشاريع)
-- تُنسخ من الجدول نفسه نصاً (مع تصحيح إملائي بسيط) إلى settings.boq_default_notes مرة واحدة، ويعدّلها المدير لاحقاً من إدارة قائمة المقطوعية.
do $$ declare t text; begin
  if exists (select 1 from public.seed_marks where key = 'boq_default_notes_v1') then return; end if;
  select bq.notes into t from public.boqs bq join public.projects p on p.id = bq.project_id
    where p.name like '%النعيم%' and bq.name = 'مقطوعية — نموذج المسار الرابع' order by bq.created_at limit 1;
  if coalesce(t, '') <> '' then
    t := replace(t, 'يُرجع للإدارة المشاريع بالتجمع الصحي بالأحساء', 'يُرجع لإدارة المشاريع بتجمع الأحساء الصحي');
    t := replace(t, 'لنفي الجهاله', 'لنفي الجهالة'); t := replace(t, 'المعتمده', 'المعتمدة'); t := replace(t, 'المرفقه', 'المرفقة');
    t := replace(t, 'و الإستعانه', 'والاستعانة'); t := replace(t, 'الإعتماد', 'الاعتماد'); t := replace(t, 'و الرسوم .', 'والرسوم.');
    t := replace(t, 'تنفيذ  ', 'تنفيذ '); t := replace(t, '11.تجمع الاحساء', '11. تجمع الأحساء'); t := replace(t, 'الانظمة والاعمال', 'الأنظمة والأعمال');
    insert into public.settings(key, value, updated_at) values ('boq_default_notes', jsonb_build_object('text', t), now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  insert into public.seed_marks (key) values ('boq_default_notes_v1');
end $$;
