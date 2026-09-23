-- المهام (من الإدارة للمهندسين) والطلبات (من المهندسين للإدارة)
create table if not exists public.tasks (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null, details text,
  assignee_id uuid references public.profiles(id), assignee_name text,
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  status text default 'open' check (status in ('open','in_progress','done','cancelled')),
  due_date date, done_at timestamptz, progress_note text,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id);

create table if not exists public.requests (
  id bigserial primary key,
  project_id uuid references public.projects(id) on delete cascade,
  kind text default 'approval' check (kind in ('approval','review','decision','support','other')),
  title text not null, details text,
  priority text default 'normal' check (priority in ('low','normal','high','urgent')),
  status text default 'new' check (status in ('new','in_review','approved','rejected','done')),
  due_date date, response text, responded_by uuid, responded_at timestamptz,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists requests_project_idx on public.requests(project_id);

create table if not exists public.request_replies (
  id bigserial primary key, request_id bigint references public.requests(id) on delete cascade,
  body text not null, status_after text, by_user uuid, at timestamptz default now()
);

alter table public.tasks enable row level security;
alter table public.requests enable row level security;
alter table public.request_replies enable row level security;
do $$ declare t text; begin
  foreach t in array array['tasks','requests','request_replies'] loop
    execute format('drop policy if exists p_read on public.%I', t);
    execute format('drop policy if exists p_ins on public.%I', t);
    execute format('drop policy if exists p_upd on public.%I', t);
    execute format('drop policy if exists p_del on public.%I', t);
  end loop; end $$;

-- المهام: قراءة للجميع المعتمدين؛ إنشاء/حذف للأدمن؛ تعديل للأدمن أو المكلّف (يقيّده المُشغّل أدناه)
create policy p_read on public.tasks for select using (public.can_read());
create policy p_ins on public.tasks for insert with check (public.is_admin());
create policy p_upd on public.tasks for update using (public.is_admin() or assignee_id = auth.uid()) with check (public.is_admin() or assignee_id = auth.uid());
create policy p_del on public.tasks for delete using (public.is_admin());
create or replace function public.guard_task_update() returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    if new.title is distinct from old.title or new.details is distinct from old.details or new.assignee_id is distinct from old.assignee_id
       or new.priority is distinct from old.priority or new.due_date is distinct from old.due_date or new.project_id is distinct from old.project_id
       or new.status = 'cancelled' then
      raise exception 'يمكن للمكلّف تحديث حالة المهمة وملاحظة الإنجاز فقط';
    end if;
  end if;
  if new.status = 'done' and old.status <> 'done' then new.done_at := now(); end if;
  new.updated_at := now(); return new;
end $$;
drop trigger if exists guard_task on public.tasks;
create trigger guard_task before update on public.tasks for each row execute function public.guard_task_update();

-- الطلبات: إنشاء لمن يحق له التعديل؛ تعديل للأدمن، أو لصاحب الطلب ما دام «جديد»؛ حذف للأدمن أو صاحبه وهو جديد
create policy p_read on public.requests for select using (public.can_read());
create policy p_ins on public.requests for insert with check (public.can_edit() and created_by = auth.uid());
create policy p_upd on public.requests for update using (public.is_admin() or (created_by = auth.uid() and status = 'new')) with check (public.is_admin() or created_by = auth.uid());
create policy p_del on public.requests for delete using (public.is_admin() or (created_by = auth.uid() and status = 'new'));
create or replace function public.guard_request_update() returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    if new.status is distinct from old.status or new.response is distinct from old.response then
      raise exception 'الرد على الطلب وتغيير حالته من صلاحية الإدارة';
    end if;
  else
    if new.status is distinct from old.status or new.response is distinct from old.response then new.responded_by := auth.uid(); new.responded_at := now(); end if;
  end if;
  new.updated_at := now(); return new;
end $$;
drop trigger if exists guard_request on public.requests;
create trigger guard_request before update on public.requests for each row execute function public.guard_request_update();

create policy p_read on public.request_replies for select using (public.can_read());
create policy p_ins on public.request_replies for insert with check (public.can_edit() and by_user = auth.uid());
create policy p_del on public.request_replies for delete using (public.is_admin());

do $$ declare t text; begin
  foreach t in array array['tasks','requests'] loop
    execute format('drop trigger if exists audit_%s on public.%I', t, t);
    execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit()', t, t);
  end loop; end $$;
grant select, insert, update, delete on public.tasks, public.requests, public.request_replies to authenticated;
grant usage, select on sequence public.tasks_id_seq, public.requests_id_seq, public.request_replies_id_seq to authenticated;
