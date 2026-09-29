-- ملكية المشاريع: المهندس ينشئ مشاريعه ويعدّل مشاريعه فقط؛ الإدارة كل شيء
drop policy if exists p_edit_ins on public.projects; drop policy if exists p_edit_upd on public.projects;
create policy p_edit_ins on public.projects for insert with check (public.is_admin() or (public.can_edit() and engineer_id = auth.uid()));
create policy p_edit_upd on public.projects for update using (public.is_admin() or (public.can_edit() and engineer_id = auth.uid())) with check (public.is_admin() or (public.can_edit() and engineer_id = auth.uid()));

-- تغيير المرحلة: الإدارة أو مهندس المشروع
create or replace function public.set_stage(p_id uuid, p_stage text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_stage text; eng uuid;
begin
  select stage, engineer_id into old_stage, eng from public.projects where id = p_id;
  if not (public.is_admin() or (public.can_edit() and eng = auth.uid())) then raise exception 'تغيير المرحلة من صلاحية الإدارة أو مهندس المشروع'; end if;
  update public.projects set stage = p_stage where id = p_id;
  insert into public.project_stage_log(project_id, from_stage, to_stage, note, by_user) values (p_id, old_stage, p_stage, p_note, auth.uid());
end $$;

-- ربط المشاريع بحسابات المهندسين بمطابقة الأسماء (مرة واحدة لما لم يُربط بعد)
create or replace function public.norm_name(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(translate(lower(coalesce(t, '')), 'أإآةى', 'اااهي'), '\s+', ' ', 'g'), '^(م\.|م |المهندس |مهندس |م\. )+', ''), '[^\w\s]', '', 'g') $$;
do $$ declare r record; pid uuid; n int := 0; begin
  for r in select id, engineer_name from public.projects where engineer_id is null and coalesce(engineer_name, '') <> '' loop
    select p.id into pid from public.profiles p where p.role in ('engineer', 'admin') and (
      public.norm_name(p.full_name) = public.norm_name(r.engineer_name)
      or (public.norm_name(p.full_name) like '%' || split_part(public.norm_name(r.engineer_name), ' ', 1) || '%' and public.norm_name(p.full_name) like '%' || split_part(public.norm_name(r.engineer_name), ' ', array_length(string_to_array(public.norm_name(r.engineer_name), ' '), 1)) || '%')
    ) limit 1;
    if pid is not null then update public.projects set engineer_id = pid where id = r.id; n := n + 1; raise notice 'LINKED: % -> %', r.engineer_name, pid; end if;
  end loop;
  raise notice 'LINK_DONE: % projects linked', n;
end $$;
