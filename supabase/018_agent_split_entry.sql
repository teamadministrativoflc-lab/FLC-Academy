-- Agent-requested splits across FLC teams. Official Issue Paid credit still
-- requires existing administrative Issue Paid verification.
-- Run in Supabase SQL Editor only after reviewing Preview PR.
CREATE OR REPLACE FUNCTION public.flc_split_partner_roster()
RETURNS TABLE(id uuid,full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT p.id,p.full_name::text
 FROM public.agent_profiles p
 WHERE auth.uid() IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.agent_profiles me WHERE me.id=auth.uid())
   AND p.role<>'admin' AND p.id<>auth.uid()
 ORDER BY p.full_name,p.id;
$$;
REVOKE ALL ON FUNCTION public.flc_split_partner_roster() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_split_partner_roster() TO authenticated;

-- Replace previous agent-only no-splits guard with validated split entry.
-- The primary stays auth.uid(), so a regular agent cannot submit for someone else.
CREATE OR REPLACE FUNCTION public.flc_create_policy(
 p_client_name text,p_carrier text,p_product_type text,p_policy_number text,
 p_lead_source text,p_lead_source_other text,p_annual_premium numeric,
 p_split_agent_id uuid DEFAULT NULL,p_split_primary_pct numeric DEFAULT 100,
 p_submitted_on date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=auth.uid()) THEN
  RAISE EXCEPTION 'Valid agent session required';
 END IF;
 IF p_split_agent_id IS NULL AND p_split_primary_pct<>100 THEN
  RAISE EXCEPTION 'Without a split, primary credit must be 100 percent';
 END IF;
 IF p_split_agent_id IS NOT NULL THEN
  IF p_split_agent_id=auth.uid() THEN
   RAISE EXCEPTION 'Cannot split a policy with yourself';
  END IF;
  IF p_split_primary_pct<=0 OR p_split_primary_pct>=100 THEN
   RAISE EXCEPTION 'Split primary percentage must be between 0 and 100';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=p_split_agent_id AND role<>'admin') THEN
   RAISE EXCEPTION 'Split collaborator must be an existing agent';
  END IF;
 END IF;
 INSERT INTO public.flc_policy_sales(
   agent_id,client_name,carrier,product_type,policy_number,lead_source,
   lead_source_other,annual_premium,split_agent_id,split_primary_pct,submitted_on
 ) VALUES (
   auth.uid(),btrim(p_client_name),btrim(p_carrier),btrim(p_product_type),
   nullif(btrim(p_policy_number),''),p_lead_source,
   nullif(btrim(p_lead_source_other),''),p_annual_premium,
   p_split_agent_id,p_split_primary_pct,p_submitted_on
 ) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date) TO authenticated;
