-- FLC Academy / phase 2: authenticated telemetry via constrained RPC functions.
-- Run in Supabase SQL Editor AFTER 001_read_policies.sql.
-- No client receives direct write privileges on tracking tables.
create or replace function public.flc_log_login()
returns void language plpgsql security definer set search_path = ''
as $$
begin
 if (select auth.uid()) is null then raise exception 'authentication required'; end if;
 if not exists (select 1 from public.agent_profiles where id=(select auth.uid())) then
  raise exception 'missing agent profile';
 end if;
 insert into public.login_activity(agent_id) values((select auth.uid()));
end $$;
revoke all on function public.flc_log_login() from public,anon;
grant execute on function public.flc_log_login() to authenticated;

create or replace function public.flc_set_module_progress(p_module_id text,p_progress integer)
returns void language plpgsql security definer set search_path = ''
as $$
declare prev integer;
begin
 if (select auth.uid()) is null then raise exception 'authentication required'; end if;
 if not exists (select 1 from public.agent_profiles where id=(select auth.uid())) then
  raise exception 'missing agent profile';
 end if;
 if p_module_id is null or p_module_id not in ('m1','m2','m3') then
  raise exception 'unrecognized module';
 end if;
 if p_progress not in (0,50,100) then raise exception 'invalid progress'; end if;
 insert into public.module_progress(agent_id,module_id,progress_percent,started_at,completed_at,updated_at)
 values ((select auth.uid()),p_module_id,p_progress,
 case when p_progress>0 then now() else null end,
 case when p_progress=100 then now() else null end,now())
 on conflict(agent_id,module_id) do update set
  progress_percent=excluded.progress_percent,
  started_at=coalesce(public.module_progress.started_at,excluded.started_at),
  completed_at=case when excluded.progress_percent=100 then coalesce(public.module_progress.completed_at,now()) else null end,
  updated_at=now();
end $$;
revoke all on function public.flc_set_module_progress(text,integer) from public,anon;
grant execute on function public.flc_set_module_progress(text,integer) to authenticated;

-- These are USER-DECLARED progression milestones. They are not video completion evidence.
