-- دور «إداري»: اطلاع + طباعة التقارير + رفع الخطابات والمستندات الرسمية فقط
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','engineer','viewer','finance','clerk','pending','disabled'));
create or replace function public.can_read() returns boolean language sql stable as $$ select public.my_role() in ('admin','engineer','viewer','finance','clerk') $$;
create or replace function public.can_docs() returns boolean language sql stable as $$ select public.my_role() in ('admin','engineer','clerk') $$;
drop policy if exists p_ins on public.documents; drop policy if exists p_upd on public.documents;
create policy p_ins on public.documents for insert with check (public.can_docs() and created_by = auth.uid());
create policy p_upd on public.documents for update using (public.is_admin() or (public.can_docs() and created_by = auth.uid())) with check (public.is_admin() or (public.can_docs() and created_by = auth.uid()));
do $$ begin
  drop policy if exists pf_ins on storage.objects;
  create policy pf_ins on storage.objects for insert to authenticated with check (bucket_id = 'project-files' and public.can_docs());
  raise notice 'STORAGE_OK clerk';
exception when others then raise notice 'STORAGE_FAILED: %', sqlerrm; end $$;
