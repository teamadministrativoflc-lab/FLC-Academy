-- FLC Academy: ISOLATED Round Robin + ownership simulation
-- Read-only relative to production: temporary tables ONLY. No real contacts,
-- users, permissions, RLS policies, availability, or CRM records are changed.
BEGIN;
CREATE TEMP TABLE flc_rr_test_agents (
 agent_key text PRIMARY KEY,
 campaign text NOT NULL,
 state_code text NOT NULL,
 eligible boolean NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE flc_rr_test_leads (
 lead_number integer PRIMARY KEY,
 campaign text NOT NULL,
 state_code text NOT NULL,
 assigned_to text
) ON COMMIT DROP;

INSERT INTO flc_rr_test_agents VALUES
 ('Agente Prueba A','IUL_TIKTOK_ESPANOL','NY',true),
 ('Agente Prueba B','IUL_TIKTOK_ESPANOL','NY',true),
 ('Agente Prueba C','IUL_TIKTOK_ESPANOL','NY',false);
INSERT INTO flc_rr_test_leads(lead_number,campaign,state_code)
SELECT n,'IUL_TIKTOK_ESPANOL','NY' FROM generate_series(1,6) n;

WITH eligible AS (
 SELECT agent_key,row_number() OVER (ORDER BY agent_key) AS position
 FROM flc_rr_test_agents
 WHERE eligible AND campaign='IUL_TIKTOK_ESPANOL' AND state_code='NY'
), total AS (
 SELECT count(*) AS n FROM eligible
), proposed AS (
 SELECT l.lead_number,e.agent_key
 FROM flc_rr_test_leads l
 CROSS JOIN total t
 JOIN eligible e ON e.position=((l.lead_number-1)%NULLIF(t.n,0))+1
)
UPDATE flc_rr_test_leads l SET assigned_to=p.agent_key
FROM proposed p WHERE l.lead_number=p.lead_number;

-- Visibility simulation: each agent sees ONLY their own assigned contacts.
-- This is NOT a live authenticated RLS test; it checks selection logic only.
SELECT
 l.lead_number,
 l.assigned_to,
 (l.assigned_to='Agente Prueba A') AS visible_para_A,
 (l.assigned_to='Agente Prueba B') AS visible_para_B,
 (l.assigned_to='Agente Prueba C') AS visible_para_C
FROM flc_rr_test_leads l
ORDER BY l.lead_number;

-- Assertions: A/B alternate; inactive C gets none; no lead unassigned;
-- test contact visibility is exclusive to the assigned agent.
DO $$
DECLARE problems integer;
BEGIN
 SELECT count(*) INTO problems
 FROM flc_rr_test_leads l
 WHERE l.assigned_to IS NULL
    OR l.assigned_to = 'Agente Prueba C'
    OR l.assigned_to IS DISTINCT FROM
        (CASE WHEN l.lead_number%2=1 THEN 'Agente Prueba A'
              ELSE 'Agente Prueba B' END);
 IF problems>0 THEN
    RAISE EXCEPTION 'Round Robin simulation FAILED: % failures',problems;
 END IF;
 RAISE NOTICE 'PASS: 6 fictitious leads alternate between A/B; inactive C excluded';
END $$;
ROLLBACK; -- Ensures test objects/rows disappear immediately
