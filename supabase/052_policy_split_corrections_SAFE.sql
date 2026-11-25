-- 052: Correct missing/incorrect splits on an EXISTING policy.
-- Does not execute a correction on installation.
-- Primary agent may edit pre-verification; verified policies require admin review.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flc_policy_split_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.flc_policy_sales(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES public.agent_profiles(id),
  previous_allocations jsonb NOT NULL,
  requested_allocations jsonb NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
  state text NOT NULL CHECK (state IN ('applied','pending','approved','rejected')),
  reviewed_by uuid REFERENCES public.agent_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_split_corrections_policy_time
 ON public.flc_policy_split_corrections(policy_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS flc_split_one_pending_per_policy
 ON public.flc_policy_split_corrections(policy_id) WHERE state='pending';
ALTER TABLE public.flc_policy_split_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_policy_split_corrections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_policy_split_corrections TO authenticated;
DROP POLICY IF EXISTS flc_split_corrections_read ON public.flc_policy_split_corrections;
CREATE POLICY flc_split_corrections_read ON public.flc_policy_split_corrections
 FOR SELECT TO authenticated USING (
  public.flc_is_admin() OR requested_by=auth.uid()
 );

-- Private writer. MUST be called only from trusted correction functions below.
CREATE OR REPLACE FUNCTION public.flc_apply_policy_split_internal(
 p_policy_id uuid,p_allocations jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_sale public.flc_policy_sales%ROWTYPE; v_count integer; v_total numeric;
BEGIN
 SELECT * INTO v_sale FROM public.flc_policy_sales WHERE id=p_policy_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;
 IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Allocations must be array'; END IF;
 v_count:=jsonb_array_length(p_allocations);
 IF v_count<1 OR v_count>5 THEN RAISE EXCEPTION 'Split requires 1 to 5 participants'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_allocations) e
   WHERE jsonb_typeof(e->'pct') IS DISTINCT FROM 'number'
   OR jsonb_typeof(e->'agent_id') IS DISTINCT FROM 'string'
   OR (e->>'pct')::numeric<=0
   OR (e->>'pct')::numeric>100
   OR round((e->>'pct')::numeric,2)<>(e->>'pct')::numeric)
 THEN RAISE EXCEPTION 'Each allocation needs a valid percent'; END IF;
 SELECT sum(a.pct) INTO v_total FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric);
 IF v_total<>100 THEN RAISE EXCEPTION 'Split percentages must total 100'; END IF;
 IF (SELECT count(distinct a.agent_id) FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric))<>v_count
   OR (p_allocations->0->>'agent_id')::uuid IS DISTINCT FROM v_sale.agent_id
 THEN RAISE EXCEPTION 'Primary must be first; each participant must be unique'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric)
   LEFT JOIN public.agent_profiles p ON p.id=a.agent_id
   WHERE a.agent_id IS NULL OR p.id IS NULL OR (p.role='admin' AND p.id<>v_sale.agent_id))
 THEN RAISE EXCEPTION 'Unknown or invalid agent'; END IF;
 DELETE FROM public.flc_policy_multi_credits WHERE policy_id=p_policy_id;
 IF v_count=1 THEN
  UPDATE public.flc_policy_sales SET split_agent_id=NULL,split_primary_pct=100,updated_at=now()
   WHERE id=p_policy_id;
 ELSIF v_count=2 THEN
  UPDATE public.flc_policy_sales
   SET split_agent_id=(p_allocations->1->>'agent_id')::uuid,
       split_primary_pct=(p_allocations->0->>'pct')::numeric,
       updated_at=now() WHERE id=p_policy_id;
 ELSE
  UPDATE public.flc_policy_sales SET split_agent_id=NULL,split_primary_pct=100,updated_at=now()
   WHERE id=p_policy_id;
  INSERT INTO public.flc_policy_multi_credits(policy_id,agent_id,percent)
   SELECT p_policy_id,a.agent_id,a.pct
   FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric);
 END IF;
END;
$f$;
REVOKE ALL ON FUNCTION public.flc_apply_policy_split_internal(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_request_policy_split_correction(
 p_policy_id uuid,p_allocations jsonb,p_reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_sale public.flc_policy_sales%ROWTYPE;v_previous jsonb;v_reason text;
 v_request uuid;v_verified boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_sale FROM public.flc_policy_sales WHERE id=p_policy_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;
 IF NOT public.flc_is_admin() AND v_sale.agent_id<>auth.uid() THEN
  RAISE EXCEPTION 'Only primary agent may correct splits' USING ERRCODE='42501'; END IF;
 v_reason:=btrim(coalesce(p_reason,''));
 IF length(v_reason)<5 OR length(v_reason)>500 THEN RAISE EXCEPTION 'Reason must have 5 to 500 characters'; END IF;
 IF EXISTS(SELECT 1 FROM public.flc_policy_split_corrections
           WHERE policy_id=p_policy_id AND state='pending') THEN
  RAISE EXCEPTION 'A split correction is already pending'; END IF;
 SELECT jsonb_agg(jsonb_build_object('agent_id',a.agent_id,'pct',a.percent)
   ORDER BY (a.agent_id=v_sale.agent_id) DESC,a.agent_id)
 INTO v_previous FROM public.flc_policy_allocation a WHERE a.policy_id=p_policy_id;
 -- Validate before creating a pending request; validation writer uses a reversible savepoint
 -- alternative: complete set of checks without modifying production.
 IF jsonb_typeof(p_allocations) IS DISTINCT FROM 'array' OR jsonb_array_length(p_allocations)<1
    OR jsonb_array_length(p_allocations)>5 THEN RAISE EXCEPTION 'Requires 1 to 5 participants'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_allocations) e
   WHERE jsonb_typeof(e->'pct') IS DISTINCT FROM 'number'
   OR jsonb_typeof(e->'agent_id') IS DISTINCT FROM 'string'
   OR (e->>'pct')::numeric<=0 OR (e->>'pct')::numeric>100
   OR round((e->>'pct')::numeric,2)<>(e->>'pct')::numeric)
 THEN RAISE EXCEPTION 'Invalid split percentages'; END IF;
 IF (SELECT COALESCE(sum(a.pct),0) FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric))<>100
 OR (SELECT count(distinct a.agent_id) FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric))<>jsonb_array_length(p_allocations)
 OR (p_allocations->0->>'agent_id')::uuid IS DISTINCT FROM v_sale.agent_id
 OR EXISTS(SELECT 1 FROM jsonb_to_recordset(p_allocations) a(agent_id uuid,pct numeric)
   LEFT JOIN public.agent_profiles p ON p.id=a.agent_id
   WHERE a.agent_id IS NULL OR p.id IS NULL OR (p.role='admin' AND p.id<>v_sale.agent_id))
 THEN RAISE EXCEPTION 'Invalid agents or split must sum to 100'; END IF;
 IF v_previous=p_allocations THEN RAISE EXCEPTION 'No changes to allocations'; END IF;
 v_verified:=v_sale.issue_paid_verified_at IS NOT NULL;
 INSERT INTO public.flc_policy_split_corrections
   (policy_id,requested_by,previous_allocations,requested_allocations,reason,state,
    reviewed_by,reviewed_at)
 VALUES(p_policy_id,auth.uid(),v_previous,p_allocations,v_reason,
   CASE WHEN v_verified AND NOT public.flc_is_admin() THEN 'pending' ELSE 'applied' END,
   CASE WHEN public.flc_is_admin() THEN auth.uid() ELSE NULL END,
   CASE WHEN public.flc_is_admin() THEN now() ELSE NULL END)
 RETURNING id INTO v_request;
 IF v_verified AND NOT public.flc_is_admin() THEN RETURN 'pending'; END IF;
 PERFORM public.flc_apply_policy_split_internal(p_policy_id,p_allocations);
 IF v_verified THEN
  UPDATE public.flc_policy_sales SET issue_paid_verified_at=NULL,issue_paid_verified_by=NULL,
   updated_at=now() WHERE id=p_policy_id;
 END IF;
 RETURN 'applied';
END;
$f$;
REVOKE ALL ON FUNCTION public.flc_request_policy_split_correction(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_request_policy_split_correction(uuid,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_review_policy_split_correction(
 p_request_id uuid,p_approve boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_req public.flc_policy_split_corrections%ROWTYPE;v_sale public.flc_policy_sales%ROWTYPE;v_current jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.flc_is_admin() THEN
  RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_req FROM public.flc_policy_split_corrections WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.state<>'pending' THEN RAISE EXCEPTION 'Request not pending'; END IF;
 SELECT * INTO v_sale FROM public.flc_policy_sales WHERE id=v_req.policy_id FOR UPDATE;
 SELECT jsonb_agg(jsonb_build_object('agent_id',a.agent_id,'pct',a.percent)
   ORDER BY (a.agent_id=v_sale.agent_id) DESC,a.agent_id)
 INTO v_current FROM public.flc_policy_allocation a WHERE a.policy_id=v_req.policy_id;
 IF p_approve THEN
  IF v_current IS DISTINCT FROM v_req.previous_allocations THEN
   RAISE EXCEPTION 'Allocation has changed; request must be reviewed again'; END IF;
  PERFORM public.flc_apply_policy_split_internal(v_req.policy_id,v_req.requested_allocations);
  UPDATE public.flc_policy_sales SET issue_paid_verified_at=NULL,issue_paid_verified_by=NULL,
   updated_at=now() WHERE id=v_req.policy_id;
 END IF;
 UPDATE public.flc_policy_split_corrections
 SET state=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_by=auth.uid(),reviewed_at=now() WHERE id=p_request_id;
END;
$f$;
REVOKE ALL ON FUNCTION public.flc_admin_review_policy_split_correction(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_review_policy_split_correction(uuid,boolean) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname IN
 ('flc_request_policy_split_correction','flc_admin_review_policy_split_correction')
 ORDER BY proname;