-- SQL 027 · FLC Academy: insignias históricas de producción (PREVIEW).
-- Requiere SQL 019, 023 y 024. No modifica ni elimina pólizas existentes.
-- IMPORTANTE: Preview y Producción comparten Supabase: ejecutar solo tras revisión.
CREATE TABLE IF NOT EXISTS public.flc_agent_badges (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 badge_code text NOT NULL CHECK (badge_code IN ('first_sale','four_weeks','club_10k','club_25k','club_50k','team_leader')),
 period_month date NOT NULL,
 earned_at timestamptz NOT NULL DEFAULT now(),
 credited_ap numeric(14,2),
 source_policy_id uuid REFERENCES public.flc_policy_sales(id) ON DELETE SET NULL,
 UNIQUE(agent_id,badge_code,period_month)
);
CREATE INDEX IF NOT EXISTS flc_agent_badges_agent_idx ON public.flc_agent_badges(agent_id,earned_at DESC);
ALTER TABLE public.flc_agent_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_agent_badges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_agent_badges TO authenticated;
DROP POLICY IF EXISTS flc_badges_read ON public.flc_agent_badges;
CREATE POLICY flc_badges_read ON public.flc_agent_badges FOR SELECT TO authenticated
 USING(public.flc_is_admin() OR agent_id=auth.uid());

-- Solo lectura autorizada: cada agente ve su vitrina, administración cualquier agente.
CREATE OR REPLACE FUNCTION public.flc_badge_gallery(p_agent_id uuid DEFAULT NULL)
RETURNS TABLE(agent_id uuid,full_name text,badge_code text,period_month date,earned_at timestamptz,credited_ap numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT b.agent_id,p.full_name::text,b.badge_code,b.period_month,b.earned_at,b.credited_ap
 FROM public.flc_agent_badges b JOIN public.agent_profiles p ON p.id=b.agent_id
 WHERE auth.uid() IS NOT NULL
  AND (b.agent_id=auth.uid() OR public.flc_is_admin())
  AND b.agent_id=COALESCE(p_agent_id,auth.uid())
 ORDER BY b.earned_at DESC,b.id DESC;
$$;
REVOKE ALL ON FUNCTION public.flc_badge_gallery(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_badge_gallery(uuid) TO authenticated;

-- El reconocimiento se otorga una sola vez y nunca se elimina si un mes posterior baja producción.
-- Para clubes se contabiliza Issue Paid VERIFICADA, dentro del mes issue_paid_on, con split real.
CREATE OR REPLACE FUNCTION public.flc_badges_evaluate_agent(p_agent_id uuid,p_month date,p_policy_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_month date;v_ap numeric;v_first date;v_streak boolean;
BEGIN
 IF p_agent_id IS NULL OR p_month IS NULL THEN RETURN; END IF;
 v_month:=date_trunc('month',p_month)::date;
 SELECT MIN(s.submitted_on) INTO v_first
 FROM public.flc_policy_allocation a JOIN public.flc_policy_sales s ON s.id=a.policy_id
 WHERE a.agent_id=p_agent_id AND s.submitted_on IS NOT NULL AND a.percent>0;
 IF v_first IS NOT NULL THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month,source_policy_id)
  VALUES(p_agent_id,'first_sale',date_trunc('month',v_first)::date,p_policy_id)
  ON CONFLICT DO NOTHING;
 END IF;
 -- Cuatro semanas calendario consecutivas (lunes-domingo), con al menos una
 -- póliza sometida acreditada en cada semana; cada agente split cuenta individualmente.
 WITH weeks AS (
  SELECT DISTINCT date_trunc('week',s.submitted_on)::date AS wk
  FROM public.flc_policy_allocation a JOIN public.flc_policy_sales s ON s.id=a.policy_id
  WHERE a.agent_id=p_agent_id AND a.percent>0 AND s.submitted_on IS NOT NULL
 )
 SELECT EXISTS(
  SELECT 1 FROM weeks w
  JOIN weeks w1 ON w1.wk=w.wk+7
  JOIN weeks w2 ON w2.wk=w.wk+14
  JOIN weeks w3 ON w3.wk=w.wk+21
 ) INTO v_streak;
 IF v_streak AND NOT EXISTS(SELECT 1 FROM public.flc_agent_badges WHERE agent_id=p_agent_id AND badge_code='four_weeks') THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month,source_policy_id)
  VALUES(p_agent_id,'four_weeks',v_month,p_policy_id)
  ON CONFLICT DO NOTHING;
 END IF;
 SELECT COALESCE(sum(s.annual_premium*a.percent/100),0) INTO v_ap
 FROM public.flc_policy_allocation a JOIN public.flc_policy_sales s ON s.id=a.policy_id
 WHERE a.agent_id=p_agent_id AND a.percent>0
  AND s.status='Issue Paid' AND s.issue_paid_verified_at IS NOT NULL
  AND s.issue_paid_on>=v_month AND s.issue_paid_on<(v_month+interval '1 month')::date;
 IF v_ap>=10000 THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month,credited_ap,source_policy_id)
  VALUES(p_agent_id,'club_10k',v_month,v_ap,p_policy_id) ON CONFLICT DO NOTHING;
 END IF;
 IF v_ap>=25000 THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month,credited_ap,source_policy_id)
  VALUES(p_agent_id,'club_25k',v_month,v_ap,p_policy_id) ON CONFLICT DO NOTHING;
 END IF;
 IF v_ap>=50000 THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month,credited_ap,source_policy_id)
  VALUES(p_agent_id,'club_50k',v_month,v_ap,p_policy_id) ON CONFLICT DO NOTHING;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_badges_evaluate_agent(uuid,date,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_badges_after_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_part record;
BEGIN
 IF TG_OP='INSERT' OR (
   NEW.issue_paid_verified_at IS DISTINCT FROM OLD.issue_paid_verified_at
   AND NEW.issue_paid_verified_at IS NOT NULL
 ) THEN
  FOR v_part IN SELECT DISTINCT a.agent_id FROM public.flc_policy_allocation a WHERE a.policy_id=NEW.id
  LOOP
   BEGIN
    PERFORM public.flc_badges_evaluate_agent(v_part.agent_id,NEW.submitted_on,NEW.id);
    IF NEW.issue_paid_on IS NOT NULL THEN
     PERFORM public.flc_badges_evaluate_agent(v_part.agent_id,NEW.issue_paid_on,NEW.id);
    END IF;
   EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'FLC badges could not evaluate sale %: %',NEW.id,SQLERRM;
   END;
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_badges_policy_trigger ON public.flc_policy_sales;
CREATE TRIGGER flc_badges_policy_trigger AFTER INSERT OR UPDATE OF issue_paid_verified_at
 ON public.flc_policy_sales FOR EACH ROW EXECUTE FUNCTION public.flc_badges_after_sale();

-- En un split de 3-5, los porcentajes se guardan después de crear la póliza:
-- evaluar cada participante adicional sin duplicar la póliza.
CREATE OR REPLACE FUNCTION public.flc_badges_after_split()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_sale record;
BEGIN
 SELECT submitted_on,issue_paid_on INTO v_sale FROM public.flc_policy_sales WHERE id=NEW.policy_id;
 IF FOUND THEN
  BEGIN
   PERFORM public.flc_badges_evaluate_agent(NEW.agent_id,v_sale.submitted_on,NEW.policy_id);
   IF v_sale.issue_paid_on IS NOT NULL THEN
    PERFORM public.flc_badges_evaluate_agent(NEW.agent_id,v_sale.issue_paid_on,NEW.policy_id);
   END IF;
  EXCEPTION WHEN OTHERS THEN
   RAISE WARNING 'FLC split badge error for policy %: %',NEW.policy_id,SQLERRM;
  END;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_badges_multi_split_trigger ON public.flc_policy_multi_credits;
CREATE TRIGGER flc_badges_multi_split_trigger AFTER INSERT ON public.flc_policy_multi_credits
 FOR EACH ROW EXECUTE FUNCTION public.flc_badges_after_split();

CREATE OR REPLACE FUNCTION public.flc_badges_after_rank_ascent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.change_type='ascenso' AND public.flc_rank_order(NEW.new_rank)>=1 AND NOT EXISTS(SELECT 1 FROM public.flc_agent_badges WHERE agent_id=NEW.agent_id AND badge_code='team_leader') THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month)
  VALUES(NEW.agent_id,'team_leader',NEW.evaluation_month) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_badges_rank_trigger ON public.flc_rank_history;
CREATE TRIGGER flc_badges_rank_trigger AFTER INSERT ON public.flc_rank_history
 FOR EACH ROW EXECUTE FUNCTION public.flc_badges_after_rank_ascent();

-- Recuperación voluntaria por agente para logros auténticos anteriores a SQL027.
-- NO se ejecuta al instalar: la CEO decide cuándo reconciliar registros existentes.
CREATE OR REPLACE FUNCTION public.flc_admin_reconcile_badges(p_agent_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_month date;v_before integer;v_after integer;
BEGIN
 IF NOT public.flc_is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_profiles WHERE id=p_agent_id) THEN
  RAISE EXCEPTION 'Agent not found';
 END IF;
 SELECT count(*) INTO v_before FROM public.flc_agent_badges WHERE agent_id=p_agent_id;
 FOR v_month IN
  SELECT DISTINCT date_trunc('month',day_value)::date
  FROM (
   SELECT s.submitted_on AS day_value
   FROM public.flc_policy_allocation a JOIN public.flc_policy_sales s ON s.id=a.policy_id
   WHERE a.agent_id=p_agent_id
   UNION
   SELECT s.issue_paid_on
   FROM public.flc_policy_allocation a JOIN public.flc_policy_sales s ON s.id=a.policy_id
   WHERE a.agent_id=p_agent_id AND s.issue_paid_verified_at IS NOT NULL
  ) days WHERE day_value IS NOT NULL
 LOOP
  PERFORM public.flc_badges_evaluate_agent(p_agent_id,v_month);
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.flc_rank_profiles
   WHERE agent_id=p_agent_id AND current_rank IS NOT NULL)
  AND NOT EXISTS(SELECT 1 FROM public.flc_agent_badges WHERE agent_id=p_agent_id AND badge_code='team_leader') THEN
  INSERT INTO public.flc_agent_badges(agent_id,badge_code,period_month)
  SELECT p_agent_id,'team_leader',date_trunc('month',COALESCE(assigned_at,now()))::date
  FROM public.flc_rank_profiles WHERE agent_id=p_agent_id ON CONFLICT DO NOTHING;
 END IF;
 SELECT count(*) INTO v_after FROM public.flc_agent_badges WHERE agent_id=p_agent_id;
 RETURN v_after-v_before;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_admin_reconcile_badges(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_reconcile_badges(uuid) TO authenticated;
