-- FLC Academy / Phase 1: read-only client access, protected writes.
-- Run ONLY after the six tables from the initial setup exist.
-- Existing tables are empty; this script does not create agents.
-- Application writes will be implemented through a validated server endpoint.
-- Do not grant INSERT/UPDATE/DELETE to regular authenticated users.

create or replace function public.flc_is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.agent_profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.flc_is_admin() from public, anon;
grant execute on function public.flc_is_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'agent_profiles','login_activity','module_progress',
    'training_events','quiz_attempts','certificates'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists flc_read_own_or_admin on public.%I', t);
    if t = 'agent_profiles' then
      execute format(
        'create policy flc_read_own_or_admin on public.%I for select to authenticated using (id = (select auth.uid()) or (select public.flc_is_admin()))',t
      );
    else
      execute format(
        'create policy flc_read_own_or_admin on public.%I for select to authenticated using (agent_id = (select auth.uid()) or (select public.flc_is_admin()))',t
      );
    end if;
  end loop;
end $$;

-- Once the owner's account exists in auth.users, create the
-- matching profile and assign admin from the privileged SQL Editor.
-- Never allow a client to set its own role.
-- Do not embed service_role keys in front-end JavaScript.
