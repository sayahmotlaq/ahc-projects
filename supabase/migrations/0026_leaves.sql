-- ===== إدارة الإجازات والتغطية (تنسيق داخلي للقسم) =====
create table if not exists public.holidays (
  id bigserial primary key, name text not null, start_date date not null, end_date date not null,
  created_at timestamptz default now(), check (end_date >= start_date)
);
create table if not exists public.leave_balances (
  user_id uuid references public.profiles(id) on delete cascade, year int not null,
  annual_days int not null default 30, carried int not null default 0, adjustment int not null default 0, note text default '',
  updated_at timestamptz default now(), primary key (user_id, year)
);
create table if not exists public.leaves (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'annual' check (kind in ('annual','emergency','sick','mission','unpaid','other')),
  start_date date not null, end_date date not null, days int not null default 0,
  reason text default '', path text, file_name text,
  delegate_id uuid references public.profiles(id) on delete set null,
  delegate_status text not null default 'pending' check (delegate_status in ('pending','accepted','declined','none')),
  delegate_note text default '',
  handover jsonb not null default '[]'::jsonb, handover_note text default '',
  status text not null default 'pending_delegate' check (status in ('pending_delegate','pending_approval','approved','rejected','cancelled','returned')),
  decided_by uuid, decided_at timestamptz, decision_note text default '',
  returned_at timestamptz, return_note text default '',
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  check (end_date >= start_date)
);
create index if not exists leaves_user_idx on public.leaves(user_id);
create index if not exists leaves_dates_idx on public.leaves(start_date, end_date);
create index if not exists leaves_status_idx on public.leaves(status);
create table if not exists public.leave_log (
  id bigserial primary key, leave_id bigint references public.leaves(id) on delete cascade,
  at timestamptz default now(), by_user uuid, action text not null, note text default ''
);
create index if not exists leave_log_idx on public.leave_log(leave_id);
insert into public.settings(key, value) values ('leaves', '{"count_mode":"calendar","min_cover":1,"annual_default":30}'::jsonb) on conflict (key) do nothing;

-- ---------- دوال مساعدة
create or replace function public.leave_days(p_start date, p_end date) returns int
language plpgsql stable security definer set search_path = public as $$
declare mode text; d date; n int := 0;
begin
  if p_start is null or p_end is null or p_end < p_start then return 0; end if;
  select coalesce(value->>'count_mode', 'calendar') into mode from public.settings where key = 'leaves';
  if mode <> 'workdays' then return (p_end - p_start) + 1; end if;
  d := p_start;
  while d <= p_end loop
    if extract(dow from d) not in (5, 6) and not exists (select 1 from public.holidays h where d between h.start_date and h.end_date) then n := n + 1; end if;
    d := d + 1;
  end loop;
  return n;
end $$;
grant execute on function public.leave_days(date, date) to authenticated;

create or replace function public.leave_balance(p_user uuid, p_year int)
returns table (total int, used int, pending int, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare b record; def int;
begin
  select coalesce((value->>'annual_default')::int, 30) into def from public.settings where key = 'leaves';
  select * into b from public.leave_balances where user_id = p_user and year = p_year;
  total := coalesce(b.annual_days, def, 30) + coalesce(b.carried, 0) + coalesce(b.adjustment, 0);
  select coalesce(sum(days), 0) into used from public.leaves where user_id = p_user and kind = 'annual' and status in ('approved', 'returned') and extract(year from start_date) = p_year;
  select coalesce(sum(days), 0) into pending from public.leaves where user_id = p_user and kind = 'annual' and status in ('pending_delegate', 'pending_approval') and extract(year from start_date) = p_year;
  remaining := total - used;
  return next;
end $$;
grant execute on function public.leave_balance(uuid, int) to authenticated;

-- ---------- الحارس: الصلاحيات والانتقالات والحقول المحسوبة
create or replace function public.leaves_biu() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); adm boolean := public.is_admin();
begin
  if tg_op = 'INSERT' then
    if not adm and new.user_id <> me then raise exception 'لا يمكنك تقديم إجازة لشخص آخر'; end if;
    new.created_by := coalesce(new.created_by, me);
    new.days := public.leave_days(new.start_date, new.end_date);
    if new.delegate_id is null then new.delegate_status := 'none'; new.status := 'pending_approval';
    else new.delegate_status := 'pending'; new.status := 'pending_delegate'; end if;
    if new.delegate_id = new.user_id then raise exception 'البديل لا يمكن أن يكون صاحب الطلب'; end if;
    new.decided_by := null; new.decided_at := null; new.returned_at := null;
    return new;
  end if;
  -- UPDATE
  new.updated_at := now();
  if not adm then
    if me = old.user_id then
      -- صاحب الطلب: تعديل الطلب أثناء الانتظار، إلغاء، وتأكيد العودة
      if new.status not in (old.status, 'cancelled', 'returned') then raise exception 'غير مسموح بتغيير الحالة'; end if;
      if new.status = 'cancelled' and old.status not in ('pending_delegate', 'pending_approval', 'approved') then raise exception 'لا يمكن إلغاء هذا الطلب'; end if;
      if new.status = 'returned' and old.status <> 'approved' then raise exception 'لا يمكن تأكيد العودة إلا لإجازة معتمدة'; end if;
      if old.status not in ('pending_delegate', 'pending_approval') and (new.start_date <> old.start_date or new.end_date <> old.end_date or new.kind <> old.kind or new.delegate_id is distinct from old.delegate_id) then raise exception 'لا يمكن تعديل إجازة بعد اعتمادها'; end if;
      new.decided_by := old.decided_by; new.decided_at := old.decided_at; new.decision_note := old.decision_note;
      if new.delegate_status <> old.delegate_status and new.delegate_id is not distinct from old.delegate_id then new.delegate_status := old.delegate_status; end if;
    elsif me = old.delegate_id then
      -- البديل: قبول/رفض التسليم وتحديث قائمة التسليم فقط
      declare ds text := new.delegate_status; dn text := new.delegate_note; ho jsonb := new.handover; rn text := new.return_note; begin
        new := old; new.updated_at := now(); new.delegate_status := ds; new.delegate_note := dn; new.handover := ho; new.return_note := rn;
      end;
    else
      raise exception 'غير مصرح';
    end if;
  end if;
  if new.start_date <> old.start_date or new.end_date <> old.end_date then new.days := public.leave_days(new.start_date, new.end_date); end if;
  -- تغيير البديل يعيد التسليم إلى الانتظار
  if new.delegate_id is distinct from old.delegate_id then
    if new.delegate_id is null then new.delegate_status := 'none'; if new.status = 'pending_delegate' then new.status := 'pending_approval'; end if;
    else new.delegate_status := 'pending'; if new.status = 'pending_approval' then new.status := 'pending_delegate'; end if; end if;
  end if;
  if new.delegate_id = new.user_id then raise exception 'البديل لا يمكن أن يكون صاحب الطلب'; end if;
  -- قبول البديل ينقل الطلب إلى قرار الإدارة
  if new.delegate_status = 'accepted' and old.delegate_status <> 'accepted' and new.status = 'pending_delegate' then new.status := 'pending_approval'; end if;
  if new.status in ('approved', 'rejected') and old.status not in ('approved', 'rejected') then new.decided_by := me; new.decided_at := now(); end if;
  if new.status = 'returned' and old.status <> 'returned' then new.returned_at := now(); end if;
  return new;
end $$;
drop trigger if exists leaves_biu on public.leaves;
create trigger leaves_biu before insert or update on public.leaves for each row execute function public.leaves_biu();

create or replace function public.leaves_aiu() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text; dn text; lnk text; per text;
begin
  nm := coalesce(public.pname(new.user_id), ''); dn := coalesce(public.pname(new.delegate_id), '');
  lnk := '#/leaves?id=' || new.id; per := to_char(new.start_date, 'YYYY-MM-DD') || ' → ' || to_char(new.end_date, 'YYYY-MM-DD') || ' (' || new.days || ' يوم)';
  if tg_op = 'INSERT' then
    insert into public.leave_log(leave_id, by_user, action, note) values (new.id, me, 'submitted', per);
    if new.delegate_id is not null then perform public.notify(array[new.delegate_id], 'leave', 'طلب تسليم عمل من ' || nm, 'إجازة ' || per || ' — راجع قائمة التسليم واقبلها', lnk);
    else perform public.notify(public.admins(), 'leave', 'طلب إجازة بانتظار قرارك: ' || nm, per, lnk); end if;
    return new;
  end if;
  if new.delegate_status <> old.delegate_status and new.delegate_id is not distinct from old.delegate_id then
    insert into public.leave_log(leave_id, by_user, action, note) values (new.id, me, 'delegate_' || new.delegate_status, coalesce(new.delegate_note, ''));
    if new.delegate_status = 'accepted' then
      perform public.notify(public.admins(), 'leave', 'طلب إجازة جاهز لقرارك: ' || nm, per || ' — التغطية: ' || dn, lnk);
      perform public.notify(array[new.user_id], 'leave', 'قبل ' || dn || ' تسليم عملك', 'الطلب الآن بانتظار اعتماد الإدارة', lnk);
    elsif new.delegate_status = 'declined' then
      perform public.notify(array[new.user_id], 'leave', 'اعتذر ' || dn || ' عن التغطية', coalesce(new.delegate_note, '') || ' — اختر بديلاً آخر', lnk);
    end if;
  elsif new.delegate_id is distinct from old.delegate_id and new.delegate_id is not null then
    insert into public.leave_log(leave_id, by_user, action, note) values (new.id, me, 'delegate_changed', dn);
    perform public.notify(array[new.delegate_id], 'leave', 'طلب تسليم عمل من ' || nm, 'إجازة ' || per || ' — راجع قائمة التسليم واقبلها', lnk);
  end if;
  if new.status <> old.status then
    insert into public.leave_log(leave_id, by_user, action, note) values (new.id, me, new.status, case when new.status in ('approved', 'rejected') then coalesce(new.decision_note, '') when new.status = 'returned' then coalesce(new.return_note, '') else '' end);
    if new.status = 'approved' then
      perform public.notify(array[new.user_id], 'leave', 'اعتُمدت إجازتك', per || case when new.decision_note <> '' then E'\n' || new.decision_note else '' end, lnk);
      if new.delegate_id is not null then perform public.notify(array[new.delegate_id], 'leave', 'اعتُمدت إجازة ' || nm || ' — أنت البديل', per, lnk); end if;
    elsif new.status = 'rejected' then
      perform public.notify(array[new.user_id], 'leave', 'لم تُعتمد إجازتك', per || case when new.decision_note <> '' then E'\n' || new.decision_note else '' end, lnk);
    elsif new.status = 'cancelled' then
      perform public.notify(public.admins() || array[new.delegate_id], 'leave', 'أُلغي طلب إجازة ' || nm, per, lnk);
    elsif new.status = 'returned' then
      perform public.notify(public.admins() || array[new.delegate_id], 'leave', nm || ' عاد واستلم عمله', per || case when new.return_note <> '' then E'\n' || new.return_note else '' end, lnk);
    elsif new.status = 'pending_approval' and old.status = 'pending_delegate' and new.delegate_status = old.delegate_status then
      perform public.notify(public.admins(), 'leave', 'طلب إجازة بانتظار قرارك: ' || nm, per, lnk);
    end if;
  elsif old.status in ('pending_delegate', 'pending_approval') and (new.start_date <> old.start_date or new.end_date <> old.end_date or new.kind <> old.kind) then
    insert into public.leave_log(leave_id, by_user, action, note) values (new.id, me, 'edited', per);
  end if;
  return new;
end $$;
drop trigger if exists leaves_aiu on public.leaves;
create trigger leaves_aiu after insert or update on public.leaves for each row execute function public.leaves_aiu();

-- ---------- الصلاحيات
alter table public.leaves enable row level security;
alter table public.leave_balances enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_log enable row level security;
drop policy if exists p_read on public.leaves; create policy p_read on public.leaves for select using (public.is_admin() or user_id = auth.uid() or delegate_id = auth.uid());
drop policy if exists p_ins on public.leaves; create policy p_ins on public.leaves for insert with check (public.can_read() and (public.is_admin() or user_id = auth.uid()));
drop policy if exists p_upd on public.leaves; create policy p_upd on public.leaves for update using (public.is_admin() or user_id = auth.uid() or delegate_id = auth.uid()) with check (true);
drop policy if exists p_del on public.leaves; create policy p_del on public.leaves for delete using (public.is_admin());
drop policy if exists p_read on public.leave_balances; create policy p_read on public.leave_balances for select using (public.is_admin() or user_id = auth.uid());
drop policy if exists p_adm on public.leave_balances; create policy p_adm on public.leave_balances for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists p_read on public.holidays; create policy p_read on public.holidays for select using (public.can_read());
drop policy if exists p_adm on public.holidays; create policy p_adm on public.holidays for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists p_read on public.leave_log; create policy p_read on public.leave_log for select using (exists (select 1 from public.leaves l where l.id = leave_id));
grant select, insert, update, delete on public.leaves, public.leave_balances, public.holidays to authenticated;
grant select on public.leave_log to authenticated;
grant usage, select on sequence public.leaves_id_seq, public.holidays_id_seq, public.leave_log_id_seq to authenticated;

-- عرض التقويم (بلا سبب أو مرفق) لكل مستخدم فعّال
create or replace view public.v_leaves_cal as
  select l.id, l.user_id, public.pname(l.user_id) as user_name, p.role as user_role, l.kind, l.start_date, l.end_date, l.days, l.status, l.delegate_id, public.pname(l.delegate_id) as delegate_name
  from public.leaves l join public.profiles p on p.id = l.user_id
  where public.can_read() and l.status in ('pending_delegate', 'pending_approval', 'approved', 'returned');
grant select on public.v_leaves_cal to authenticated;

-- ---------- التقويم المشترك (iCal): الإجازات المعتمدة تظهر للجميع
drop function if exists public.cal_feed_base(text);
alter function public.cal_feed(text) rename to cal_feed_base;
create or replace function public.cal_feed(p_token text)
returns table (uid text, kind text, title text, descr text, on_date date, url text, done boolean, owner_name text)
language plpgsql security definer set search_path = public as $$
declare u uuid; nm text;
begin
  select id, full_name into u, nm from public.profiles where cal_token = p_token and role not in ('pending', 'disabled');
  if u is null then return; end if;
  return query select * from public.cal_feed_base(p_token);
  return query
    select 'lv-' || l.id, 'leave', 'إجازة: ' || coalesce(public.pname(l.user_id), '') || ' (' || l.days || ' يوم)',
           'من ' || to_char(l.start_date, 'YYYY-MM-DD') || ' إلى ' || to_char(l.end_date, 'YYYY-MM-DD') || case when l.delegate_id is not null then E'\nالتغطية: ' || coalesce(public.pname(l.delegate_id), '') else '' end,
           l.start_date, '#/leaves?id=' || l.id, l.end_date < current_date, nm
    from public.leaves l where l.status in ('approved', 'returned') and l.end_date > current_date - 60;
end $$;
revoke all on function public.cal_feed(text) from public;
grant execute on function public.cal_feed(text) to service_role;

-- ---------- التنبيهات اليومية: بدء الإجازة غداً، وتأكيد العودة
create or replace function public.notify_leave_events() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; nm text; dn text;
begin
  for r in select * from public.leaves where status = 'approved' and start_date = current_date + 1 loop
    nm := coalesce(public.pname(r.user_id), ''); dn := coalesce(public.pname(r.delegate_id), '');
    if not exists (select 1 from public.notifications where kind = 'leave' and link = '#/leaves?id=' || r.id || '&soon=1') then
      perform public.notify(public.admins() || array[r.user_id, r.delegate_id], 'leave', 'تبدأ غداً إجازة ' || nm, to_char(r.start_date, 'YYYY-MM-DD') || ' → ' || to_char(r.end_date, 'YYYY-MM-DD') || case when r.delegate_id is not null then ' — التغطية: ' || dn else '' end, '#/leaves?id=' || r.id || '&soon=1'); n := n + 1;
    end if;
  end loop;
  for r in select * from public.leaves where status = 'approved' and end_date < current_date loop
    if not exists (select 1 from public.notifications where kind = 'leave' and link = '#/leaves?id=' || r.id || '&ret=1' and created_at > now() - interval '3 days') then
      perform public.notify(array[r.user_id], 'leave', 'انتهت إجازتك — أكّد استلام عملك', 'افتح الطلب واضغط «استلمت عملي» لإغلاق التغطية', '#/leaves?id=' || r.id || '&ret=1'); n := n + 1;
    end if;
  end loop;
  return n;
end $$;
