-- FLC Academy MAIN: Round Robin infrastructure + READ-ONLY preview.
-- No automatic assignment, email, call, webhook, or availability change.
-- Queue is FIFO within each campaign/state. Real assignments must later
-- lock the cursor row transactionally and advance it ONLY on success.
BEGIN;

CREATE TABLE IF NOT EXISTS public.flc_distribution_rr_cursor (
  campaign_code text NOT NULL REFERENCES public.flc_distribution_campaigns(code),
  state_code text NOT NULL,
  last_agent_id uuid REFERENCES public.agent_profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_code,state_code)
);
ALTER TABLE public.flc_distribution_rr_cursor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_distribution_rr_cursor FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_distribution_round_robin_preview(
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  lead_id uuid,
  contact_name text,
  source_campaign text,
  state_code text,
  eligible_count bigint,
  suggested_agent_id uuid,
  suggested_agent_name text,
  decision text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
WITH pending AS (
 SELECT l.id,trim(concat_ws(' ',l.first_name,l.last_name)) AS contact_name,
    l.source_campaign,l.lead_state,l.received_at,
    row_number() OVER(
      PARTITION BY l.source_campaign,l.lead_state
      ORDER BY l.received_at,l.id
    ) AS lead_turn
 FROM public.flc_distribution_leads l
 WHERE l.status='pending'
   AND NOT EXISTS (
     SELECT 1 FROM public.flc_distribution_assignments a
     WHERE a.lead_id=l.id AND a.ended_at IS NULL
   )
 ORDER BY l.received_at,l.id
 LIMIT least(greatest(coalesce(p_limit,100),1),200)
), qualified AS (
 SELECT p.source_campaign,p.lead_state,ap.id AS agent_id,
        ap.full_name AS agent_name,
        row_number() OVER (
          PARTITION BY p.source_campaign,p.lead_state
          ORDER BY ap.full_name,ap.id
        ) AS agent_turn,
        count(*) OVER (
          PARTITION BY p.source_campaign,p.lead_state
        ) AS eligible_count
 FROM (SELECT DISTINCT source_campaign,lead_state FROM pending) p
 JOIN public.flc_distribution_campaigns camp
   ON camp.code=p.source_campaign AND camp.enabled
 JOIN public.flc_distribution_agent_campaigns ac
   ON ac.campaign_code=p.source_campaign AND ac.enabled
 JOIN public.agent_profiles ap
   ON ap.id=ac.agent_id AND ap.role='agent'
 JOIN public.flc_distribution_agent_states st
   ON st.agent_id=ap.id AND st.state_code=p.lead_state
 JOIN public.flc_distribution_agent_availability av
   ON av.agent_id=ap.id AND av.is_verified=true
), cursor_rank AS (
 SELECT q.source_campaign,q.lead_state,
        COALESCE(MAX(q.agent_turn) FILTER(
          WHERE q.agent_id=rr.last_agent_id
        ),0) AS last_turn
 FROM qualified q
 LEFT JOIN public.flc_distribution_rr_cursor rr
   ON rr.campaign_code=q.source_campaign AND rr.state_code=q.lead_state
 GROUP BY q.source_campaign,q.lead_state
)
SELECT p.id,p.contact_name,p.source_campaign,p.lead_state,
       coalesce(c.eligible_count,0)::bigint,
       q.agent_id,q.agent_name,
       CASE WHEN c.eligible_count IS NULL THEN 'hold_no_available_agent'
            ELSE 'ready_for_manual_review' END
FROM pending p
LEFT JOIN (
 SELECT source_campaign,lead_state,max(eligible_count) AS eligible_count
 FROM qualified
 GROUP BY source_campaign,lead_state
) c ON c.source_campaign=p.source_campaign
    AND c.lead_state IS NOT DISTINCT FROM p.lead_state
LEFT JOIN cursor_rank cr
  ON cr.source_campaign=p.source_campaign
 AND cr.lead_state IS NOT DISTINCT FROM p.lead_state
LEFT JOIN qualified q
  ON q.source_campaign=p.source_campaign
 AND q.lead_state IS NOT DISTINCT FROM p.lead_state
 AND q.agent_turn=(((cr.last_turn+p.lead_turn-1)::bigint % c.eligible_count)+1)
WHERE auth.uid() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.agent_profiles x
 WHERE x.id=auth.uid() AND x.role='admin'
)
ORDER BY p.received_at,p.id;
$fn$;

REVOKE ALL ON FUNCTION public.flc_distribution_round_robin_preview(integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_round_robin_preview(integer)
TO authenticated;
COMMIT;

SELECT proname FROM pg_proc
WHERE proname='flc_distribution_round_robin_preview';
