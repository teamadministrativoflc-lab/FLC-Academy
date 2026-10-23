-- FLC Production Center: admin may select the policy's principal agent.
-- Run after 008. Existing agents still use flc_create_policy for their own sales.
CREATE OR REPLACE FUNCTION public.flc_admin_create_policy(
 p_client_name text,p_carrier text,p_product_type text,p_policy_number text,
 p_lead_source text,p_lead_source_other text,p_annual_premium numeric,
 p_split_agent_id uuid,p_split_primary_pct numeric,p_submitted_on date,p_agent_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=p_agent_id) THEN
   RAISE EXCEPTION 'Invalid principal agent';
 END IF;
 IF p_split_agent_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.agent_profiles WHERE id=p_split_agent_id AND role<>'admin'
 ) THEN RAISE EXCEPTION 'Invalid split agent'; END IF;
 INSERT INTO public.flc_policy_sales (
  agent_id,client_name,carrier,product_type,policy_number,lead_source,lead_source_other,
  annual_premium,split_agent_id,split_primary_pct,submitted_on
 ) VALUES (
  p_agent_id,btrim(p_client_name),btrim(p_carrier),btrim(p_product_type),
  nullif(btrim(p_policy_number),''),p_lead_source,nullif(btrim(p_lead_source_other),''),
  p_annual_premium,p_split_agent_id,p_split_primary_pct,p_submitted_on
 ) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date,uuid) TO authenticated;
