-- آخر نشاط لكل مشروع (لمؤشر «بلا تحديث منذ أسبوعين»)
create or replace view public.v_project_activity with (security_invoker = true) as
select p.id as project_id,
  greatest(p.updated_at,
    coalesce((select max(u.created_at) from public.project_updates u where u.project_id = p.id), p.created_at),
    coalesce((select max(l.at) from public.project_stage_log l where l.project_id = p.id), p.created_at),
    coalesce((select max(t.updated_at) from public.tasks t where t.project_id = p.id), p.created_at),
    coalesce((select max(r.updated_at) from public.requests r where r.project_id = p.id), p.created_at),
    coalesce((select max(c.updated_at) from public.challenges c where c.project_id = p.id), p.created_at),
    coalesce((select max(b.updated_at) from public.boqs b where b.project_id = p.id), p.created_at)
  ) as last_activity
from public.projects p;
grant select on public.v_project_activity to authenticated;
