-- ===== حزمة الطرح: أنواع مستندات الطرح + حالة مراجعة «للطرح» للمخططات =====
alter table public.documents drop constraint if exists documents_category_check;
alter table public.documents add constraint documents_category_check check (category in ('contract','site_handover','initial_handover','final_handover','bank_guarantee','insurance','letter_in','letter_out','change_order','extension','minutes','other','tender_terms','tender_specs','tender_addendum','site_visit','bid_opening','award_letter'));
alter table public.drawing_revisions drop constraint if exists drawing_revisions_status_check;
alter table public.drawing_revisions add constraint drawing_revisions_status_check check (status in ('design','for_tender','for_approval','approved','approved_notes','rejected','as_built','superseded'));
