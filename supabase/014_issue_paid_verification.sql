-- Administrative verification is distinct from a reported Issue Paid status.
ALTER TABLE public.flc_policy_sales
 ADD COLUMN IF NOT EXISTS issue_paid_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS issue_paid_verified_by uuid REFERENCES public.agent_profiles(id);
-- Any alteration to payment status or payment date invalidates prior verification.
CREATE OR REPLACE FUNCTION public.flc_clear_changed_paid_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status OR NEW.issue_paid_on IS DISTINCT FROM OLD.issue_paid_on THEN
   NEW.issue_paid_verified_at := NULL;
   NEW.issue_paid_verified_by := NULL;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_paid_verification_invalidate ON public.flc_policy_sales;
CREATE TRIGGER flc_paid_verification_invalidate
 BEFORE UPDATE ON public.flc_policy_sales
 FOR EACH ROW EXECUTE FUNCTION public.flc_clear_changed_paid_verification();

-- Independent verification log for traceability.
CREATE TABLE IF NOT EXISTS public.flc_paid_verification_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 policy_id uuid NOT NULL REFERENCES public.flc_policy_sales(id),
 actor_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 action text NOT NULL CHECK(action IN ('verified','revoked')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flc_paid_verification_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_paid_verification_history FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_admin_verify_issue_paid(p_sale_id uuid,p_verified boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_sale public.flc_policy_sales%ROWTYPE;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 SELECT * INTO v_sale FROM public.flc_policy_sales WHERE id=p_sale_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;
 IF p_verified AND (v_sale.status<>'Issue Paid' OR v_sale.issue_paid_on IS NULL) THEN
  RAISE EXCEPTION 'Only reported Issue Paid policies with a paid date may be verified';
 END IF;
 IF p_verified AND v_sale.issue_paid_verified_at IS NOT NULL THEN RETURN; END IF;
 IF NOT p_verified AND v_sale.issue_paid_verified_at IS NULL THEN RETURN; END IF;
 UPDATE public.flc_policy_sales SET
  issue_paid_verified_at=CASE WHEN p_verified THEN now() ELSE NULL END,
  issue_paid_verified_by=CASE WHEN p_verified THEN auth.uid() ELSE NULL END
 WHERE id=p_sale_id;
 INSERT INTO public.flc_paid_verification_history(policy_id,actor_id,action)
 VALUES(p_sale_id,auth.uid(),CASE WHEN p_verified THEN 'verified' ELSE 'revoked' END);
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_verify_issue_paid(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_verify_issue_paid(uuid,boolean) TO authenticated;
