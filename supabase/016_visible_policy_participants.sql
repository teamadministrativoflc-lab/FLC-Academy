-- Only reveal names of participants on policies the signed-in user may view.
CREATE OR REPLACE FUNCTION public.flc_visible_policy_participants()
RETURNS TABLE(policy_id uuid,primary_name text,split_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT s.id,p.full_name::text,sp.full_name::text
 FROM public.flc_policy_sales s
 JOIN public.agent_profiles p ON p.id=s.agent_id
 LEFT JOIN public.agent_profiles sp ON sp.id=s.split_agent_id
 WHERE auth.uid() IS NOT NULL
  AND (public.flc_can_view_policy_agent(s.agent_id) OR s.split_agent_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.flc_visible_policy_participants() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_visible_policy_participants() TO authenticated;
