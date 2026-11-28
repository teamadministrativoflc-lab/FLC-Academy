-- REVIEW BEFORE RUN: Admin-only queue inspection, read-only.
-- No CRM requests, no updates and no exposure of client contact identifiers.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_auraflow_outbox_status_admin()
RETURNS TABLE(status text, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.agent_profiles WHERE id=auth.uid() AND role='admin'
 ) THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT o.status, count(*)::bigint
 FROM public.flc_distribution_auraflow_results_outbox o
 GROUP BY o.status ORDER BY o.status;
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_auraflow_outbox_status_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_auraflow_outbox_status_admin() TO authenticated;
COMMIT;
