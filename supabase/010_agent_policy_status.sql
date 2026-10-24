-- Authorized agent may change status only on policies they own as primary.
-- Split collaborators retain read-only access. Admin uses the existing admin RPC.
CREATE OR REPLACE FUNCTION public.flc_agent_update_policy_status(
 p_sale_id uuid,p_status text,p_approved_on date DEFAULT NULL,p_issue_paid_on date DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_status NOT IN ('Sometida','En revisión','Pendiente requisito','Aprobada','Issue Paid','Declinada','Cancelada','Chargeback') THEN
  RAISE EXCEPTION 'Invalid policy status';
 END IF;
 IF p_status='Issue Paid' AND p_issue_paid_on IS NULL THEN
  RAISE EXCEPTION 'Issue Paid date is required';
 END IF;
 UPDATE public.flc_policy_sales SET status=p_status,approved_on=p_approved_on,
  issue_paid_on=p_issue_paid_on,updated_at=now()
 WHERE id=p_sale_id AND agent_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found or not owned by agent'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_agent_update_policy_status(uuid,text,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_agent_update_policy_status(uuid,text,date,date) TO authenticated;
