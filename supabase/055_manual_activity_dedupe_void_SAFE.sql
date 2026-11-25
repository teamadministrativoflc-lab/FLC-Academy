-- 055 · Prevent identical rapid manual entries and allow audited voids.
-- Additive: no real lead assignment, no CRM writes, no existing events erased.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_record_activity(
 p_lead_id uuid,p_kind text,p_result text DEFAULT NULL,p_note text DEFAULT NULL,
 p_follow_up_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_event uuid;v_kind text:=nullif(trim(coalesce(p_kind,'')),'');
 v_result text:=nullif(trim(coalesce(p_result,'')),'');
 v_note text:=nullif(trim(coalesce(p_note,'')),'');v_type text;v_existing uuid;
BEGIN
 IF v_actor IS NULL OR p_lead_id IS NULL OR v_kind NOT IN('call','note','follow_up','appointment')
 THEN RAISE EXCEPTION 'Invalid session, lead, or activity' USING ERRCODE='22023';END IF;
 IF v_result IS NOT NULL AND v_result NOT IN
 ('no_answer','voicemail','interested','not_interested','callback','appointment','wrong_number','other')
 THEN RAISE EXCEPTION 'Invalid call result' USING ERRCODE='22023';END IF;
 IF v_kind='call' AND v_result IS NULL THEN RAISE EXCEPTION 'Call result required';END IF;
 IF v_kind='note' AND v_note IS NULL THEN RAISE EXCEPTION 'Note required';END IF;
 IF length(coalesce(v_note,''))>2000 THEN RAISE EXCEPTION 'Note too long';END IF;
 IF v_kind IN('follow_up','appointment') AND p_follow_up_at IS NULL
 THEN RAISE EXCEPTION 'Date and time required';END IF;
 IF p_follow_up_at IS NOT NULL AND p_follow_up_at<now()-interval '5 minutes'
 THEN RAISE EXCEPTION 'Follow-up must be in the future';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_distribution_assignments a
 JOIN public.agent_profiles p ON p.id=a.agent_id
 WHERE a.lead_id=p_lead_id AND a.agent_id=v_actor AND a.ended_at IS NULL AND p.role='agent')
 THEN RAISE EXCEPTION 'Lead not assigned to your account' USING ERRCODE='42501';END IF;
 -- Serialize entries from same agent for this lead, including overlapping browser requests.
 PERFORM 1 FROM public.flc_distribution_leads l WHERE l.id=p_lead_id FOR UPDATE;
 v_type:=CASE v_kind WHEN 'call' THEN 'agent_call_logged'
 WHEN 'note' THEN 'agent_note_logged'
 WHEN 'appointment' THEN 'agent_appointment_logged'
 ELSE 'agent_follow_up_logged' END;
 SELECT e.id INTO v_existing FROM public.flc_distribution_events e
 WHERE e.lead_id=p_lead_id AND e.actor_id=v_actor AND e.event_type=v_type
 AND e.created_at>=now()-interval '90 seconds'
 AND e.details->>'result' IS NOT DISTINCT FROM v_result
 AND e.details->>'note' IS NOT DISTINCT FROM v_note
 AND (e.details->>'follow_up_at')::timestamptz IS NOT DISTINCT FROM p_follow_up_at
 AND NOT EXISTS(SELECT 1 FROM public.flc_distribution_events x
 WHERE x.lead_id=p_lead_id AND x.event_type='agent_activity_voided'
 AND x.details->>'voided_event_id'=e.id::text)
 ORDER BY e.created_at DESC LIMIT 1;
 IF v_existing IS NOT NULL THEN
  RETURN jsonb_build_object('saved',false,'duplicate_prevented',true,'event_id',v_existing);
 END IF;
 INSERT INTO public.flc_distribution_events(lead_id,agent_id,actor_id,event_type,details)
 VALUES(p_lead_id,v_actor,v_actor,v_type,
 jsonb_build_object('kind',v_kind,'result',v_result,'note',v_note,
 'follow_up_at',p_follow_up_at,'entered_manually',true,'crm_synced',false))
 RETURNING id INTO v_event;
 RETURN jsonb_build_object('saved',true,'event_id',v_event,'crm_synced',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_record_activity(uuid,text,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_record_activity(uuid,text,text,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_void_activity(
 p_lead_id uuid,p_event_id uuid,p_reason text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_actor uuid:=auth.uid();v_event public.flc_distribution_events%ROWTYPE;
 v_reason text:=btrim(coalesce(p_reason,''));v_void uuid;
BEGIN
 IF v_actor IS NULL OR p_lead_id IS NULL OR p_event_id IS NULL
 THEN RAISE EXCEPTION 'Missing session or activity';END IF;
 IF length(v_reason)<5 OR length(v_reason)>500
 THEN RAISE EXCEPTION 'Write a reason of 5 to 500 characters';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.agent_profiles p WHERE p.id=v_actor AND p.role='agent')
 THEN RAISE EXCEPTION 'Agent access only' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.flc_distribution_assignments a
 WHERE a.lead_id=p_lead_id AND a.agent_id=v_actor AND a.ended_at IS NULL)
 THEN RAISE EXCEPTION 'Lead not assigned to you' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.flc_distribution_leads l WHERE l.id=p_lead_id FOR UPDATE;
 SELECT * INTO v_event FROM public.flc_distribution_events e
 WHERE e.id=p_event_id AND e.lead_id=p_lead_id AND e.actor_id=v_actor
 AND e.event_type IN('agent_call_logged','agent_note_logged','agent_follow_up_logged','agent_appointment_logged');
 IF NOT FOUND THEN RAISE EXCEPTION 'Only your own manual activity can be voided' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.flc_distribution_events e
 WHERE e.lead_id=p_lead_id AND e.event_type='agent_activity_voided'
 AND e.details->>'voided_event_id'=p_event_id::text)
 THEN RAISE EXCEPTION 'Activity already voided';END IF;
 INSERT INTO public.flc_distribution_events(lead_id,agent_id,actor_id,event_type,details)
 VALUES(p_lead_id,v_actor,v_actor,'agent_activity_voided',
 jsonb_build_object('voided_event_id',p_event_id,'reason',v_reason,'crm_synced',false))
 RETURNING id INTO v_void;
 RETURN jsonb_build_object('voided',true,'void_event_id',v_void);
END;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_void_activity(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_void_activity(uuid,uuid,text) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname IN
 ('flc_distribution_record_activity','flc_distribution_void_activity') ORDER BY proname;