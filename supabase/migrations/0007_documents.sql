-- المستندات الرسمية + المخططات + الاعتمادات (Submittals)
create table if not exists public.documents (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  category text not null default 'other' check (category in ('contract','site_handover','initial_handover','final_handover','bank_guarantee','insurance','letter_in','letter_out','change_order','extension','minutes','other')),
  title text not null default '', doc_no text default '', doc_date date, party text default '',
  expiry_date date, amount numeric(16,2), days int, reply_due date, replied_on date,
  notes text default '',
  path text, link text, file_name text, file_size bigint,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists documents_project_idx on public.documents(project_id);

create table if not exists public.drawings (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  discipline text not null default 'arch' check (discipline in ('arch','struct','mech','elec','civil','plumb','fire','medgas','ict','landscape','other')),
  dwg_no text default '', title text not null default '',
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists drawings_project_idx on public.drawings(project_id);
create table if not exists public.drawing_revisions (
  id bigserial primary key,
  drawing_id bigint references public.drawings(id) on delete cascade,
  rev text not null default 'A',
  status text not null default 'for_approval' check (status in ('design','for_approval','approved','approved_notes','rejected','as_built','superseded')),
  issued_on date default current_date, note text default '',
  path text, link text, file_name text, file_size bigint,
  created_by uuid, created_at timestamptz default now()
);
create index if not exists drawing_revisions_idx on public.drawing_revisions(drawing_id);

create table if not exists public.submittals (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  no int not null default 1, rev int not null default 0, parent_id bigint references public.submittals(id) on delete set null,
  kind text not null default 'material' check (kind in ('material','shop_drawing','method','subcontractor','supplier','other')),
  title text not null default '', description text default '', spec_ref text default '', spec_title text default '',
  submitted_by text default '', submitted_on date default current_date, due_on date,
  engineer_note text default '', engineer_recommend text check (engineer_recommend in ('approve','approve_notes','resubmit','reject')), engineer_by uuid, engineer_at timestamptz,
  decision text check (decision in ('approved','approved_notes','resubmit','rejected')), decision_note text default '', decided_by uuid, decided_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted','reviewed','decided')),
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists submittals_project_idx on public.submittals(project_id);
create table if not exists public.submittal_files (
  id bigserial primary key,
  submittal_id bigint references public.submittals(id) on delete cascade,
  side text not null default 'submitted' check (side in ('submitted','response')),
  path text, link text, file_name text, file_size bigint,
  created_by uuid, created_at timestamptz default now()
);

-- triggers
do $$ declare t text; begin
  foreach t in array array['documents','drawings','submittals'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s; create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch();', t);
    execute format('drop trigger if exists audit_%1$s on public.%1$s; create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit();', t);
  end loop;
end $$;

-- RLS
do $$ declare t text; begin
  foreach t in array array['documents','drawings','drawing_revisions','submittals','submittal_files'] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists p_read on public.%1$s; drop policy if exists p_ins on public.%1$s; drop policy if exists p_upd on public.%1$s; drop policy if exists p_del on public.%1$s;', t);
    execute format('create policy p_read on public.%1$s for select using (public.can_read())', t);
    execute format('create policy p_ins on public.%1$s for insert with check (public.can_edit())', t);
    execute format('create policy p_upd on public.%1$s for update using (public.can_edit()) with check (public.can_edit())', t);
    execute format('create policy p_del on public.%1$s for delete using (public.is_admin() or created_by = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%1$s to authenticated', t);
    execute format('grant usage, select on sequence public.%1$s_id_seq to authenticated', t);
  end loop;
end $$;

-- قرار الاعتماد من صلاحية الإدارة فقط
create or replace function public.guard_submittal() returns trigger language plpgsql as $$
begin
  if public.is_admin() then return new; end if;
  if new.decision is distinct from old.decision or new.decision_note is distinct from old.decision_note or new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at or (new.status = 'decided' and old.status <> 'decided') then
    raise exception 'قرار الاعتماد من صلاحية الإدارة';
  end if;
  return new;
end $$;
drop trigger if exists guard_submittal_trg on public.submittals;
create trigger guard_submittal_trg before update on public.submittals for each row execute function public.guard_submittal();

-- مدة الرد الافتراضية للاعتمادات (أيام)
insert into public.settings(key, value) values ('submittal_sla_days', '7'::jsonb) on conflict (key) do nothing;

-- مخزن ملفات المشاريع (خاص، حتى 50 ميجابايت للملف)
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('project-files', 'project-files', false, 52428800)
  on conflict (id) do nothing;
  drop policy if exists pf_read on storage.objects; drop policy if exists pf_ins on storage.objects; drop policy if exists pf_del on storage.objects; drop policy if exists pf_upd on storage.objects;
  create policy pf_read on storage.objects for select to authenticated using (bucket_id = 'project-files' and public.can_read());
  create policy pf_ins on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and public.can_edit());
  create policy pf_upd on storage.objects for update to authenticated using (bucket_id = 'project-files' and (public.is_admin() or owner = auth.uid()));
  create policy pf_del on storage.objects for delete to authenticated using (bucket_id = 'project-files' and (public.is_admin() or owner = auth.uid()));
  raise notice 'STORAGE_OK project-files';
exception when others then
  raise notice 'STORAGE_FAILED: %', sqlerrm;
end $$;
