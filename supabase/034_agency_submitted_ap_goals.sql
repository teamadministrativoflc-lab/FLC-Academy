-- Step 619: Persistent, date-specific agency goals for SUBMITTED AP.
-- Read/write restricted to Administration; no existing policies are changed.
CREATE TABLE IF NOT EXISTS public.flc_agency_ap_goals (
 period_type text NOT NULL CHECK(period_type IN ('day','week','month','year')),
 period_start date NOT NULL,
 target_ap numeric(14,2) NOT NULL CHECK(target_ap>0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES public.agent_profiles(id),
 PRIMARY KEY(period_type,period_start)
);
ALTER TABLE public.flc_agency_ap_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_agency_ap_goals FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.flc_agency_ap_goals TO authenticated;
DROP POLICY IF EXISTS flc_agency_goals_admin_read ON public.flc_agency_ap_goals;
CREATE POLICY flc_agency_goals_admin_read ON public.flc_agency_ap_goals
 FOR SELECT TO authenticated USING(public.flc_is_admin());
DROP POLICY IF EXISTS flc_agency_goals_admin_insert ON public.flc_agency_ap_goals;
CREATE POLICY flc_agency_goals_admin_insert ON public.flc_agency_ap_goals
 FOR INSERT TO authenticated WITH CHECK(public.flc_is_admin() AND updated_by=auth.uid());
DROP POLICY IF EXISTS flc_agency_goals_admin_update ON public.flc_agency_ap_goals;
CREATE POLICY flc_agency_goals_admin_update ON public.flc_agency_ap_goals
 FOR UPDATE TO authenticated USING(public.flc_is_admin())
 WITH CHECK(public.flc_is_admin() AND updated_by=auth.uid());
