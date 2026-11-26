-- FLC Academy: daily automatic lead quotas, ADMIN ONLY, preparation.
-- This migration is additive and does NOT change the running round-robin engine.
-- Default: 10 automatic leads per agent, per campaign, per America/New_York day.
-- Manual appointment assignments are excluded from daily automatic usage.
BEGIN;
CREATE TABLE IF NOT EXISTS public.flc_distribution_daily_quotas (
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  campaign_code text NOT NULL REFERENCES public.flc_distribution_campaigns(code) ON DELETE CASCADE,
  daily_limit integer NOT NULL CHECK (daily_limit BETWEEN 0 AND 1000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (agent_id,campaign_code)
);
ALTER TABLE public.flc_distribution_daily_quotas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_distribution_daily_quotas FROM PUBLIC,anon,authenticated;

-- Atomic usage ledger to be populated by the quota-aware engine in a separate,
-- supervised migration; immutable assignment events remain the audit source.
CREATE TABLE IF NOT EXISTS public.flc_distribution_auto_quota_ledger (
  assignment_id uuid PRIMARY KEY REFERENCES public.flc_distribution_assignments(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE RESTRICT,
  campaign_code text NOT NULL REFERENCES public.flc_distribution_campaigns(code),
  quota_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flc_dist_quota_ledger_lookup
  ON public.flc_distribution_auto_quota_ledger(agent_id,campaign_code,quota_day);
ALTER TABLE public.flc_distribution_auto_quota_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_distribution_auto_quota_ledger FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_get_daily_quotas()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid(); v_today date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='admin'
  ) THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'default_daily_limit',10,
    'timezone','America/New_York',
    'quota_day',v_today,
    'quotas',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'agent_id',q.agent_id,'campaign_code',q.campaign_code,
        'daily_limit',q.daily_limit,'updated_at',q.updated_at
      ) ORDER BY q.campaign_code,q.agent_id)
      FROM public.flc_distribution_daily_quotas q
    ),'[]'::jsonb),
    'used_today',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'agent_id',x.agent_id,'campaign_code',x.campaign_code,'count',x.used
      ) ORDER BY x.campaign_code,x.agent_id)
      FROM (
        SELECT l.agent_id,l.campaign_code,count(*)::integer AS used
        FROM public.flc_distribution_auto_quota_ledger l
        WHERE l.quota_day=v_today
        GROUP BY l.agent_id,l.campaign_code
      ) x
    ),'[]'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.flc_distribution_set_daily_quota(
  p_agent_id uuid,p_campaign_code text,p_daily_limit integer
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid(); v_campaign text:=upper(btrim(coalesce(p_campaign_code,'')));
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='admin'
  ) THEN RAISE EXCEPTION 'admin_only' USING ERRCODE='42501'; END IF;
  IF p_daily_limit IS NULL OR p_daily_limit < 0 OR p_daily_limit > 1000 THEN
    RAISE EXCEPTION 'invalid_daily_limit' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.agent_profiles p WHERE p.id=p_agent_id AND p.role='agent')
    OR NOT EXISTS(SELECT 1 FROM public.flc_distribution_campaigns c
                  WHERE c.code=v_campaign AND c.enabled)
  THEN RAISE EXCEPTION 'unknown_agent_or_campaign' USING ERRCODE='22023'; END IF;

  INSERT INTO public.flc_distribution_daily_quotas
    (agent_id,campaign_code,daily_limit,updated_at,updated_by)
  VALUES(p_agent_id,v_campaign,p_daily_limit,now(),v_actor)
  ON CONFLICT(agent_id,campaign_code) DO UPDATE
    SET daily_limit=EXCLUDED.daily_limit,updated_at=now(),updated_by=v_actor;

  INSERT INTO public.flc_distribution_events(agent_id,actor_id,event_type,details)
  VALUES(p_agent_id,v_actor,'daily_auto_quota_updated',
         jsonb_build_object('campaign_code',v_campaign,'daily_limit',p_daily_limit,
                            'effective_timezone','America/New_York'));
  RETURN jsonb_build_object('saved',true,'agent_id',p_agent_id,
                            'campaign_code',v_campaign,'daily_limit',p_daily_limit);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_get_daily_quotas() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.flc_distribution_set_daily_quota(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_get_daily_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flc_distribution_set_daily_quota(uuid,text,integer) TO authenticated;
COMMIT;
-- This alone DOES NOT enforce quotas in the automatic engine.
