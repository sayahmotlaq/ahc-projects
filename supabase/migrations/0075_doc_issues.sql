-- 0075: سجل الوثائق الصادرة من المنصة (رقم مرجعي على كل ملف + بصمة SHA-256 لملفات Excel للتحقق من أن نسخة المقاول لم تُعدَّل)
create table if not exists public.doc_issues (code text primary key, kind text not null, ref_id text not null default '', title text not null default '', lang text not null default 'ar',
  sha256 text, issued_by uuid default auth.uid(), issued_name text not null default '', issued_at timestamptz not null default now());
alter table public.doc_issues enable row level security;
grant select, insert, update on public.doc_issues to authenticated;
drop policy if exists p_read on public.doc_issues; create policy p_read on public.doc_issues for select using (auth.uid() is not null);
drop policy if exists p_ins on public.doc_issues; create policy p_ins on public.doc_issues for insert with check (auth.uid() is not null);
drop policy if exists p_upd on public.doc_issues; create policy p_upd on public.doc_issues for update using (issued_by = auth.uid() or public.is_admin());
create index if not exists doc_issues_ref on public.doc_issues (ref_id, issued_at desc);
