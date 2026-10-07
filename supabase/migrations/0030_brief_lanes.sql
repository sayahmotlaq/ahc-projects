-- ===== العروض التنفيذية: مسار المشتريات ومسار المالية والتحدي لكل بند (تحديث دوري، مع تاريخ آخر تحديث) =====
alter table public.brief_items
  add column if not exists proc_stage text not null default '' ,
  add column if not exists proc_note text not null default '',
  add column if not exists fin_stage text not null default '',
  add column if not exists fin_note text not null default '',
  add column if not exists challenge text not null default '',
  add column if not exists needs_decision boolean not null default false,
  add column if not exists lanes_at timestamptz;

-- يُسجَّل تاريخ آخر تحديث للمسارات تلقائياً عند تغيّر أي من حقولها
create or replace function public.brief_items_touch_fn() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' and (new.proc_stage is distinct from old.proc_stage or new.proc_note is distinct from old.proc_note or new.fin_stage is distinct from old.fin_stage or new.fin_note is distinct from old.fin_note or new.challenge is distinct from old.challenge or new.needs_decision is distinct from old.needs_decision) then new.lanes_at = now(); end if;
  update public.briefs set updated_at = now() where id = new.brief_id; return new;
end $$;

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
      'proc_stage', i.proc_stage, 'proc_note', i.proc_note, 'fin_stage', i.fin_stage, 'fin_note', i.fin_note, 'challenge', i.challenge, 'needs_decision', i.needs_decision, 'lanes_at', i.lanes_at,
      'project', case when p.id is null then null else jsonb_build_object(
        'name', p.name, 'stage', p.stage, 'pa', p.progress_actual, 'pl', p.progress_planned,
        'end', coalesce(p.revised_end_date, p.end_date), 'start', p.start_date, 'contractor', p.contractor, 'facility', p.facility,
        'status_note', p.status_note, 'tender', p.tender_date, 'late', (p.stage = 'execution' and (coalesce(p.status_note, '') <> '' or coalesce(p.revised_end_date, p.end_date) < current_date))) end
    ) order by i.sort, i.id), '[]'::jsonb) into v_items
  from public.brief_items i left join public.projects p on p.id = i.project_id where i.brief_id = b.id;
  return jsonb_build_object('id', b.id, 'kind', b.kind, 'title', b.title, 'subtitle', b.subtitle, 'intro', b.intro, 'closing', b.closing,
    'ref_date', b.ref_date, 'ref_label', b.ref_label, 'issued', b.created_at, 'updated', b.updated_at, 'items', v_items,
    'by', public.pname(b.created_by));
end $$;
