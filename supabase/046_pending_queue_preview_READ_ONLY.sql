-- FLC Academy MAIN — agent eligibility and pending lead preview, READ ONLY.
-- Does not assign, notify, or change leads. Admin only.
BEGIN;
CREATE OR REPLACE FUNCTION public.flc_distribution_preview_pending(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  lead_id uuid,
  contact_name text,
  source_campaign text,
  state_code text,
  received_at timestamptz,
  eligible_count bigint,
  suggested_agent_id uuid,
  suggested_agent_name text,
  decision text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
WITH pending AS (
 SELECT l.id, trim(concat_ws(' ',l.first_name,l.last_name)) AS contact_name,
        l.source_campaign, l.lead_state, l.received_at
 FROM public.flc_distribution_leads l
 WHERE l.status='pending'
   AND NOT EXISTS (
     SELECT 1 FROM public.flc_distribution_assignments asg
     WHERE asg.lead_id=l.id AND asg.ended_at IS NULL
   )
 ORDER BY l.received_at ASC
 LIMIT least(greatest(coalesce(p_limit,100),1),200)
),
qualified AS (
 SELECT l.id AS lead_id,p.id AS agent_id,p.full_name AS agent_name,
        row_number() over (partition by l.id ORDER BY p.full_name,p.id) AS rn
 FROM pending l
 JOIN public.flc_distribution_campaigns c
   ON c.code=l.source_campaign AND c.enabled=true
 JOIN public.flc_distribution_agent_campaigns ac
   ON ac.campaign_code=c.code AND ac.enabled=true
 JOIN public.agent_profiles p
   ON p.id=ac.agent_id AND p.role='agent'
 JOIN public.flc_distribution_agent_states st
   ON st.agent_id=p.id AND st.state_code=l.lead_state
 JOIN public.flc_distribution_agent_availability av
   ON av.agent_id=p.id AND av.is_verified=true
)
SELECT l.id,l.contact_name,l.source_campaign,l.lead_state,l.received_at,
       count(q.agent_id)::bigint,
       (max(q.agent_id::text) FILTER (WHERE q.rn=1))::uuid,
       max(q.agent_name) FILTER (WHERE q.rn=1),
       CASE WHEN count(q.agent_id)=0 THEN 'hold_no_available_agent'
         ELSE 'ready_for_manual_review' END
FROM pending l LEFT JOIN qualified q ON q.lead_id=l.id
WHERE auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.agent_profiles admin_p
 WHERE admin_p.id=auth.uid() AND admin_p.role='admin'
)
GROUP BY l.id,l.contact_name,l.source_campaign,l.lead_state,l.received_at
ORDER BY l.received_at ASC;
$fn$;
REVOKE ALL ON FUNCTION public.flc_distribution_preview_pending(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flc_distribution_preview_pending(integer) TO authenticated;
COMMIT;
SELECT proname FROM pg_proc WHERE proname='flc_distribution_preview_pending';
