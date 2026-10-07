-- ===== العروض التنفيذية: منجزات مستهدفة / مقترحات / تحديثات تُعرض على الجهة التنفيذية برابط حي بلا حساب =====

create table if not exists public.briefs (
  id bigserial primary key,
  kind text not null default 'targets' check (kind in ('targets','proposal','update','other')),
  title text not null,
  subtitle text default '',
  intro text default '',                     -- فقرة تمهيدية تظهر أعلى العرض
  closing text default '',                   -- خاتمة / القرارات المطلوبة
  ref_date date,                             -- الموعد المرجعي (مثل تاريخ الزيارة) لعدّاد الأيام
  ref_label text default 'الموعد المرجعي',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  token text unique,                         -- رابط عام (null = غير منشور)
  pin text,
  expires_at timestamptz,
  views int not null default 0, last_viewed_at timestamptz,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists briefs_token_idx on public.briefs(token) where token is not null;
alter table public.briefs enable row level security;
grant select, insert, update, delete on public.briefs to authenticated;
grant usage, select on sequence public.briefs_id_seq to authenticated;
drop policy if exists p_read on public.briefs;
create policy p_read on public.briefs for select using (public.can_read());
drop policy if exists p_admin on public.briefs;
create policy p_admin on public.briefs for all using (public.is_admin()) with check (public.is_admin());

-- بنود العرض: مرتبطة بمشروع في المنصة (تسحب وضعه حياً) أو حرّة من خارج المنصة
create table if not exists public.brief_items (
  id bigserial primary key,
  brief_id bigint not null references public.briefs(id) on delete cascade,
  sort int not null default 0,
  title text not null,
  project_id uuid references public.projects(id) on delete set null,
  tag text default '',                       -- شريحة الحالة اليدوية (دراسة/حصر/تجهيز/…)؛ تُستنتج من المشروع إن فرغت
  pct int check (pct between 0 and 100),     -- نسبة يدوية للبنود الحرّة
  status_text text default '',               -- الوضع الراهن (يدوي؛ يُكمَّل من المشروع)
  expected text default '',                  -- الإنجاز المتوقع وقت الموعد
  show_text text default '',                 -- ما سيُعرض ميدانياً
  notes text default '',
  target_date date,
  done boolean not null default false,
  updated_at timestamptz default now()
);
create index if not exists brief_items_brief_idx on public.brief_items(brief_id, sort);
alter table public.brief_items enable row level security;
grant select, insert, update, delete on public.brief_items to authenticated;
grant usage, select on sequence public.brief_items_id_seq to authenticated;
drop policy if exists p_read on public.brief_items;
create policy p_read on public.brief_items for select using (public.can_read());
drop policy if exists p_admin on public.brief_items;
create policy p_admin on public.brief_items for all using (public.is_admin()) with check (public.is_admin());

-- ملاحظات الجهة التنفيذية على العرض (بلا حساب)
create table if not exists public.brief_notes (
  id bigserial primary key,
  brief_id bigint not null references public.briefs(id) on delete cascade,
  item_id bigint references public.brief_items(id) on delete set null,
  name text not null, role_title text default '',
  body text not null,
  seen boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists brief_notes_brief_idx on public.brief_notes(brief_id);
alter table public.brief_notes enable row level security;
grant select, update, delete on public.brief_notes to authenticated;
grant usage, select on sequence public.brief_notes_id_seq to authenticated;
drop policy if exists p_admin on public.brief_notes;
create policy p_admin on public.brief_notes for all using (public.is_admin()) with check (public.is_admin());

-- تحديث updated_at
create or replace function public.briefs_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists briefs_touch on public.briefs;
create trigger briefs_touch before update on public.briefs for each row execute function public.briefs_touch();
create or replace function public.brief_items_touch_fn() returns trigger language plpgsql as $$
begin new.updated_at = now(); update public.briefs set updated_at = now() where id = new.brief_id; return new; end $$;
drop trigger if exists brief_items_touch on public.brief_items;
create trigger brief_items_touch before update on public.brief_items for each row execute function public.brief_items_touch_fn();

-- قراءة العرض برمزه (للزائر بلا حساب): بيانات المشاريع المرتبطة تُقرأ حيّة وقت الفتح
create or replace function public.get_brief(p_token text, p_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; v_items jsonb;
begin
  if p_token is null or length(p_token) < 16 then return jsonb_build_object('error', 'bad_token'); end if;
  select * into b from public.briefs where token = p_token;
  if not found or b.status <> 'published' then return jsonb_build_object('error', 'not_found'); end if;
  if b.expires_at is not null and b.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if b.pin is not null and b.pin <> coalesce(p_pin, '') then return jsonb_build_object('error', 'pin'); end if;
  update public.briefs set views = views + 1, last_viewed_at = now() where id = b.id;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'sort', i.sort, 'title', i.title, 'tag', i.tag, 'pct', i.pct, 'status_text', i.status_text,
      'expected', i.expected, 'show_text', i.show_text, 'notes', i.notes, 'target_date', i.target_date, 'done', i.done,
      'project', case when p.id is null then null else jsonb_build_object(
        'name', p.name, 'stage', p.stage, 'pa', p.progress_actual, 'pl', p.progress_planned,
        'end', coalesce(p.revised_end_date, p.end_date), 'start', p.start_date, 'contractor', p.contractor, 'facility', p.facility,
        'status_note', p.status_note, 'late', (p.stage = 'execution' and (coalesce(p.status_note, '') <> '' or coalesce(p.revised_end_date, p.end_date) < current_date))) end
    ) order by i.sort, i.id), '[]'::jsonb) into v_items
  from public.brief_items i left join public.projects p on p.id = i.project_id where i.brief_id = b.id;
  return jsonb_build_object('id', b.id, 'kind', b.kind, 'title', b.title, 'subtitle', b.subtitle, 'intro', b.intro, 'closing', b.closing,
    'ref_date', b.ref_date, 'ref_label', b.ref_label, 'issued', b.created_at, 'updated', b.updated_at, 'items', v_items,
    'by', public.pname(b.created_by));
end $$;
revoke all on function public.get_brief(text, text) from public;
grant execute on function public.get_brief(text, text) to anon, authenticated;

-- ملاحظة من الجهة التنفيذية (بلا حساب) — تُخطر مدير النظام ومُعدّ العرض
create or replace function public.add_brief_note(p_token text, p_name text, p_role text, p_body text, p_item bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; v_name text := left(coalesce(trim(p_name), ''), 80); v_body text := left(coalesce(trim(p_body), ''), 1000); v_it text := '';
begin
  select * into b from public.briefs where token = p_token and status = 'published' and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_name = '' or v_body = '' then return jsonb_build_object('error', 'empty'); end if;
  if (select count(*) from public.brief_notes where brief_id = b.id and created_at > now() - interval '1 hour') > 30 then return jsonb_build_object('error', 'rate'); end if;
  if p_item is not null then select left(title, 80) into v_it from public.brief_items where id = p_item and brief_id = b.id; end if;
  insert into public.brief_notes(brief_id, item_id, name, role_title, body) values (b.id, case when v_it <> '' then p_item else null end, v_name, left(coalesce(p_role, ''), 80), v_body);
  perform public.notify(public.admins() || array[b.created_by], 'exec', 'ملاحظة على عرض «' || left(b.title, 50) || '»: ' || v_name || case when coalesce(p_role, '') <> '' then ' (' || left(p_role, 40) || ')' else '' end,
    case when v_it <> '' then '«' || v_it || '» — ' else '' end || left(v_body, 200), '#/briefs/' || b.id || '?notes=1');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.add_brief_note(text, text, text, text, bigint) from public;
grant execute on function public.add_brief_note(text, text, text, text, bigint) to anon, authenticated;
