-- ===== متابعة الإشارات التي أرسلتها: إغلاق من المُشير بعد انتهاء الموضوع =====
alter table public.mentions add column if not exists closed_at timestamptz;
drop policy if exists p_upd on public.mentions;
create policy p_upd on public.mentions for update using (user_id = auth.uid() or by_user = auth.uid() or public.is_admin()) with check (true);
