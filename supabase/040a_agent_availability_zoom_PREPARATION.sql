-- FLC Zoom presence gate + Academy Disponible lease (DRAFT; STAGING ONLY).
-- Prerequisites: 007 team hierarchy and 041 campaign tables.
-- DEPLOY THIS before 041 motor. Exact Zoom meeting IDs managed server-side.
-- A participant must be in an authorized Zoom session, verified by Zoom API/webhooks.
-- Browser checkboxes or self-claims never grant Zoom presence.

CREATE TABLE IF NOT EXISTS public.flc_lead_agent_presence (
 agent_id uuid PRIMARY KEY REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 is_available boolean NOT NULL DEFAULT false,
 lease_expires_at timestamptz NOT NULL DEFAULT now(),
 last_heartbeat_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.flc_zoom_authorized_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_leader_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 zoom_meeting_id text NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 UNIQUE(owner_leader_id,zoom_meeting_id)
);
CREATE TABLE IF NOT EXISTS public.flc_zoom_agent_presence (
 agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES public.flc_zoom_authorized_sessions(id) ON DELETE CASCADE,
 zoom_participant_id text NOT NULL,
 verified_at timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 is_present boolean NOT NULL DEFAULT false,
 PRIMARY KEY(agent_id,session_id)
);
CREATE INDEX IF NOT EXISTS flc_zoom_agent_presence_gate_idx
 ON public.flc_zoom_agent_presence(agent_id,is_present,valid_until DESC);

ALTER TABLE public.flc_lead_agent_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_zoom_authorized_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flc_zoom_agent_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_lead_agent_presence,
 public.flc_zoom_authorized_sessions,public.flc_zoom_agent_presence
 FROM PUBLIC,anon,authenticated;

-- Admin ONLY chooses enrolled participants; default enrollments do not exist.
CREATE OR REPLACE FUNCTION public.flc_admin_set_lead_participation(
 p_campaign_rule_id uuid,p_agent_id uuid,p_enabled boolean,
 p_excluded_states text[] DEFAULT ARRAY[]::text[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_owner uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.flc_is_admin() THEN
  RAISE EXCEPTION 'Only admin authorizes participation' USING ERRCODE='42501';
 END IF;
 SELECT owner_leader_id INTO v_owner FROM public.flc_lead_campaign_rules WHERE id=p_campaign_rule_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 IF NOT public.flc_agent_in_owner_team(v_owner,p_agent_id) THEN
  RAISE EXCEPTION 'Agent is outside campaign team';
 END IF;
 IF EXISTS(SELECT 1 FROM unnest(COALESCE(p_excluded_states,ARRAY[]::text[])) s WHERE s !~ '^[A-Z]{2}$') THEN
  RAISE EXCEPTION 'Excluded states must be uppercase 2-letter codes';
 END IF;
 INSERT INTO public.flc_lead_campaign_agents(campaign_rule_id,agent_id,enabled,excluded_states)
 VALUES(p_campaign_rule_id,p_agent_id,p_enabled,COALESCE(p_excluded_states,ARRAY[]::text[]))
 ON CONFLICT(campaign_rule_id,agent_id) DO UPDATE
 SET enabled=excluded.enabled,excluded_states=excluded.excluded_states;
 -- Disable immediately if agent is no longer enrolled in any active campaign.
 IF NOT EXISTS (
  SELECT 1 FROM public.flc_lead_campaign_agents ca
  JOIN public.flc_lead_campaign_rules r ON r.id=ca.campaign_rule_id
  WHERE ca.agent_id=p_agent_id AND ca.enabled AND r.enabled
 ) THEN
  UPDATE public.flc_lead_agent_presence SET is_available=false,lease_expires_at=now()
  WHERE agent_id=p_agent_id;
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.flc_admin_set_lead_participation(uuid,uuid,boolean,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_admin_set_lead_participation(uuid,uuid,boolean,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.flc_my_lead_participation()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.flc_lead_campaign_agents ca
  JOIN public.flc_lead_campaign_rules r ON r.id=ca.campaign_rule_id
  WHERE ca.agent_id=auth.uid() AND ca.enabled AND r.enabled
    AND public.flc_agent_in_owner_team(r.owner_leader_id,ca.agent_id)
 );
$$;
REVOKE ALL ON FUNCTION public.flc_my_lead_participation() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_my_lead_participation() TO authenticated;

-- Only own session can toggle Disponible. A 90-second lease is renewed by
-- explicit client heartbeat; if tab closes/connectivity stops, lease expires.
CREATE OR REPLACE FUNCTION public.flc_set_my_lead_availability(p_available boolean)
RETURNS TABLE(is_available boolean,lease_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_available AND NOT public.flc_my_lead_participation() THEN
  RAISE EXCEPTION 'Not authorized to receive leads' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.flc_lead_agent_presence(agent_id,is_available,lease_expires_at,last_heartbeat_at)
 VALUES(auth.uid(),p_available,
  CASE WHEN p_available THEN clock_timestamp()+interval '90 seconds' ELSE clock_timestamp() END,
  CASE WHEN p_available THEN clock_timestamp() ELSE NULL END)
 ON CONFLICT(agent_id) DO UPDATE SET
  is_available=excluded.is_available,
  lease_expires_at=excluded.lease_expires_at,
  last_heartbeat_at=excluded.last_heartbeat_at,
  updated_at=clock_timestamp();
 RETURN QUERY SELECT p.is_available,p.lease_expires_at
 FROM public.flc_lead_agent_presence p WHERE p.agent_id=auth.uid();
END;$$;
REVOKE ALL ON FUNCTION public.flc_set_my_lead_availability(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_set_my_lead_availability(boolean) TO authenticated;

-- Called only from server-side Zoom verifier using a privileged role.
-- Never expose direct client INSERT/UPDATE to Zoom presence tables.
-- Zoom participant identity must be linked securely to agent user id.
-- Refresh signed Zoom webhooks or periodic participant poll; leave event
-- sets is_present=false. Stale session automatically fails after valid_until.
CREATE OR REPLACE FUNCTION public.flc_zoom_presence_verified(p_agent uuid,p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS (
  SELECT 1
  FROM public.flc_zoom_agent_presence zp
  JOIN public.flc_zoom_authorized_sessions zs ON zs.id=zp.session_id
  WHERE zp.agent_id=p_agent AND zs.owner_leader_id=p_owner AND zs.enabled
    AND zp.is_present AND zp.valid_until > clock_timestamp()
 );
$$;
REVOKE ALL ON FUNCTION public.flc_zoom_presence_verified(uuid,uuid) FROM PUBLIC,anon;
-- This check is invoked by trusted SECURITY DEFINER lead assignment functions.
