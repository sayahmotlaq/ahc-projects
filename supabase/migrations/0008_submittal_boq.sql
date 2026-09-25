-- ربط طلب الاعتماد ببند جدول كميات المشروع
alter table public.submittals add column if not exists boq_line_id bigint references public.boq_lines(id) on delete set null;
alter table public.submittals add column if not exists spec_source text default 'ref' check (spec_source in ('boq','ref','free'));
create index if not exists submittals_boq_line_idx on public.submittals(boq_line_id);
