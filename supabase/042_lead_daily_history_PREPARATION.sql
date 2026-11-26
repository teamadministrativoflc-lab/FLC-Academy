-- Daily lead history date/time snapshots, based on FLC four-zone convention.
-- DRAFT ONLY. Depends on 038.
-- The 4 labels are presentation fields; IANA keys are internal only.
-- Arizona: business label Mountain, UTC-7 in most places (verify exceptions).
-- For unknown/ambiguous zones, local_date remains NULL; never fabricate.
CREATE OR REPLACE FUNCTION public.flc_lead_event_set_local_date()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE v_label text; v_iana text;
BEGIN
 SELECT timezone_label,timezone_iana INTO v_label,v_iana
 FROM public.flc_leads WHERE id=NEW.lead_id;
 NEW.timezone_label_at_event:=v_label;
 IF v_label IS NOT NULL AND v_iana IS NOT NULL THEN
   NEW.local_date_at_event := (NEW.event_at AT TIME ZONE v_iana)::date;
 ELSE
   NEW.local_date_at_event := NULL;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS flc_lead_events_local_date_trigger ON public.flc_lead_events;
CREATE TRIGGER flc_lead_events_local_date_trigger
BEFORE INSERT ON public.flc_lead_events
FOR EACH ROW EXECUTE FUNCTION public.flc_lead_event_set_local_date();

-- Prevent unauthorized mutation of recorded history through future REST grants.
-- Existing service-role superuser can still bypass triggers: restrict service access.
CREATE OR REPLACE FUNCTION public.flc_lead_event_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 RAISE EXCEPTION 'Lead audit events are append-only';
END;$$;
DROP TRIGGER IF EXISTS flc_lead_events_immutable_trigger ON public.flc_lead_events;
CREATE TRIGGER flc_lead_events_immutable_trigger
BEFORE UPDATE OR DELETE ON public.flc_lead_events
FOR EACH ROW EXECUTE FUNCTION public.flc_lead_event_immutable();

-- Day-grouped history should use local_date_at_event when populated. Never
-- recompute past local dates from the lead's current zone after a zone change.
