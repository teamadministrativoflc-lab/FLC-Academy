-- Paso 624. Corrección controlada de AP con trazabilidad y revisión posterior a Issue Paid verificada.
-- Ejecutar una sola vez en Supabase SQL Editor DESPUÉS de aprobar Preview.
-- No cambia ni elimina pólizas existentes.
CREATE TABLE IF NOT EXISTS public.flc_policy_ap_corrections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 policy_id uuid NOT NULL REFERENCES public.flc_policy_sales(id),
 requested_by uuid NOT NULL REFERENCES public.agent_profiles(id),
 previous_ap numeric(14,2) NOT NULL,
 requested_ap numeric(14,2) NOT NULL CHECK(requested_ap>0),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 state text NOT NULL CHECK(state IN ('applied','pending','approved','rejected')),
 reviewed_by uuid REFERENCES public.agent_profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_policy_ap_corrections_policy_idx
 ON public.flc_policy_ap_corrections(policy_id,created_at DESC);
CREATE INDEX IF NOT EXISTS flc_policy_ap_corrections_state_idx
 ON public.flc_policy_ap_corrections(state,created_at DESC);
ALTER TABLE public.flc_policy_ap_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_policy_ap_corrections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_policy_ap_corrections TO authenticated;
DROP POLICY IF EXISTS flc_policy_ap_corrections_read ON public.flc_policy_ap_corrections;
CREATE POLICY flc_policy_ap_corrections_read ON public.flc_policy_ap_corrections
 FOR SELECT TO authenticated USING (
  public.flc_is_admin()
  OR EXISTS (SELECT 1 FROM public.flc_policy_sales s
   WHERE s.id=policy_id AND (
    s.agent_id=auth.uid()
    OR public.flc_can_view_policy_agent(s.agent_id)
    OR s.split_agent_id=auth.uid()
    OR public.flc_can_view_multi_split_policy(s.id)))
 );

-- A changed AP must no longer count as a previously verified amount.
CREATE OR REPLACE FUNCTION public.flc_invalidate_verification_on_ap_change()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF NEW.annual_premium IS DISTINCT FROM OLD.annual_premium THEN
  NEW.issue_paid_verified_at:=NULL;
  NEW.issue_paid_verified_by:=NULL;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_ap_change_invalidate_paid ON public.flc_policy_sales;
CREATE TRIGGER flc_ap_change_invalidate_paid BEFORE UPDATE OF annual_premium
 ON public.flc_policy_sales FOR EACH ROW
 EXECUTE FUNCTION public.flc_invalidate_verification_on_ap_change();

CREATE OR REPLACE FUNCTION public.flc_request_policy_ap_correction(
 p_sale_id uuid,p_new_ap numeric,p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_sale public.flc_policy_sales%ROWTYPE;v_reason text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_new_ap IS NULL OR p_new_ap<=0 OR round(p_new_ap,2)<>p_new_ap THEN
  RAISE EXCEPTION 'AP must be a positive amount with at most two decimals';
 END IF;
 v_reason:=btrim(COALESCE(p_reason,''));
 IF length(v_reason)<5 OR length(v_reason)>500 THEN
  RAISE EXCEPTION 'Explain the correction in 5 to 500 characters';
 END IF;
 SELECT * INTO v_sale FROM public.flc_policy_sales WHERE id=p_sale_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;
 IF NOT public.flc_is_admin() AND v_sale.agent_id<>auth.uid() THEN
  RAISE EXCEPTION 'Only the principal agent can request changes to this policy';
 END IF;
 IF v_sale.annual_premium=p_new_ap THEN RAISE EXCEPTION 'AP has not changed'; END IF;
 IF v_sale.issue_paid_verified_at IS NOT NULL AND NOT public.flc_is_admin() THEN
  IF EXISTS(SELECT 1 FROM public.flc_policy_ap_corrections c
    WHERE c.policy_id=p_sale_id AND c.state='pending') THEN
   RAISE EXCEPTION 'A correction request is already pending';
  END IF;
  INSERT INTO public.flc_policy_ap_corrections
   (policy_id,requested_by,previous_ap,requested_ap,reason,state)
  VALUES(p_sale_id,auth.uid(),v_sale.annual_premium,p_new_ap,v_reason,'pending');
  RETURN 'pending';
 END IF;
 -- Admin changes to verified policies invalidate prior verification; admin must verify again.
 UPDATE public.flc_policy_sales
 SET annual_premium=p_new_ap,updated_at=now()
 WHERE id=p_sale_id;
 INSERT INTO public.flc_policy_ap_corrections
  (policy_id,requested_by,previous_ap,requested_ap,reason,state,reviewed_by,reviewed_at)
 VALUES(p_sale_id,auth.uid(),v_sale.annual_premium,p_new_ap,v_reason,
   'applied',CASE WHEN public.flc_is_admin() THEN auth.uid() ELSE NULL END,
   CASE WHEN public.flc_is_admin() THEN now() ELSE NULL END);
 RETURN 'applied';
END;
$$;
REVOKE ALL ON FUNCTION public.flc_request_policy_ap_correction(uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_request_policy_ap_correction(uuid,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_review_policy_ap_correction(
 p_request_id uuid,p_approve boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_req public.flc_policy_ap_corrections%ROWTYPE;
 v_sale public.flc_policy_sales%ROWTYPE;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 SELECT * INTO v_req FROM public.flc_policy_ap_corrections
 WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.state<>'pending' THEN
  RAISE EXCEPTION 'Correction request not pending';
 END IF;
 SELECT * INTO v_sale FROM public.flc_policy_sales
 WHERE id=v_req.policy_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;
 IF p_approve THEN
  IF v_sale.annual_premium<>v_req.previous_ap THEN
   RAISE EXCEPTION 'Policy AP changed after request; review again';
  END IF;
  UPDATE public.flc_policy_sales SET annual_premium=v_req.requested_ap,
   updated_at=now() WHERE id=v_req.policy_id;
 END IF;
 UPDATE public.flc_policy_ap_corrections
 SET state=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  reviewed_by=auth.uid(),reviewed_at=now()
 WHERE id=p_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_review_policy_ap_correction(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_review_policy_ap_correction(uuid,boolean) TO authenticated;
