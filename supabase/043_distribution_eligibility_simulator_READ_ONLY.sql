-- FLC Academy MAIN ONLY — Safe eligibility simulator (READ ONLY)
-- Project: fvhbzutxaoujtnnjzhlk
-- Does not assign leads, activate agents, or change current campaigns.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_simulate_eligibility(
  p_campaign_code text,
  p_state_code text
)
RETURNS TABLE(
  agent_id uuid,
  agent_name text,
  campaign_allowed boolean,
  state_allowed boolean,
  verified_on_zoom boolean,
  eligible boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_campaign text := upper(trim(coalesce(p_campaign_code,'')));
  v_state text := upper(trim(coalesce(p_state_code,'')));
BEGIN
  IF v_actor IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.agent_profiles p
    WHERE p.id = v_actor AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.flc_distribution_campaigns c
    WHERE c.code = v_campaign AND c.enabled
  ) THEN
    RAISE EXCEPTION 'unknown_or_disabled_campaign' USING ERRCODE = '22023';
  END IF;

  IF v_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid_state' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    (c.agent_id IS NOT NULL) AS campaign_allowed,
    (s.agent_id IS NOT NULL) AS state_allowed,
    coalesce(a.is_verified,false) AS verified_on_zoom,
    (c.agent_id IS NOT NULL AND s.agent_id IS NOT NULL
       AND coalesce(a.is_verified,false)) AS eligible
  FROM public.agent_profiles p
  LEFT JOIN public.flc_distribution_agent_campaigns c
    ON c.agent_id = p.id AND c.campaign_code = v_campaign AND c.enabled
  LEFT JOIN public.flc_distribution_agent_states s
    ON s.agent_id = p.id AND s.state_code = v_state
  LEFT JOIN public.flc_distribution_agent_availability a
    ON a.agent_id = p.id
  WHERE p.role = 'agent'
  ORDER BY p.full_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.flc_distribution_simulate_eligibility(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_simulate_eligibility(text,text) TO authenticated;
COMMIT;

-- Confirm presence without changing any lead or agent.
SELECT proname
FROM pg_proc
WHERE proname='flc_distribution_simulate_eligibility';
