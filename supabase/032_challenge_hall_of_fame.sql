-- SQL 032 · Salón de Campeones (PREVIEW, requiere SQL 028 y 029).
-- Captura el podio final únicamente cuando un reto termina y un responsable
-- decide cerrarlo. No edita pólizas, splits ni recompensas existentes.
CREATE TABLE IF NOT EXISTS public.flc_challenge_podium_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 challenge_id uuid NOT NULL REFERENCES public.flc_production_challenges(id),
 participant_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 participant_name text NOT NULL,
 place integer NOT NULL CHECK(place BETWEEN 1 AND 3),
 metric_value numeric NOT NULL,
 target_value numeric NOT NULL,
 finalized_by uuid NOT NULL REFERENCES public.agent_profiles(id),
 finalized_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(challenge_id,participant_id),
 UNIQUE(challenge_id,place)
);
CREATE INDEX IF NOT EXISTS flc_podium_history_challenge_idx
 ON public.flc_challenge_podium_history(challenge_id,place);
ALTER TABLE public.flc_challenge_podium_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_challenge_podium_history FROM PUBLIC,anon,authenticated;

-- Solo administración o el creador legítimo del reto puede congelar su podio.
-- Nunca antes del día siguiente al fin (fecha de Nueva York).
CREATE OR REPLACE FUNCTION public.flc_finalize_challenge_podium(p_challenge_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_owner uuid;v_creator uuid;v_status text;v_end date;v_count integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
 SELECT c.owner_agent_id,c.created_by,c.status,c.ends_on
 INTO v_owner,v_creator,v_status,v_end
 FROM public.flc_production_challenges c WHERE c.id=p_challenge_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reto no encontrado'; END IF;
 IF NOT (public.flc_is_admin() OR v_creator=auth.uid()) THEN
  RAISE EXCEPTION 'No tienes permiso para cerrar este podio';
 END IF;
 IF v_status <> 'active' THEN
  RAISE EXCEPTION 'Solo se pueden cerrar retos activos';
 END IF;
 IF v_end >= (now() AT TIME ZONE 'America/New_York')::date THEN
  RAISE EXCEPTION 'Espera a que finalice el período del reto';
 END IF;
 IF EXISTS(SELECT 1 FROM public.flc_challenge_podium_history
   WHERE challenge_id=p_challenge_id) THEN RETURN 0; END IF;
 INSERT INTO public.flc_challenge_podium_history
 (challenge_id,participant_id,participant_name,place,metric_value,target_value,finalized_by)
 SELECT p_challenge_id,l.participant_id,l.participant_name,l.place::integer,
        l.metric_value,l.target_value,auth.uid()
 FROM public.flc_challenge_leaderboard(p_challenge_id) l
 WHERE l.place BETWEEN 1 AND 3 AND l.metric_value>0;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No hay producción para cerrar el podio'; END IF;
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_finalize_challenge_podium(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_finalize_challenge_podium(uuid) TO authenticated;

-- Consulta histórica. Los agentes ven únicamente retos activos o archivados
-- de su ámbito; los borradores nunca aparecen como historial.
CREATE OR REPLACE FUNCTION public.flc_challenge_hall_of_fame()
RETURNS TABLE(
 challenge_id uuid,challenge_title text,starts_on date,ends_on date,
 participant_scope text,metric text,place integer,participant_name text,
 metric_value numeric,target_value numeric,finalized_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT c.id,c.title,c.starts_on,c.ends_on,c.participant_scope,c.metric,
        h.place,h.participant_name,h.metric_value,h.target_value,h.finalized_at
 FROM public.flc_challenge_podium_history h
 JOIN public.flc_production_challenges c ON c.id=h.challenge_id
 WHERE auth.uid() IS NOT NULL
  AND (public.flc_is_admin() OR c.created_by=auth.uid()
       OR (c.status IN ('active','archived') AND public.flc_can_view_challenge(c.owner_agent_id)))
 ORDER BY c.ends_on DESC,c.id,h.place LIMIT 150;
$$;
REVOKE ALL ON FUNCTION public.flc_challenge_hall_of_fame() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_challenge_hall_of_fame() TO authenticated;
