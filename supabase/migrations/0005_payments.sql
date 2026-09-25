-- المستخلصات المالية + دور المالية
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','engineer','viewer','finance','pending','disabled'));
create or replace function public.can_read() returns boolean
language sql stable as $$ select public.my_role() in ('admin','engineer','viewer','finance') $$;
create or replace function public.is_finance() returns boolean
language sql stable as $$ select public.my_role() in ('admin','finance') $$;

-- رصيد المدفوعات السابقة (قبل تشغيل وحدة المستخلصات) يُحفظ منفصلاً حتى لا تُمحى عند المزامنة
alter table public.projects add column if not exists paid_opening numeric(16,2);
update public.projects set paid_opening = coalesce(paid_amount,0) where paid_opening is null;

create table if not exists public.payments (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  no int not null default 1,
  kind text default 'interim' check (kind in ('advance','interim','final','retention_release')),
  period_from date, period_to date,
  cumulative_work numeric(16,2) default 0,   -- قيمة الأعمال المنفذة تراكمياً
  work_amount numeric(16,2) default 0,       -- قيمة أعمال هذا المستخلص
  retention_pct numeric(5,2) default 10,     -- نسبة حجز الضمان
  retention_amount numeric(16,2) default 0,
  advance_recovery numeric(16,2) default 0,  -- استرداد الدفعة المقدمة
  penalty numeric(16,2) default 0,           -- غرامة تأخير
  other_deductions numeric(16,2) default 0,
  vat_pct numeric(5,2) default 15,
  vat_amount numeric(16,2) default 0,
  net_amount numeric(16,2) default 0,        -- الصافي المستحق
  status text default 'draft' check (status in ('draft','submitted','review','approved','finance','paid','rejected')),
  submitted_on date, approved_on date, sent_finance_on date, paid_on date,
  payment_order_no text, contractor_invoice_no text, notes text, reject_reason text,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists payments_project_idx on public.payments(project_id);
create table if not exists public.payment_log (
  id bigserial primary key, payment_id bigint references public.payments(id) on delete cascade,
  from_status text, to_status text, note text, by_user uuid, at timestamptz default now()
);

-- حساب الصافي تلقائياً
create or replace function public.calc_payment() returns trigger language plpgsql as $$
begin
  if new.kind in ('advance','retention_release') then
    new.retention_amount := 0;
  else
    new.retention_amount := round(coalesce(new.work_amount,0) * coalesce(new.retention_pct,0) / 100, 2);
  end if;
  new.vat_amount := round(coalesce(new.work_amount,0) * coalesce(new.vat_pct,0) / 100, 2);
  new.net_amount := round(coalesce(new.work_amount,0) + new.vat_amount - new.retention_amount - coalesce(new.advance_recovery,0) - coalesce(new.penalty,0) - coalesce(new.other_deductions,0), 2);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists calc_payment_trg on public.payments;
create trigger calc_payment_trg before insert or update on public.payments for each row execute function public.calc_payment();

-- تحديث المدفوع في المشروع من المستخلصات المصروفة
create or replace function public.sync_paid() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.project_id, old.project_id);
  update public.projects set paid_amount = coalesce(paid_opening,0) + coalesce((select sum(net_amount) from public.payments where project_id = pid and status = 'paid'), 0) where id = pid;
  return coalesce(new, old);
end $$;
create or replace function public.sync_paid_project() returns trigger language plpgsql as $$
begin
  if new.paid_opening is distinct from old.paid_opening then
    new.paid_amount := coalesce(new.paid_opening,0) + coalesce((select sum(net_amount) from public.payments where project_id = new.id and status = 'paid'), 0);
  end if;
  return new;
end $$;
drop trigger if exists sync_paid_project_trg on public.projects;
create trigger sync_paid_project_trg before update on public.projects for each row execute function public.sync_paid_project();
drop trigger if exists sync_paid_trg on public.payments;
create trigger sync_paid_trg after insert or update or delete on public.payments for each row execute function public.sync_paid();

-- صلاحيات: قراءة للمعتمدين؛ إنشاء للمهندس/الأدمن؛ تعديل: الأدمن دائماً، المهندس في مسودة/مقدم/مراجعة، المالية للانتقال إلى مصروف فقط
alter table public.payments enable row level security; alter table public.payment_log enable row level security;
drop policy if exists p_read on public.payments; drop policy if exists p_ins on public.payments; drop policy if exists p_upd on public.payments; drop policy if exists p_del on public.payments;
drop policy if exists p_read on public.payment_log; drop policy if exists p_ins on public.payment_log;
create policy p_read on public.payments for select using (public.can_read());
create policy p_ins on public.payments for insert with check (public.can_edit());
create policy p_upd on public.payments for update using (public.is_admin() or (public.can_edit() and status in ('draft','submitted','review','rejected')) or (public.my_role() = 'finance' and status = 'finance')) with check (public.can_read());
create policy p_del on public.payments for delete using (public.is_admin() or (public.can_edit() and status = 'draft'));
create policy p_read on public.payment_log for select using (public.can_read());
create policy p_ins on public.payment_log for insert with check (public.can_read() and by_user = auth.uid());

create or replace function public.guard_payment() returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if public.my_role() = 'finance' then
    if new.status not in ('finance','paid','rejected') or (row_to_json(new)::jsonb - 'status' - 'paid_on' - 'payment_order_no' - 'notes' - 'reject_reason' - 'updated_at' - 'net_amount' - 'vat_amount' - 'retention_amount') <> (row_to_json(old)::jsonb - 'status' - 'paid_on' - 'payment_order_no' - 'notes' - 'reject_reason' - 'updated_at' - 'net_amount' - 'vat_amount' - 'retention_amount') then
      raise exception 'صلاحية المالية: تسجيل الصرف أو الإرجاع فقط';
    end if;
    return new;
  end if;
  -- مهندس: لا يستطيع الاعتماد أو الإحالة أو الصرف
  if new.status in ('approved','finance','paid') then raise exception 'اعتماد المستخلص وإحالته من صلاحية الإدارة'; end if;
  return new;
end $$;
drop trigger if exists guard_payment_trg on public.payments;
create trigger guard_payment_trg before update on public.payments for each row execute function public.guard_payment();

drop trigger if exists audit_payments on public.payments;
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.audit();
grant select, insert, update, delete on public.payments, public.payment_log to authenticated;
grant usage, select on sequence public.payments_id_seq, public.payment_log_id_seq to authenticated;
-- المالية تقرأ المشاريع (عبر can_read) وتُمنع من التعديل عبر can_edit
