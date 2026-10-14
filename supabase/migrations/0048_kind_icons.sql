-- 0048: أيقونات النماذج أسماء من مجموعة الأيقونات الخطية الموحّدة (بدل الرموز التعبيرية). قابل لإعادة التشغيل.
alter table public.ops_kinds alter column icon set default '';
update public.ops_kinds k set icon = v.ic from (values
  ('mnt','wrench'),('bme','steth'),('it','monitor'),('gen','sparkle'),('saf','shield'),('fac','building'),('med','box'),('prj','ruler'),
  ('emerg','siren'),('handover','clipok'),('drill','flame'),('dispose','recycle'),('spare','cog'),('mspec','clip2'),('siteprep','crane'),('worksite','cone'),
  ('closure','barrier'),('permit','permit'),('impair','flameoff'),('shutdown','power'),('ppm','calendar'),('accept','box'),('recall','alert'),('access','key'),('ceval','star')
) as v(code, ic) where k.code = v.code and k.icon is distinct from v.ic and (k.icon !~ '^[a-z0-9]+$' or k.icon is null);
-- أي نموذج آخر أُضيف من الإدارة برمز تعبيري يرجع للأيقونة التلقائية حسب رمزه
update public.ops_kinds set icon = '' where icon !~ '^[a-z0-9]*$';
