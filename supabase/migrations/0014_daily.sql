-- «يومي»: آخر زيارة + ملخص الصباح وختام اليوم
alter table public.profiles add column if not exists last_seen timestamptz;

create or replace function public.daily_digest(p_kind text) returns int language plpgsql security definer set search_path = public as $$
declare u record; n int := 0; c int; v_body text; v_title text; dow int;
  acts text;
begin
  dow := extract(dow from (now() at time zone 'Asia/Riyadh'));
  if dow in (5, 6) then return 0; end if; -- الجمعة والسبت
  for u in select id, full_name, role, notify_prefs from public.profiles where role in ('admin','engineer','clerk','finance') loop
    if coalesce((u.notify_prefs->>'digest')::boolean, true) = false then continue; end if;
    if exists (select 1 from public.notifications where user_id = u.id and kind = 'digest' and notifications.title like (case when p_kind = 'morning' then 'صباح%' else 'ختام%' end) and created_at::date = (now() at time zone 'Asia/Riyadh')::date) then continue; end if;
    if p_kind = 'morning' then
      select count(*) into c from (
        select 1 from public.tasks t where t.assignee_id = u.id and t.status in ('open','in_progress') and t.due_date <= current_date
        union all select 1 from public.requests r where u.role = 'admin' and r.status in ('new','in_review')
        union all select 1 from public.payments p where (u.role = 'admin' and p.status in ('submitted','review','approved')) or (u.role = 'finance' and p.status = 'finance')
        union all select 1 from public.submittals s where (u.role = 'admin' and s.status = 'reviewed') or (u.role <> 'admin' and s.status = 'submitted' and exists (select 1 from public.projects pj where pj.id = s.project_id and pj.engineer_id = u.id))
        union all select 1 from public.tech_reports tr where u.role = 'admin' and tr.status = 'published'
      ) x;
      acts := case when c = 1 then 'إجراء واحد' when c = 2 then 'إجراءان' when c between 3 and 10 then c || ' إجراءات' else c || ' إجراءً' end;
      v_title := 'صباح الخير ' || split_part(coalesce(u.full_name, ''), ' ', 1) || case when c = 0 then ' — لا شيء معلق عليك اليوم' else ' — عليك اليوم ' || acts end;
      v_body := case when c = 0 then 'يوم هادئ. افتح «يومي» لترى مواعيد الأسبوع.' else 'افتح «يومي» لترى التفاصيل مرتبة بالأولوية.' end;
    else
      select count(*) into c from public.v_user_activity a where a.user_id = u.id and a.at >= (now() at time zone 'Asia/Riyadh')::date;
      if c = 0 and u.role <> 'admin' then continue; end if;
      acts := case when c = 1 then 'إجراء واحد' when c = 2 then 'إجراءان' when c between 3 and 10 then c || ' إجراءات' else c || ' إجراءً' end;
      v_title := 'ختام اليوم ' || split_part(coalesce(u.full_name, ''), ' ', 1) || case when c = 0 then '' else ' — أنجزت اليوم ' || acts || ' موثقة باسمك' end;
      v_body := case when c = 0 then 'لم يُسجَّل إجراء اليوم. غداً يوم جديد.' when c >= 8 then 'يوم مثمر، شكراً على جهدك.' else 'شكراً على جهدك، كل إجراء يحسب لك.' end;
    end if;
    insert into public.notifications(user_id, kind, title, body, link) values (u.id, 'digest', v_title, v_body, '#/today'); n := n + 1;
  end loop;
  return n;
end $$;
