-- SQL 024 · Ascensos automáticos y revisión de permanencia (Preview).
-- Requiere SQL 023. No ejecuta descensos al instalarse.
-- Rango actual persiste hasta ascenso verificado o confirmación admin al cierre.

CREATE TABLE IF NOT EXISTS public.flc_rank_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 previous_rank text,
 new_rank text,
 change_type text NOT NULL CHECK(change_type IN ('ascenso','descenso')),
 evaluation_month date NOT NULL,
 team_verified_ap numeric(14,2) NOT NULL,
 personal_verified_ap numeric(14,2) NOT NULL,
 outside_top_leg_ap numeric(14,2) NOT NULL,
 changed_by uuid REFERENCES public.agent_profiles(id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_rank_history_agent_idx
 ON public.flc_rank_history(agent_id,occurred_at DESC);
ALTER TABLE public.flc_rank_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_rank_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_rank_history TO authenticated;
DROP POLICY IF EXISTS flc_rank_history_read ON public.flc_rank_history;
CREATE POLICY flc_rank_history_read ON public.flc_rank_history FOR SELECT TO authenticated
 USING(public.flc_is_admin() OR agent_id=auth.uid());

CREATE OR REPLACE FUNCTION public.flc_rank_order(p_code text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=''
AS $$
 SELECT COALESCE(array_position(
 ARRAY['SM','SSM','VP','SVP','EVP','BM','SBM','EBM','CM','SCM','ECM','CCM','SP','EP','MP']::text[],
 p_code),0);
$$;
REVOKE ALL ON FUNCTION public.flc_rank_order(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_rank_order(text) TO authenticated;

-- Promotions are monotonic and require verified production from SQL 023.
-- Safe to retry: same/lower candidate makes no modification or audit entry.
CREATE OR REPLACE FUNCTION public.flc_apply_rank_promotions(p_month date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 rec record;
 v_old text;
 v_count integer:=0;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_month IS NULL THEN RAISE EXCEPTION 'Month required'; END IF;
 PERFORM pg_advisory_xact_lock(572024);
 FOR rec IN SELECT * FROM public.flc_rank_preview(p_month)
 LOOP
  INSERT INTO public.flc_rank_profiles(agent_id,current_rank)
  VALUES(rec.agent_id,NULL) ON CONFLICT(agent_id) DO NOTHING;
  SELECT current_rank INTO v_old
  FROM public.flc_rank_profiles WHERE agent_id=rec.agent_id FOR UPDATE;
  IF public.flc_rank_order(rec.candidate_rank)>public.flc_rank_order(v_old) THEN
   UPDATE public.flc_rank_profiles SET current_rank=rec.candidate_rank,
     assigned_at=now(),assignment_reason='Ascenso automático por Issue Paid verificada'
   WHERE agent_id=rec.agent_id;
   INSERT INTO public.flc_rank_history(
    agent_id,previous_rank,new_rank,change_type,evaluation_month,
    team_verified_ap,personal_verified_ap,outside_top_leg_ap,changed_by)
   VALUES(rec.agent_id,v_old,rec.candidate_rank,'ascenso',date_trunc('month',p_month)::date,
    rec.team_verified_ap,rec.personal_verified_ap,rec.outside_top_leg_ap,auth.uid());
   v_count:=v_count+1;
  END IF;
 END LOOP;
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_apply_rank_promotions(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_apply_rank_promotions(date) TO authenticated;

-- Hooks only on successful administrator verification. A reversal never demotes.
CREATE OR REPLACE FUNCTION public.flc_rank_after_verified_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.status='Issue Paid'
  AND NEW.issue_paid_on IS NOT NULL
  AND NEW.issue_paid_verified_at IS NOT NULL
  AND NEW.issue_paid_verified_at IS DISTINCT FROM OLD.issue_paid_verified_at
 THEN
  BEGIN
   PERFORM public.flc_apply_rank_promotions(NEW.issue_paid_on);
  EXCEPTION WHEN OTHERS THEN
   -- A gamification failure must NEVER undo a real Issue Paid verification.
   RAISE WARNING 'FLC rank auto-promotion failed for policy %: %',NEW.id,SQLERRM;
  END;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_rank_verified_sale ON public.flc_policy_sales;
CREATE TRIGGER flc_rank_verified_sale AFTER UPDATE OF issue_paid_verified_at
 ON public.flc_policy_sales FOR EACH ROW
 EXECUTE FUNCTION public.flc_rank_after_verified_sale();

-- Manual review must be for a fully CLOSED month (America/New_York).
-- p_agent_id NULL reviews all current titleholders; specific UUID reviews one.
-- It ONLY lowers or maintains ranks: ascents are handled by the verified trigger.
-- To preview possible changes, use the read-only flc_rank_preview RPC first.
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
