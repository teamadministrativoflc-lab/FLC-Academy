-- SQL 022 · Estado inicial seleccionable para nuevas pólizas.
-- Ejecutar UNA VEZ en Supabase SQL Editor antes de probar Preview.
-- No cambia pólizas anteriores, splits ni verificación de Issue Paid.
-- Se llama solamente después de que el RPC de creación devuelve el ID real.
CREATE OR REPLACE FUNCTION public.flc_set_initial_policy_disposition(
 p_policy_id uuid, p_disposition text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_status text;
 v_label text;
 v_updated integer;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authentication required';
 END IF;
 IF p_disposition NOT IN ('Sometida','Aprobada en pantalla','Enviada a underwriting') THEN
  RAISE EXCEPTION 'Invalid initial policy disposition';
 END IF;
 v_status := CASE p_disposition
  WHEN 'Aprobada en pantalla' THEN 'Aprobada'
  WHEN 'Enviada a underwriting' THEN 'En revisión'
  ELSE 'Sometida'
 END;
 v_label := p_disposition;
 -- A new policy must still be Sometida, unverified and owned by the
 -- calling principal (or an authorized administrator).
 UPDATE public.flc_policy_sales s
 SET status=v_status,
     approved_on=CASE WHEN v_status='Aprobada' THEN s.submitted_on ELSE s.approved_on END
 WHERE s.id=p_policy_id
  AND (s.agent_id=auth.uid() OR public.flc_is_admin())
  AND s.status='Sometida'
  AND s.issue_paid_verified_at IS NULL;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 IF v_updated<>1 THEN
  RAISE EXCEPTION 'Policy missing, not owned, or already updated';
 END IF;
 -- Announcement records represent the initial submitted disposition,
 -- not later changes; preserve its original timestamp and participants.
 UPDATE public.flc_sale_announcements a
 SET status=v_label
 WHERE a.policy_id=p_policy_id;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_set_initial_policy_disposition(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_set_initial_policy_disposition(uuid,text) TO authenticated;
