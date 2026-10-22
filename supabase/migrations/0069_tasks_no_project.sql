-- 0069: مهام بلا مشروع (تبسيط الاستخدام): رابط الإشعار يذهب لصفحة المهام عند غياب المشروع
create or replace function public.n_tasks() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.assignee_id is not null then perform public.notify(array[new.assignee_id], 'task', 'مهمة جديدة: ' || new.title, proj_name(new.project_id) || case when new.due_date is not null then ' · الموعد ' || to_char(new.due_date, 'YYYY-MM-DD') else '' end, coalesce('#/project/' || new.project_id || '/tasks', '#/tasks')); end if;
  else
    if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null then perform public.notify(array[new.assignee_id], 'task', 'كُلفت بمهمة: ' || new.title, proj_name(new.project_id), coalesce('#/project/' || new.project_id || '/tasks', '#/tasks')); end if;
    if new.status is distinct from old.status and new.status in ('done', 'in_progress') then perform public.notify(public.admins(), 'task', (case when new.status = 'done' then 'أُنجزت مهمة: ' else 'بدأ العمل على مهمة: ' end) || new.title, proj_name(new.project_id) || ' · ' || pname(auth.uid()), coalesce('#/project/' || new.project_id || '/tasks', '#/tasks')); end if;
  end if;
  return new;
end $$;
