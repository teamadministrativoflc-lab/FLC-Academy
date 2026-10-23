-- FLC Production Center / Phase 1: private policy registry.
-- Run in Supabase SQL Editor. No existing Academy table is modified.
CREATE TABLE IF NOT EXISTS public.flc_policy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
  client_name text NOT NULL CHECK (length(btrim(client_name)) BETWEEN 2 AND 150),
  carrier text NOT NULL CHECK (length(btrim(carrier)) BETWEEN 2 AND 100),
  product_type text NOT NULL CHECK (length(btrim(product_type)) BETWEEN 2 AND 80),
  policy_number text,
  lead_source text NOT NULL CHECK (lead_source IN (
   'AuraFlow','LifeButton','LeadzTech AI','Ecomfy','Leads for Life',
   'Propia campaña','Referido','Familiar / Amistad','Otro'
  )),
  lead_source_other text,
  status text NOT NULL DEFAULT 'Sometida' CHECK(status IN (
   'Sometida','En revisión','Pendiente requisito','Aprobada','Issue Paid','Declinada','Cancelada','Chargeback'
  )),
  annual_premium numeric(14,2) NOT NULL CHECK (annual_premium>0),
  split_agent_id uuid REFERENCES public.agent_profiles(id),
  split_primary_pct numeric(5,2) NOT NULL DEFAULT 100 CHECK(split_primary_pct>0 AND split_primary_pct<=100),
  submitted_on date NOT NULL DEFAULT CURRENT_DATE,
  approved_on date,
  issue_paid_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flc_policy_split_valid CHECK (
    (split_agent_id IS NULL AND split_primary_pct=100)
    OR (split_agent_id IS NOT NULL AND split_agent_id<>agent_id AND split_primary_pct<100)
  ),
  CONSTRAINT flc_policy_other_source CHECK(lead_source<>'Otro' OR nullif(btrim(lead_source_other),'') IS NOT NULL),
  CONSTRAINT flc_policy_number_valid CHECK(policy_number IS NULL OR length(btrim(policy_number)) BETWEEN 2 AND 80)
);
-- One policy per carrier, irrespective of which agent registers it.
CREATE UNIQUE INDEX IF NOT EXISTS flc_policy_sales_carrier_number_unique
 ON public.flc_policy_sales(lower(btrim(carrier)),lower(btrim(policy_number)))
 WHERE policy_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS flc_policy_sales_agent_idx ON public.flc_policy_sales(agent_id,submitted_on);
CREATE INDEX IF NOT EXISTS flc_policy_sales_split_idx ON public.flc_policy_sales(split_agent_id);
ALTER TABLE public.flc_policy_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_policy_sales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_policy_sales TO authenticated;

-- Scoped access: admin, submitting agent, split participant, or upline leader.
CREATE OR REPLACE FUNCTION public.flc_can_view_policy_agent(p_agent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 WITH RECURSIVE upline(id,path) AS (
   SELECT p_agent_id,ARRAY[p_agent_id]::uuid[]
   UNION ALL
   SELECT a.leader_id,u.path||a.leader_id
   FROM public.flc_team_assignments a JOIN upline u ON a.agent_id=u.id
   WHERE NOT a.leader_id=ANY(u.path)
 )
 SELECT auth.uid() IS NOT NULL AND (
   public.flc_is_admin()
   OR p_agent_id=auth.uid()
   OR (public.flc_is_team_leader() AND EXISTS(SELECT 1 FROM upline WHERE id=auth.uid()))
 );
$$;
REVOKE ALL ON FUNCTION public.flc_can_view_policy_agent(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_can_view_policy_agent(uuid) TO authenticated;

DROP POLICY IF EXISTS flc_policy_sales_read ON public.flc_policy_sales;
CREATE POLICY flc_policy_sales_read ON public.flc_policy_sales FOR SELECT TO authenticated
 USING (public.flc_can_view_policy_agent(agent_id)
     OR (split_agent_id=auth.uid()));

-- Agents create only their own submitted policies; status changes reserved for Admin.
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
 IF p_split_agent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=p_split_agent_id AND role<>'admin') THEN
  RAISE EXCEPTION 'Split collaborator must be an existing agent';
 END IF;
 INSERT INTO public.flc_policy_sales(agent_id,client_name,carrier,product_type,policy_number,
  lead_source,lead_source_other,annual_premium,split_agent_id,split_primary_pct,submitted_on)
 VALUES(auth.uid(),btrim(p_client_name),btrim(p_carrier),btrim(p_product_type),
  nullif(btrim(p_policy_number),''),p_lead_source,nullif(btrim(p_lead_source_other),''),
  p_annual_premium,p_split_agent_id,p_split_primary_pct,p_submitted_on)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_create_policy(text,text,text,text,text,text,numeric,uuid,numeric,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_update_policy_status(
 p_sale_id uuid,p_status text,p_approved_on date DEFAULT NULL,p_issue_paid_on date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 UPDATE public.flc_policy_sales SET status=p_status,approved_on=p_approved_on,
 issue_paid_on=p_issue_paid_on,updated_at=now() WHERE id=p_sale_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_update_policy_status(uuid,text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_update_policy_status(uuid,text,date,date) TO authenticated;
