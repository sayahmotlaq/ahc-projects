-- ===== جداول الكميات: بنود حرة ومقطوعية + ملاحظات عامة + نسخة طرح بلا أسعار =====
alter table public.boq_lines alter column variant_code drop not null;
alter table public.boq_lines add column if not exists kind text not null default 'ref' check (kind in ('ref','free'));
alter table public.boq_lines add column if not exists title text;
alter table public.boq_lines add column if not exists descr text;
alter table public.boq_lines add column if not exists unit text;
alter table public.boq_lines add column if not exists div_code text;   -- شعبة اختيارية للتجميع في بنود حرة
alter table public.boq_lines drop constraint if exists boq_lines_free_chk;
alter table public.boq_lines add constraint boq_lines_free_chk check ((kind = 'ref' and variant_code is not null) or (kind = 'free' and title is not null));
alter table public.boqs add column if not exists pricing text not null default 'unit' check (pricing in ('unit','lumpsum'));
alter table public.boqs add column if not exists hide_prices boolean not null default false;
