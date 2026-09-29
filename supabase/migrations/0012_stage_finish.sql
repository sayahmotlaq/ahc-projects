-- بعد الاستلام الابتدائي يُعتبر المشروع منتهياً: تُمسح حالة التأخر ويُثبّت الإنجاز 100%
create or replace function public.set_stage(p_id uuid, p_stage text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_stage text; eng uuid;
begin
  select stage, engineer_id into old_stage, eng from public.projects where id = p_id;
  if not (public.is_admin() or (public.can_edit() and eng = auth.uid())) then raise exception 'تغيير المرحلة من صلاحية الإدارة أو مهندس المشروع'; end if;
  update public.projects set stage = p_stage,
    status_note = case when p_stage in ('handover','warranty','closed','cancelled') then null else status_note end,
    progress_actual = case when p_stage in ('handover','warranty','closed') then 100 else progress_actual end,
    progress_planned = case when p_stage in ('handover','warranty','closed') then 100 else progress_planned end
  where id = p_id;
  insert into public.project_stage_log(project_id, from_stage, to_stage, note, by_user) values (p_id, old_stage, p_stage, p_note, auth.uid());
end $$;
-- تصحيح المشاريع الحالية التي تجاوزت التنفيذ وما زالت موسومة بالتأخر
update public.projects set status_note = null where stage in ('handover','warranty','closed','cancelled') and status_note is not null;
update public.projects set progress_actual = 100, progress_planned = 100 where stage in ('handover','warranty','closed') and (coalesce(progress_actual,0) < 100 or coalesce(progress_planned,0) < 100);
