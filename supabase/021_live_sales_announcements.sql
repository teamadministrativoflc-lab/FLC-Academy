-- Preview: read-only live sales announcements for authenticated FLC agents.
-- Client name is visible to signed-in agents by agency owner request.
-- Do not include policy numbers, contact details, health data or addresses.
-- Existing policies remain untouched; only NEW submissions create posts.
CREATE TABLE IF NOT EXISTS public.flc_sale_announcements (
 policy_id uuid PRIMARY KEY REFERENCES public.flc_policy_sales(id) ON DELETE CASCADE,
 principal_agent_id uuid NOT NULL REFERENCES public.agent_profiles(id),
 principal_name text NOT NULL,
 client_name text NOT NULL DEFAULT '',
 carrier text NOT NULL,
 product_type text NOT NULL,
 total_ap numeric(12,2) NOT NULL,
 status text NOT NULL DEFAULT 'Sometida',
 participants jsonb NOT NULL DEFAULT '[]'::jsonb,
 announced_at timestamptz NOT NULL DEFAULT now()
);
-- If SQL 021 was already executed, add columns without dropping records.
ALTER TABLE public.flc_sale_announcements ADD COLUMN IF NOT EXISTS client_name text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS flc_sale_announcements_recent_idx
 ON public.flc_sale_announcements(announced_at DESC);
ALTER TABLE public.flc_sale_announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flc_sale_announcements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.flc_sale_announcements TO authenticated;
DROP POLICY IF EXISTS flc_sale_announcements_authenticated_read ON public.flc_sale_announcements;
CREATE POLICY flc_sale_announcements_authenticated_read
 ON public.flc_sale_announcements FOR SELECT TO authenticated
 USING(auth.uid() IS NOT NULL);

-- SECURITY DEFINER: policy insert and multi-split allocations are authored
-- through the existing vetted database paths. Agents cannot write the feed.
CREATE OR REPLACE FUNCTION public.flc_refresh_sale_announcement(p_policy_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE p record; v_people jsonb;
BEGIN
 SELECT s.id,s.agent_id,s.client_name,s.carrier,s.product_type,s.annual_premium,s.status,
  a.full_name AS principal_name
 INTO p FROM public.flc_policy_sales s
 JOIN public.agent_profiles a ON a.id=s.agent_id
 WHERE s.id=p_policy_id;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'name',a.full_name,'percent',c.percent,
  'credited_ap',round(p.annual_premium*c.percent/100,2),
  'is_primary',c.agent_id=p.agent_id
 ) ORDER BY (c.agent_id=p.agent_id) DESC,a.full_name),'[]'::jsonb)
 INTO v_people
 FROM public.flc_policy_allocation c
 JOIN public.agent_profiles a ON a.id=c.agent_id
 WHERE c.policy_id=p_policy_id;
 INSERT INTO public.flc_sale_announcements
  (policy_id,principal_agent_id,principal_name,client_name,carrier,product_type,total_ap,status,participants)
 VALUES(p.id,p.agent_id,p.principal_name,p.client_name,p.carrier,p.product_type,p.annual_premium,'Sometida',v_people)
 ON CONFLICT(policy_id) DO UPDATE SET participants=EXCLUDED.participants,client_name=EXCLUDED.client_name;
END;
$$;
REVOKE ALL ON FUNCTION public.flc_refresh_sale_announcement(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.flc_sale_announcement_on_policy_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 PERFORM public.flc_refresh_sale_announcement(NEW.id);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS flc_announce_new_sale ON public.flc_policy_sales;
CREATE TRIGGER flc_announce_new_sale AFTER INSERT ON public.flc_policy_sales
FOR EACH ROW EXECUTE FUNCTION public.flc_sale_announcement_on_policy_insert();

CREATE OR REPLACE FUNCTION public.flc_sale_announcement_on_multi_split()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$ BEGIN
 PERFORM public.flc_refresh_sale_announcement(NEW.policy_id);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS flc_announce_multi_split ON public.flc_policy_multi_credits;
CREATE TRIGGER flc_announce_multi_split AFTER INSERT ON public.flc_policy_multi_credits
FOR EACH ROW EXECUTE FUNCTION public.flc_sale_announcement_on_multi_split();

-- Add only the announcement metadata table to Supabase Realtime.
DO $$ BEGIN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.flc_sale_announcements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
