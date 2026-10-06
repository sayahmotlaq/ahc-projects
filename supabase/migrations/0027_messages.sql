-- ===== رسائل اليوم من الإدارة (توجيه / شكر / تنبيه / معلومة) مع قراءات وردود =====
create table if not exists public.messages (
  id bigserial primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info' check (kind in ('direct','thanks','alert','info')),
  body text not null,
  audience text not null default 'all' check (audience in ('all','users')),
  recipients uuid[] not null default '{}',
  visibility text not null default 'public' check (visibility in ('public','private')),
  pinned boolean not null default false,
  show_from timestamptz not null default now(),
  expires_at timestamptz,
  link text, link_label text,
  archived boolean not null default false,
  notified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists messages_show_idx on public.messages(show_from desc);
create table if not exists public.message_reads (
  message_id bigint references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(), reply text default '', replied_at timestamptz,
  primary key (message_id, user_id)
);
alter table public.messages enable row level security; alter table public.message_reads enable row level security;
-- من يرى الرسالة: الإدارة والكاتب دائماً؛ غيرهم: بعد موعد الظهور وغير مؤرشفة، وإن كانت للجميع أو علنية أو هو من المستلمين
drop policy if exists p_read on public.messages;
create policy p_read on public.messages for select using (
  public.is_admin() or author_id = auth.uid()
  or (public.can_read() and not archived and show_from <= now() and (expires_at is null or expires_at > now())
      and (audience = 'all' or visibility = 'public' or auth.uid() = any(recipients)))
);
drop policy if exists p_adm on public.messages; create policy p_adm on public.messages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists p_read on public.message_reads; create policy p_read on public.message_reads for select using (public.is_admin() or user_id = auth.uid());
drop policy if exists p_own on public.message_reads; create policy p_own on public.message_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.messages, public.message_reads to authenticated;
grant usage, select on sequence public.messages_id_seq to authenticated;

-- المستلمون الفعليون (للإشعار والإحصاء)
create or replace function public.message_targets(p_id bigint) returns uuid[] language sql stable security definer set search_path = public as $$
  select case when m.audience = 'all' then (select coalesce(array_agg(p.id), '{}') from public.profiles p where p.role not in ('pending','disabled') and p.id <> m.author_id)
              else m.recipients end
  from public.messages m where m.id = p_id $$;
grant execute on function public.message_targets(bigint) to authenticated;

create or replace function public.messages_notify(p_id bigint) returns void language plpgsql security definer set search_path = public as $$
declare m record; nm text;
begin
  select * into m from public.messages where id = p_id; if m is null or m.notified then return; end if;
  nm := coalesce(public.pname(m.author_id), 'الإدارة');
  perform public.notify(public.message_targets(p_id), 'msg', case m.kind when 'thanks' then 'شكر من ' when 'alert' then 'تنبيه من ' when 'direct' then 'توجيه من ' else 'رسالة من ' end || nm, left(m.body, 160), '#/today?msg=' || p_id);
  update public.messages set notified = true where id = p_id;
end $$;
create or replace function public.messages_ai() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.show_from <= now() then perform public.messages_notify(new.id); end if;
  return new;
end $$;
drop trigger if exists messages_ai on public.messages;
create trigger messages_ai after insert on public.messages for each row execute function public.messages_ai();
-- الرسائل المجدولة: تُشعر عند حلول موعدها (الخطوة اليومية)
create or replace function public.notify_scheduled_messages() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from public.messages where not notified and not archived and show_from <= now() loop perform public.messages_notify(r.id); n := n + 1; end loop;
  return n;
end $$;
-- ردّ المستلم يصل الكاتب
create or replace function public.message_reads_aiu() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if new.reply is not null and new.reply <> '' and (tg_op = 'INSERT' or new.reply is distinct from old.reply) then
    select * into m from public.messages where id = new.message_id;
    new.replied_at := now();
    perform public.notify(array[m.author_id], 'msg', 'ردّ ' || coalesce(public.pname(new.user_id), '') || ' على رسالتك', left(new.reply, 160), '#/today?msg=' || m.id);
  end if;
  return new;
end $$;
drop trigger if exists message_reads_biu on public.message_reads;
create trigger message_reads_biu before insert or update on public.message_reads for each row execute function public.message_reads_aiu();
