-- ===== التقرير التنفيذي المشارك برابط: إصدارات مجمّدة + ملاحظات الإدارة التنفيذية =====

create table if not exists public.shared_reports (
  id bigserial primary key,
  token text not null unique,
  title text not null default 'التقرير التنفيذي لمحفظة المشاريع',
  period_from date, period_to date,
  data jsonb not null,
  pin text,
  expires_at timestamptz not null default now() + interval '30 days',
  revoked boolean not null default false,
  views int not null default 0, last_viewed_at timestamptz,
  created_by uuid, created_at timestamptz default now()
);
create index if not exists shared_reports_token_idx on public.shared_reports(token) where not revoked;
alter table public.shared_reports enable row level security;
grant select, insert, update, delete on public.shared_reports to authenticated;
grant usage, select on sequence public.shared_reports_id_seq to authenticated;
drop policy if exists p_admin on public.shared_reports;
create policy p_admin on public.shared_reports for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.shared_notes (
  id bigserial primary key,
  report_id bigint not null references public.shared_reports(id) on delete cascade,
  name text not null, role_title text default '',
  body text not null,
  ref text default '',          -- مرجع البند (project:<id> | challenge:<id> | فارغ للتقرير كله)
  ref_title text default '',
  seen boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists shared_notes_report_idx on public.shared_notes(report_id);
alter table public.shared_notes enable row level security;
grant select, update, delete on public.shared_notes to authenticated;
grant usage, select on sequence public.shared_notes_id_seq to authenticated;
drop policy if exists p_admin on public.shared_notes;
create policy p_admin on public.shared_notes for all using (public.is_admin()) with check (public.is_admin());

-- قراءة الإصدار برمزه (للزائر بلا حساب): يُرجع البيانات فقط إن كان الرابط فعّالاً، ويعدّ المشاهدة
create or replace function public.get_shared_report(p_token text, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_token is null or length(p_token) < 16 then return jsonb_build_object('error', 'bad_token'); end if;
  select * into r from public.shared_reports where token = p_token;
  if not found or r.revoked then return jsonb_build_object('error', 'not_found'); end if;
  if r.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if r.pin is not null and r.pin <> coalesce(p_pin, '') then return jsonb_build_object('error', 'pin'); end if;
  update public.shared_reports set views = views + 1, last_viewed_at = now() where id = r.id;
  return jsonb_build_object('id', r.id, 'title', r.title, 'from', r.period_from, 'to', r.period_to, 'issued', r.created_at, 'data', r.data);
end $$;
revoke all on function public.get_shared_report(text, text) from public;
grant execute on function public.get_shared_report(text, text) to anon, authenticated;

-- ملاحظة من الإدارة التنفيذية (بلا حساب) — تُخطر مدير النظام
create or replace function public.add_shared_note(p_token text, p_name text, p_role text, p_body text, p_ref text default '', p_ref_title text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v_name text := left(coalesce(trim(p_name), ''), 80); v_body text := left(coalesce(trim(p_body), ''), 1000);
begin
  select * into r from public.shared_reports where token = p_token and not revoked and expires_at > now();
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_name = '' or v_body = '' then return jsonb_build_object('error', 'empty'); end if;
  if (select count(*) from public.shared_notes where report_id = r.id and created_at > now() - interval '1 hour') > 30 then return jsonb_build_object('error', 'rate'); end if;
  insert into public.shared_notes(report_id, name, role_title, body, ref, ref_title) values (r.id, v_name, left(coalesce(p_role, ''), 80), v_body, left(coalesce(p_ref, ''), 60), left(coalesce(p_ref_title, ''), 160));
  perform public.notify(public.admins() || array[r.created_by], 'exec', 'ملاحظة من الإدارة التنفيذية: ' || v_name || case when coalesce(p_role, '') <> '' then ' (' || left(p_role, 40) || ')' else '' end,
    case when coalesce(p_ref_title, '') <> '' then '«' || left(p_ref_title, 60) || '» — ' else '' end || left(v_body, 200), '#/report?notes=' || r.id);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.add_shared_note(text, text, text, text, text, text) from public;
grant execute on function public.add_shared_note(text, text, text, text, text, text) to anon, authenticated;
