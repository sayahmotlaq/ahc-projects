-- 0078: ملف خدمة المكيف يعرض نص مواصفة الوحدات المنفصلة LS-78 فقط (LS-22 بند تكييف شامل لا يخص تركيب وحدة)
update public.services set links = jsonb_set(links, '{ls}', '["LS-78"]'::jsonb) where code = 'SV-M01' and links->'ls' @> '["LS-22"]'::jsonb;
