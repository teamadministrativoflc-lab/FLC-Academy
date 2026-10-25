-- SQL 025 · Guardrails for rank reviews. Run after SQL 024.
-- Historical months before October 2026 are not considered complete in FLC Academy.
-- No record is removed or demoted by executing this migration.
CREATE TABLE IF NOT EXISTS public.flc_rank_month_certifications (
 month_start date PRIMARY KEY,
 certified_at timestamptz NOT NULL DEFAULT now(),
 certified_by uuid NOT NULL REFERENCES public.agent_profiles(id),
 evidence_note text NOT NULL CHECK(length(btrim(evidence_note))>=20)
);
ALTER TABLE public.flc_rank_month_certifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_rank_month_certifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_rank_month_certifications TO authenticated;
DROP POLICY IF EXISTS flc_rank_certification_admin_read ON public.flc_rank_month_certifications;
CREATE POLICY flc_rank_certification_admin_read ON public.flc_rank_month_certifications
 FOR SELECT TO authenticated USING(public.flc_is_admin());

CREATE OR REPLACE FUNCTION public.flc_admin_certify_rank_month(
 p_month date,p_evidence_note text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_period date;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_month IS NULL THEN RAISE EXCEPTION 'Month required'; END IF;
 v_period:=date_trunc('month',p_month)::date;
 IF v_period < DATE '2026-10-01' THEN
  RAISE EXCEPTION 'Rank review history starts in October 2026; do not certify prior incomplete records';
 END IF;
 IF v_period >= date_trunc('month',(now() AT TIME ZONE 'America/New_York'))::date THEN
  RAISE EXCEPTION 'Cannot certify a month before it is fully closed';
 END IF;
 IF length(btrim(COALESCE(p_evidence_note,'')))<20 THEN
  RAISE EXCEPTION 'Explain the verified source proving all agency production is complete (minimum 20 characters)';
 END IF;
 INSERT INTO public.flc_rank_month_certifications(month_start,certified_by,evidence_note)
 VALUES(v_period,auth.uid(),btrim(p_evidence_note))
 ON CONFLICT(month_start) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_certify_rank_month(date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_certify_rank_month(date,text) TO authenticated;

-- Replace the review RPC with server-side checks, not just disabled buttons.
CREATE OR REPLACE FUNCTION public.flc_rank_review_closed_month(
 p_month date,p_agent_id uuid DEFAULT NULL
) RETURNS TABLE(reviewed_count integer,descended_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 rec record;
 v_old text;
 v_reviewed integer:=0;
 v_descended integer:=0;
 v_period date;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_month IS NULL THEN RAISE EXCEPTION 'Month required'; END IF;
 v_period:=date_trunc('month',p_month)::date;
 IF v_period >= date_trunc('month',(now() AT TIME ZONE 'America/New_York'))::date THEN
  RAISE EXCEPTION 'Only a fully closed month can be confirmed';
 END IF;
 IF v_period < DATE '2026-10-01' THEN
  RAISE EXCEPTION 'Historical month lacks certified agency production; unavailable for rank reviews';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_rank_month_certifications c
   WHERE c.month_start=v_period) THEN
  RAISE EXCEPTION 'Rank month must be certified complete by Administration before a review';
 END IF;
 PERFORM pg_advisory_xact_lock(572024);
 IF p_agent_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.flc_rank_preview(v_period) r WHERE r.agent_id=p_agent_id
 ) THEN RAISE EXCEPTION 'Leader not found'; END IF;
 FOR rec IN SELECT * FROM public.flc_rank_preview(v_period) p
  WHERE (p_agent_id IS NULL OR p.agent_id=p_agent_id)
 LOOP
  SELECT current_rank INTO v_old
  FROM public.flc_rank_profiles WHERE agent_id=rec.agent_id FOR UPDATE;
  -- Do not strip "Sin título"; only review a rank earned already.
  IF v_old IS NULL THEN CONTINUE; END IF;
  -- A title earned in a month is retained throughout that month;
  -- the first possible permanence review is the NEXT completed month.
  IF EXISTS(SELECT 1 FROM public.flc_rank_profiles prof
    WHERE prof.agent_id=rec.agent_id AND prof.assigned_at IS NOT NULL
      AND v_period<=date_trunc('month',prof.assigned_at AT TIME ZONE 'America/New_York')::date
  ) THEN CONTINUE; END IF;
  -- Idempotent review: same month cannot be confirmed twice for a leader.
  IF EXISTS(SELECT 1 FROM public.flc_rank_profiles
    WHERE agent_id=rec.agent_id AND reviewed_through>=v_period) THEN CONTINUE; END IF;
  IF public.flc_rank_order(rec.candidate_rank)<public.flc_rank_order(v_old) THEN
   UPDATE public.flc_rank_profiles SET current_rank=rec.candidate_rank,
    assigned_at=now(),assignment_reason='Revisión administrativa de mes cerrado',
    reviewed_through=v_period
   WHERE agent_id=rec.agent_id;
   INSERT INTO public.flc_rank_history(
    agent_id,previous_rank,new_rank,change_type,evaluation_month,
    team_verified_ap,personal_verified_ap,outside_top_leg_ap,changed_by)
   VALUES(rec.agent_id,v_old,rec.candidate_rank,'descenso',v_period,
    rec.team_verified_ap,rec.personal_verified_ap,rec.outside_top_leg_ap,auth.uid());
   v_descended:=v_descended+1;
  ELSE
   UPDATE public.flc_rank_profiles SET reviewed_through=v_period
   WHERE agent_id=rec.agent_id;
  END IF;
  v_reviewed:=v_reviewed+1;
 END LOOP;
 RETURN QUERY SELECT v_reviewed,v_descended;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_rank_review_closed_month(date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_rank_review_closed_month(date,uuid) TO authenticated;
