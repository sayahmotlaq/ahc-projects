-- 0068: تبسيط الاستخدام — المهندس ينشئ مهام لنفسه أو على مشاريعه (لا للمدير فقط)، ويعدّل ما أنشأه
drop policy if exists p_ins on public.tasks;
create policy p_ins on public.tasks for insert with check (
  public.is_admin()
  or (public.can_edit() and (assignee_id = auth.uid() or exists (select 1 from public.projects p where p.id = project_id and p.engineer_id = auth.uid())))
);
drop policy if exists p_upd on public.tasks;
create policy p_upd on public.tasks for update using (public.is_admin() or assignee_id = auth.uid() or created_by = auth.uid())
  with check (public.is_admin() or assignee_id = auth.uid() or created_by = auth.uid());
drop policy if exists p_del on public.tasks;
create policy p_del on public.tasks for delete using (public.is_admin() or created_by = auth.uid());
