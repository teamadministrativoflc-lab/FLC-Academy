-- DIAGNÓSTICO DE ESTADOS AUSENTES — SOLO LECTURA.
-- No modifica leads, cupos, asignaciones ni reglas de licenciamiento.
-- Ejecutar únicamente en SQL Editor del proyecto Supabase MAIN.
SELECT
  l.source_campaign AS campana,
  lower(coalesce(l.source_crm,'(sin origen)')) AS origen,
  l.status AS situacion,
  CASE WHEN nullif(btrim(l.lead_state),'') IS NULL
    THEN 'SIN_ESTADO' ELSE 'CON_ESTADO' END AS estado_recibido,
  CASE
    WHEN nullif(btrim(l.source_contact_id),'') IS NULL THEN 'SIN_ID_CRM'
    WHEN l.source_contact_id LIKE 'FLC-%' THEN 'ID_DE_PRUEBA'
    WHEN l.source_contact_id ~ '^[[:alnum:]]{20}$' THEN 'ID_NATIVO_20'
    ELSE 'REVISAR_FORMATO_ID'
  END AS identificador_crm,
  count(*) AS leads,
  min(l.received_at AT TIME ZONE 'America/New_York')::date AS desde_et,
  max(l.received_at AT TIME ZONE 'America/New_York')::date AS hasta_et
FROM public.flc_distribution_leads l
GROUP BY 1,2,3,4,5
ORDER BY estado_recibido DESC, leads DESC, campana;

-- Identificar únicamente estadísticas de qué campañas requieren
-- recuperación del estado; no exponer nombres, teléfonos ni emails.
SELECT
  source_campaign AS campana,
  count(*) FILTER (WHERE status='pending') AS pendientes,
  count(*) FILTER (WHERE status='pending'
    AND nullif(btrim(lead_state),'') IS NULL) AS pendientes_sin_estado,
  count(*) FILTER (WHERE status='pending'
    AND nullif(btrim(lead_state),'') IS NOT NULL) AS pendientes_con_estado
FROM public.flc_distribution_leads
GROUP BY source_campaign
ORDER BY pendientes_sin_estado DESC, campana;
