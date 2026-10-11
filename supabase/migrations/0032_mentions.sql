-- ===== الإشارة (@منشن) في سلاسل المتابعة: إشعار للمذكور + بطاقة «ذُكرت في» في «يومي» =====
create table if not exists public.mentions (
  id bigserial primary key,
  uid text not null,                      -- معرّف الرسالة في v_thread (c-55 / r-12 / n-3 / t-7)
  kind text not null, ref_id text not null, project_id uuid references public.projects(id) on delete set null,
  user_id uuid not null,                  -- المذكور
  by_user uuid not null,                  -- الكاتب
  excerpt text default '',
  at timestamptz default now(), seen_at timestamptz
);
create index if not exists mentions_user_idx on public.mentions(user_id, seen_at);
create index if not exists mentions_uid_idx on public.mentions(uid);
alter table public.mentions enable row level security;
grant select, insert, update, delete on public.mentions to authenticated;
grant usage, select on sequence public.mentions_id_seq to authenticated;
drop policy if exists p_read on public.mentions; create policy p_read on public.mentions for select using (public.is_admin() or user_id = auth.uid() or by_user = auth.uid());
drop policy if exists p_ins on public.mentions; create policy p_ins on public.mentions for insert with check (public.can_read() and by_user = auth.uid());
drop policy if exists p_upd on public.mentions; create policy p_upd on public.mentions for update using (user_id = auth.uid() or public.is_admin()) with check (true);
drop policy if exists p_del on public.mentions; create policy p_del on public.mentions for delete using (by_user = auth.uid() or public.is_admin());

create or replace function public.mentions_ai() returns trigger language plpgsql security definer set search_path = public as $$
declare lbl text;
begin
  lbl := case new.kind when 'task' then 'مهمة' when 'request' then 'طلب' when 'challenge' then 'تحدٍ' when 'submittal' then 'اعتماد' when 'payment' then 'مستخلص' when 'change' then 'أمر تغيير' when 'treport' then 'تقرير' when 'leave' then 'إجازة' else new.kind end;
  perform public.notify(array[new.user_id], 'mention', pname(new.by_user) || ' ذكرك في متابعة على ' || lbl || case when new.project_id is not null then ' — ' || proj_name(new.project_id) else '' end, left(new.excerpt, 200), '#/open/' || new.kind || '/' || new.ref_id);
  return new;
end $$;
drop trigger if exists mentions_ai on public.mentions;
create trigger mentions_ai after insert on public.mentions for each row execute function public.mentions_ai();
