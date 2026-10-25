-- SQL 026 · Celebraciones de ascenso reales en FLC (Preview).
-- Requiere SQL 024 y SQL 025. No crea promociones de prueba ni modifica rangos.
-- Cada evento es generado SOLO por una fila auditada de flc_rank_history ascenso.
CREATE TABLE IF NOT EXISTS public.flc_rank_announcements (
 history_id bigint PRIMARY KEY REFERENCES public.flc_rank_history(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 agent_name text NOT NULL,
 old_rank text,
 new_rank text NOT NULL,
 team_verified_ap numeric(14,2) NOT NULL,
 personal_verified_ap numeric(14,2) NOT NULL,
 evaluation_month date NOT NULL,
 announced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_rank_announcements_recent_idx
 ON public.flc_rank_announcements(announced_at DESC);
ALTER TABLE public.flc_rank_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_rank_announcements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_rank_announcements TO authenticated;
DROP POLICY IF EXISTS flc_rank_announcements_authenticated ON public.flc_rank_announcements;
CREATE POLICY flc_rank_announcements_authenticated
 ON public.flc_rank_announcements FOR SELECT TO authenticated
 USING(auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.flc_rank_announce_promotion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.change_type <> 'ascenso' OR NEW.new_rank IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.flc_rank_announcements(
  history_id,agent_id,agent_name,old_rank,new_rank,
  team_verified_ap,personal_verified_ap,evaluation_month
 )
 SELECT NEW.id,NEW.agent_id,p.full_name,NEW.previous_rank,NEW.new_rank,
  NEW.team_verified_ap,NEW.personal_verified_ap,NEW.evaluation_month
 FROM public.agent_profiles p WHERE p.id=NEW.agent_id
 ON CONFLICT(history_id) DO NOTHING;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS flc_rank_announcement_on_promotion ON public.flc_rank_history;
CREATE TRIGGER flc_rank_announcement_on_promotion
 AFTER INSERT ON public.flc_rank_history
 FOR EACH ROW WHEN (NEW.change_type='ascenso')
 EXECUTE FUNCTION public.flc_rank_announce_promotion();

DO $$ BEGIN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.flc_rank_announcements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
