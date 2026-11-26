-- 053 · Atomic sale creation linked to an assigned AuraFlow lead.
-- Safe to install: no policies/leads are changed by this migration alone.
-- All writes happen in ONE transaction when an authorized agent explicitly submits.
BEGIN;

CREATE TABLE IF NOT EXISTS public.flc_distribution_lead_sales (
 lead_id uuid PRIMARY KEY REFERENCES public.flc_distribution_leads(id) ON DELETE RESTRICT,
 policy_id uuid NOT NULL UNIQUE REFERENCES public.flc_policy_sales(id) ON DELETE RESTRICT,
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE RESTRICT,
 linked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flc_distribution_lead_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_distribution_lead_sales FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_create_linked_sale(
 p_lead_id uuid,
 p_carrier text,
 p_product_type text,
 p_policy_number text,
 p_annual_premium numeric,
 p_submitted_on date,
 p_allocations jsonb,
 p_disposition text DEFAULT 'Sometida'
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 v_actor uuid := auth.uid();
 v_lead public.flc_distribution_leads%ROWTYPE;
 v_policy uuid;
 v_number int;
 v_alloc1 uuid;
 v_alloc2 uuid;
 v_primary_pct numeric;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='agent'
 ) THEN
  RAISE EXCEPTION 'Only an authenticated agent can report a linked sale' USING ERRCODE='42501';
 END IF;
 IF p_lead_id IS NULL THEN RAISE EXCEPTION 'Lead is required' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_lead
 FROM public.flc_distribution_leads l
 WHERE l.id=p_lead_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found' USING ERRCODE='22023'; END IF;
 IF v_lead.source_contact_id LIKE 'FLC-PRUEBA-%'
  OR v_lead.source_contact_id LIKE 'FLC-HISTORIAL-%'
  OR v_lead.source_campaign='FLC_TEST_INTEGRACION'
 THEN RAISE EXCEPTION 'Synthetic leads cannot create official production records' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.flc_distribution_assignments a
  WHERE a.lead_id=p_lead_id AND a.agent_id=v_actor AND a.ended_at IS NULL
 ) OR v_lead.status NOT IN ('assigned','paused') THEN
  RAISE EXCEPTION 'Lead is not currently assigned to you' USING ERRCODE='42501';
 END IF;
 IF EXISTS (SELECT 1 FROM public.flc_distribution_lead_sales x WHERE x.lead_id=p_lead_id) THEN
  RAISE EXCEPTION 'A sale has already been reported from this lead; do not create a duplicate'
  USING ERRCODE='23505';
 END IF;
 IF p_disposition NOT IN ('Sometida','Aprobada en pantalla') THEN
  RAISE EXCEPTION 'Invalid initial disposition' USING ERRCODE='22023'; END IF;
 IF p_annual_premium IS NULL OR p_annual_premium<=0 OR round(p_annual_premium,2)<>p_annual_premium THEN
  RAISE EXCEPTION 'Invalid annual premium' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Allocation array is required' USING ERRCODE='22023'; END IF;
 v_number:=jsonb_array_length(p_allocations);
 IF v_number<1 OR v_number>5 THEN RAISE EXCEPTION '1 to 5 participants required'; END IF;
 SELECT (p_allocations->0->>'agent_id')::uuid,(p_allocations->0->>'pct')::numeric INTO v_alloc1,v_primary_pct;
 IF v_alloc1 IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'Primary must be lead owner'; END IF;
 IF (SELECT COALESCE(sum(t.pct),0) FROM jsonb_to_recordset(p_allocations) t(agent_id uuid,pct numeric))<>100
  OR (SELECT count(distinct t.agent_id) FROM jsonb_to_recordset(p_allocations) t(agent_id uuid,pct numeric))<>v_number
  OR EXISTS (
   SELECT 1 FROM jsonb_to_recordset(p_allocations) t(agent_id uuid,pct numeric)
   LEFT JOIN public.agent_profiles p ON p.id=t.agent_id
   WHERE p.id IS NULL OR p.role='admin' OR t.pct IS NULL
     OR t.pct<=0 OR t.pct>100 OR round(t.pct,2)<>t.pct
  )
 THEN RAISE EXCEPTION 'Invalid allocation: unique agents and exactly 100 percent required'; END IF;
 IF v_number=1 THEN
  v_policy:=public.flc_create_policy(
   btrim(concat_ws(' ',v_lead.first_name,v_lead.last_name)),
   p_carrier,p_product_type,p_policy_number,'AuraFlow',NULL,p_annual_premium,
   NULL,100,p_submitted_on
  );
 ELSIF v_number=2 THEN
  v_alloc2:=(p_allocations->1->>'agent_id')::uuid;
  v_policy:=public.flc_create_policy(
   btrim(concat_ws(' ',v_lead.first_name,v_lead.last_name)),
   p_carrier,p_product_type,p_policy_number,'AuraFlow',NULL,p_annual_premium,
   v_alloc2,v_primary_pct,p_submitted_on
  );
 ELSE
  v_policy:=public.flc_create_policy_multi(
   btrim(concat_ws(' ',v_lead.first_name,v_lead.last_name)),
   p_carrier,p_product_type,p_policy_number,'AuraFlow',NULL,p_annual_premium,
   p_submitted_on,p_allocations,v_actor
  );
 END IF;
 IF p_disposition<>'Sometida' THEN
  PERFORM public.flc_set_initial_policy_disposition(v_policy,p_disposition);
 END IF;
 INSERT INTO public.flc_distribution_lead_sales(lead_id,policy_id,agent_id)
 VALUES (p_lead_id,v_policy,v_actor);
 INSERT INTO public.flc_distribution_events(lead_id,agent_id,actor_id,event_type,details)
 VALUES(p_lead_id,v_actor,v_actor,'sale_reported',
   jsonb_build_object('policy_id',v_policy,'annual_premium',p_annual_premium,
   'carrier',p_carrier,'product',p_product_type,'disposition',p_disposition,'crm_synced',false));
 RETURN v_policy;
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_create_linked_sale(uuid,text,text,text,numeric,date,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_create_linked_sale(uuid,text,text,text,numeric,date,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_my_sale_links()
RETURNS TABLE(lead_id uuid,policy_id uuid,linked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT l.lead_id,l.policy_id,l.linked_at
 FROM public.flc_distribution_lead_sales l
 WHERE auth.uid() IS NOT NULL AND (
  l.agent_id=auth.uid() OR EXISTS (
   SELECT 1 FROM public.agent_profiles p WHERE p.id=auth.uid() AND p.role='admin'
  )
 );
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_my_sale_links() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_my_sale_links() TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname IN
 ('flc_distribution_create_linked_sale','flc_distribution_my_sale_links') ORDER BY proname;