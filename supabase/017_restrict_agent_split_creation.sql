-- Security hardening: only Administration can allocate split partners on creation.
-- Agents can still submit their own policies without splits.
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
 IF NOT public.flc_is_admin() AND (p_split_agent_id IS NOT NULL OR p_split_primary_pct<>100) THEN
  RAISE EXCEPTION 'Only Administration can assign splits';
 END IF;
 IF p_split_agent_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.agent_profiles WHERE id=p_split_agent_id AND role<>'admin'
 ) THEN
  RAISE EXCEPTION 'Split collaborator must be an existing agent';
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
REVOKE ALL ON FUNCTION public.flc_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date)
 TO authenticated;
