-- 051 · FLC Lead Distribution Center: manual agent activity log.
-- MAIN project: fvhbzutxaoujtnnjzhlk.
-- Additive, no real assignments / outbound CRM actions / production changes.
-- Stores each manual entry in existing protected distribution event timeline.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_record_activity(
  p_lead_id uuid,
  p_kind text,
  p_result text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_follow_up_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_agent uuid;
  v_event uuid;
  v_kind text := nullif(trim(coalesce(p_kind,'')),'');
  v_result text := nullif(trim(coalesce(p_result,'')),'');
  v_note text := nullif(trim(coalesce(p_note,'')),'');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501';
  END IF;
  IF p_lead_id IS NULL THEN
    RAISE EXCEPTION 'missing_lead' USING ERRCODE='22023';
  END IF;
  IF v_kind IS NULL OR v_kind NOT IN ('call','note','follow_up','appointment') THEN
    RAISE EXCEPTION 'invalid_activity_type' USING ERRCODE='22023';
  END IF;
  IF v_result IS NOT NULL AND v_result NOT IN
    ('no_answer','voicemail','interested','not_interested','callback','appointment','wrong_number','other') THEN
    RAISE EXCEPTION 'invalid_call_result' USING ERRCODE='22023';
  END IF;
  IF length(coalesce(v_note,'')) > 2000 THEN
    RAISE EXCEPTION 'note_too_long' USING ERRCODE='22023';
  END IF;
  IF v_kind='call' AND v_result IS NULL THEN
    RAISE EXCEPTION 'call_result_required' USING ERRCODE='22023';
  END IF;
  IF v_kind IN ('appointment','follow_up') AND p_follow_up_at IS NULL THEN
    RAISE EXCEPTION 'follow_up_time_required' USING ERRCODE='22023';
  END IF;
  IF p_follow_up_at IS NOT NULL AND p_follow_up_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'follow_up_must_be_future' USING ERRCODE='22023';
  END IF;
  IF v_kind='note' AND v_note IS NULL THEN
    RAISE EXCEPTION 'note_required' USING ERRCODE='22023';
  END IF;

  -- Security invariant: caller must hold the CURRENT assignment.
  -- Administrators may view the timeline but cannot impersonate agents.
  SELECT a.agent_id INTO v_agent
  FROM public.flc_distribution_assignments a
  WHERE a.lead_id=p_lead_id AND a.agent_id=v_actor AND a.ended_at IS NULL
  LIMIT 1;
  IF v_agent IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.agent_profiles ap
    WHERE ap.id=v_actor AND ap.role='agent'
  ) THEN
    RAISE EXCEPTION 'lead_not_assigned_to_current_agent' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.flc_distribution_events
    (lead_id,agent_id,actor_id,event_type,details)
  VALUES (
    p_lead_id,v_agent,v_actor,
    CASE v_kind WHEN 'call' THEN 'agent_call_logged'
      WHEN 'note' THEN 'agent_note_logged'
      WHEN 'appointment' THEN 'agent_appointment_logged'
      ELSE 'agent_follow_up_logged' END,
    jsonb_build_object(
      'kind',v_kind,'result',v_result,'note',v_note,
      'follow_up_at',p_follow_up_at,
      'entered_manually',true,'crm_synced',false
    )
  ) RETURNING id INTO v_event;

  RETURN jsonb_build_object('saved',true,'event_id',v_event,'crm_synced',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_record_activity(uuid,text,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_record_activity(uuid,text,text,text,timestamptz) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_record_activity';
