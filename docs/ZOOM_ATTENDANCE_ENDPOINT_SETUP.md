# Zoom Attendance webhook — preparación segura

**Estado:** Código únicamente en GitHub, rama `feature/lead-distribution-foundation-20261123`. NO desplegado en Supabase. Ninguna URL debe copiarse a Zoom todavía.

## Pasos de despliegue (solo con autorización de Nationwide)

1. Revisar el código `supabase/functions/zoom-attendance-webhook/index.ts`.
2. En Supabase, desplegar una Edge Function llamada `zoom-attendance-webhook`.
3. Configurar `ZOOM_WEBHOOK_SECRET_TOKEN` usando **Secrets** del proyecto, con el Secret Token regenerado de Zoom. Nunca introducirlo en chat o código fuente.
4. Dado que Zoom no envía JWT de Supabase, configurar esta función para aceptar solicitudes sin JWT. **Esto no desactiva la autenticación del webhook**: el endpoint valida el CRC y firma HMAC en la propia función.
5. Obtener desde Supabase la URL **real** de la función desplegada. No adivinarla.
6. Pegar en Zoom como `Event notification endpoint URL` y usar `Validate`. Zoom envía `endpoint.url_validation`; el endpoint responde con `plainToken` y `encryptedToken` (HMAC-SHA256).
7. Confirmar el control de Zoom de los eventos `meeting.participant_joined` y `meeting.participant_left`. Activar solamente después de validar alcance y autorización del propietario de la cuenta.

## Notas críticas
- Esta primera función **solo valida firmas y acepta mensajes**. NO actualiza presencia de agentes.
- No basta con nombre mostrado ni correo no verificado para unir cuentas Zoom/Academy.
- Para habilitar recepción de leads falta vincular identidad real, identificar reunión autorizada, deduplicar eventos, manejar la salida y caducidad, y probar contra Zoom. El motor Supabase **falla cerrado** hasta confirmar asistencia.
- No copiar el Account ID, Client ID, Client Secret ni Secret Token al chat ni a GitHub.
- Evitar registros persistentes de contenidos completos del webhook, datos personales o secretos.
- Las notificaciones de Zoom pueden llegar tarde o perderse: además de Webhooks, planear comprobaciones periódicas antes de asignar un lead.

Documentación: https://developers.zoom.us/docs/api/webhooks/
