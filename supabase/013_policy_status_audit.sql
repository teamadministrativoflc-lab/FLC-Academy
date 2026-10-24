-- Audit trail for all status/date changes, including existing admin and agent RPCs.
CREATE TABLE IF NOT EXISTS public.flc_policy_status_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 policy_id uuid NOT NULL REFERENCES public.flc_policy_sales(id) ON DELETE CASCADE,
 changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 previous_status text, new_status text NOT NULL,
 previous_approved_on date, new_approved_on date,
 previous_issue_paid_on date, new_issue_paid_on date,
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_policy_status_history_policy_idx
 ON public.flc_policy_status_history(policy_id,changed_at DESC);
ALTER TABLE public.flc_policy_status_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_policy_status_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_policy_status_history TO authenticated;
DROP POLICY IF EXISTS flc_policy_status_history_read ON public.flc_policy_status_history;
CREATE POLICY flc_policy_status_history_read ON public.flc_policy_status_history
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.flc_policy_sales s WHERE s.id=policy_id
 AND (public.flc_can_view_policy_agent(s.agent_id) OR s.split_agent_id=auth.uid()))
);
CREATE OR REPLACE FUNCTION public.flc_audit_policy_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF ROW(OLD.status,OLD.approved_on,OLD.issue_paid_on)
 IS DISTINCT FROM ROW(NEW.status,NEW.approved_on,NEW.issue_paid_on) THEN
  INSERT INTO public.flc_policy_status_history
   (policy_id,changed_by,previous_status,new_status,previous_approved_on,new_approved_on,previous_issue_paid_on,new_issue_paid_on)
  VALUES (NEW.id,auth.uid(),OLD.status,NEW.status,OLD.approved_on,NEW.approved_on,OLD.issue_paid_on,NEW.issue_paid_on);
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_policy_status_audit ON public.flc_policy_sales;
CREATE TRIGGER flc_policy_status_audit AFTER UPDATE OF status,approved_on,issue_paid_on
 ON public.flc_policy_sales FOR EACH ROW EXECUTE FUNCTION public.flc_audit_policy_status();
