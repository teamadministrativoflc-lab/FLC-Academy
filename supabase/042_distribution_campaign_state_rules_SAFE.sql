-- FLC Academy principal: agent-specific campaign participation and licensed states.
-- This migration is additive. It NEVER assigns leads or activates agents.
-- The only users who can change eligibility are authenticated administrators.
BEGIN;

CREATE TABLE IF NOT EXISTS public.flc_distribution_campaigns (
  code text PRIMARY KEY,
  label text NOT NULL,
  product_type text NOT NULL,
  source_platform text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flc_dist_campaign_code_valid CHECK (code ~ '^[A-Z0-9_]{3,80}$')
);

INSERT INTO public.flc_distribution_campaigns (code,label,product_type,source_platform,enabled)
VALUES
('IUL_FACEBOOK_MAGNETIX','IUL Facebook — Magnetix','IUL','Facebook',true),
('GASTOS_FINALES_FACEBOOK','Gastos Finales — Facebook','Gastos Finales','Facebook',true),
('FLC_TEST_INTEGRACION','Integración — Pruebas','Prueba','Interno',false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.flc_distribution_agent_campaigns (
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  campaign_code text NOT NULL REFERENCES public.flc_distribution_campaigns(code) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (agent_id,campaign_code)
);

CREATE TABLE IF NOT EXISTS public.flc_distribution_agent_states (
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (agent_id,state_code),
  CONSTRAINT flc_dist_valid_state CHECK (state_code IN (
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
    'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
    'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
    'TX','UT','VT','VA','WA','WV','WI','WY'
  ))
);

ALTER TABLE public.flc_distribution_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_distribution_agent_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_distribution_agent_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_distribution_campaigns,
 public.flc_distribution_agent_campaigns,
 public.flc_distribution_agent_states FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_get_agent_rules()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles WHERE id=v_actor AND role='admin'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  RETURN jsonb_build_object(
    'campaigns',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'code',c.code,'label',c.label,'enabled',c.enabled
    ) ORDER BY c.label) FROM public.flc_distribution_campaigns c),'[]'::jsonb),
    'agent_campaigns',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'agent_id',a.agent_id,'campaign_code',a.campaign_code
    )) FROM public.flc_distribution_agent_campaigns a WHERE a.enabled),'[]'::jsonb),
    'agent_states',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'agent_id',s.agent_id,'state_code',s.state_code
    )) FROM public.flc_distribution_agent_states s),'[]'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.flc_distribution_set_agent_rules(
  p_agent_id uuid,
  p_campaigns text[],
  p_states text[]
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_actor uuid:=auth.uid();
  v_campaigns text[];
  v_states text[];
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles WHERE id=v_actor AND role='admin'
  ) THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;

  IF p_agent_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles WHERE id=p_agent_id AND role='agent'
  ) THEN RAISE EXCEPTION 'agent_not_found' USING ERRCODE='22023'; END IF;

  IF p_campaigns IS NULL OR p_states IS NULL THEN
    RAISE EXCEPTION 'arrays_required' USING ERRCODE='22023';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT c),ARRAY[]::text[])
  INTO v_campaigns FROM unnest(p_campaigns) x(c);
  SELECT COALESCE(array_agg(DISTINCT upper(trim(s))),ARRAY[]::text[])
  INTO v_states FROM unnest(p_states) x(s);

  IF cardinality(v_campaigns)>100 OR cardinality(v_states)>52
  THEN RAISE EXCEPTION 'too_many_rules' USING ERRCODE='22023'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_campaigns) x(code)
    LEFT JOIN public.flc_distribution_campaigns c ON c.code=x.code AND c.enabled
    WHERE c.code IS NULL
  ) THEN RAISE EXCEPTION 'unknown_or_inactive_campaign' USING ERRCODE='22023'; END IF;

  IF EXISTS(
    SELECT 1 FROM unnest(v_states) x(code)
    WHERE x.code NOT IN (
      'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
      'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
      'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
      'TX','UT','VT','VA','WA','WV','WI','WY'
    )
  ) THEN RAISE EXCEPTION 'invalid_state' USING ERRCODE='22023'; END IF;

  -- Transactions lock one agent profile to serialize concurrent edits.
  PERFORM 1 FROM public.agent_profiles WHERE id=p_agent_id FOR UPDATE;

  DELETE FROM public.flc_distribution_agent_campaigns WHERE agent_id=p_agent_id;
  INSERT INTO public.flc_distribution_agent_campaigns
    (agent_id,campaign_code,enabled,updated_by)
  SELECT p_agent_id,x.code,true,v_actor FROM unnest(v_campaigns) x(code);

  DELETE FROM public.flc_distribution_agent_states WHERE agent_id=p_agent_id;
  INSERT INTO public.flc_distribution_agent_states
    (agent_id,state_code,updated_by)
  SELECT p_agent_id,x.code,v_actor FROM unnest(v_states) x(code);

  INSERT INTO public.flc_distribution_events (agent_id,actor_id,event_type,details)
  VALUES (
    p_agent_id,v_actor,'agent_eligibility_updated',
    jsonb_build_object('campaign_codes',to_jsonb(v_campaigns),'state_codes',to_jsonb(v_states))
  );

  RETURN jsonb_build_object(
    'saved',true,'agent_id',p_agent_id,
    'campaign_count',cardinality(v_campaigns),'state_count',cardinality(v_states)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_get_agent_rules() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.flc_distribution_set_agent_rules(uuid,text[],text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_get_agent_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flc_distribution_set_agent_rules(uuid,text[],text[]) TO authenticated;
COMMIT;

-- Confirmation only: two functions returned; zero agents changed.
SELECT proname FROM pg_proc
WHERE proname IN ('flc_distribution_get_agent_rules','flc_distribution_set_agent_rules')
ORDER BY proname;
