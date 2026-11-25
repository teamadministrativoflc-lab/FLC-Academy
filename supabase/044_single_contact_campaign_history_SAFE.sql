-- 044: Preserve one AuraFlow contact across multiple campaign submissions.
-- Run on MAIN academy fvhbzutxaoujtnnjzhlk after review.
-- Does not assign agents, change existing records, or touch Google Sheets.
BEGIN;
-- Each new campaign transition gets one event. Repeated identical deliveries
-- do not produce a new history event.
CREATE OR REPLACE FUNCTION public.flc_distribution_ingest_contact(
  p_source_crm text,
  p_source_contact_id text,
  p_campaign text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_state text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_lead public.flc_distribution_leads%ROWTYPE;
  v_inserted boolean := false;
  v_changed boolean := false;
  v_old_campaign text;
BEGIN
  -- Only service_role (from authenticated Edge Function) can use this RPC.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF NULLIF(trim(coalesce(p_source_crm,'')),'') IS NULL OR
     NULLIF(trim(coalesce(p_source_contact_id,'')),'') IS NULL THEN
    RAISE EXCEPTION 'missing_identity' USING ERRCODE='22023';
  END IF;
  IF length(p_source_crm)>80 OR length(p_source_contact_id)>200 THEN
    RAISE EXCEPTION 'identity_too_long' USING ERRCODE='22023';
  END IF;
  IF nullif(trim(coalesce(p_phone,'')),'') IS NULL AND
     nullif(trim(coalesce(p_email,'')),'') IS NULL THEN
    RAISE EXCEPTION 'missing_contact_info' USING ERRCODE='22023';
  END IF;

  -- Concurrent submissions of the same CRM contact are serialized using
  -- unique-index conflict control plus a row lock.
  INSERT INTO public.flc_distribution_leads
    (source_crm,source_contact_id,source_campaign,first_name,last_name,
     phone,email,lead_state)
  VALUES (
    trim(p_source_crm),trim(p_source_contact_id),
    coalesce(nullif(trim(p_campaign),''),'PENDIENTE_IDENTIFICAR'),
    nullif(trim(coalesce(p_first_name,'')),''),
    nullif(trim(coalesce(p_last_name,'')),''),
    nullif(trim(coalesce(p_phone,'')),''),
    nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_state,'')),'')
  )
  ON CONFLICT (source_crm,source_contact_id) DO NOTHING
  RETURNING * INTO v_lead;

  IF FOUND THEN
    v_inserted := true;
    INSERT INTO public.flc_distribution_events
      (lead_id,event_type,details)
    VALUES (
      v_lead.id,'lead_received',
      jsonb_build_object('campaign',v_lead.source_campaign,'source_crm',v_lead.source_crm)
    );
  ELSE
    SELECT * INTO v_lead
    FROM public.flc_distribution_leads
    WHERE source_crm=trim(p_source_crm)
      AND source_contact_id=trim(p_source_contact_id)
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'contact_upsert_failed'; END IF;
    v_old_campaign := v_lead.source_campaign;
    v_changed := v_old_campaign IS DISTINCT FROM
      coalesce(nullif(trim(p_campaign),''),'PENDIENTE_IDENTIFICAR');

    UPDATE public.flc_distribution_leads l SET
      source_campaign = CASE
        WHEN nullif(trim(coalesce(p_campaign,'')),'') IS NOT NULL
          THEN trim(p_campaign) ELSE l.source_campaign END,
      first_name=coalesce(nullif(trim(coalesce(p_first_name,'')),''),l.first_name),
      last_name=coalesce(nullif(trim(coalesce(p_last_name,'')),''),l.last_name),
      phone=coalesce(nullif(trim(coalesce(p_phone,'')),''),l.phone),
      email=coalesce(nullif(trim(coalesce(p_email,'')),''),l.email),
      lead_state=coalesce(nullif(trim(coalesce(p_state,'')),''),l.lead_state),
      updated_at=now()
    WHERE l.id=v_lead.id
    RETURNING * INTO v_lead;

    IF v_changed THEN
      INSERT INTO public.flc_distribution_events (lead_id,event_type,details)
      VALUES (v_lead.id,'campaign_changed',
        jsonb_build_object('previous_campaign',v_old_campaign,
          'new_campaign',v_lead.source_campaign,'source_crm',v_lead.source_crm));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'accepted',true,
    'inserted',v_inserted,
    'duplicate',NOT v_inserted,
    'campaign_updated',v_changed,
    'assignment_created',false
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_ingest_contact(
 text,text,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.flc_distribution_ingest_contact(
 text,text,text,text,text,text,text,text) TO service_role;

-- Required permission grants for the server-to-server operation only.
GRANT SELECT,INSERT,UPDATE ON public.flc_distribution_leads TO service_role;
GRANT INSERT ON public.flc_distribution_events TO service_role;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_ingest_contact';
