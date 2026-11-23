# FLC: política de cuatro zonas

**Zonas mostradas (exactamente 4):** Eastern, Central, Mountain y Pacific.

**Referencias técnicas internas** (sin mostrar ciudades en TimeZone):
- Eastern: America/New_York
- Central: America/Chicago
- Mountain: America/Denver
- Pacific: America/Los_Angeles (California, PST/PDT)

Las categorías son etiquetas de negocio y no equivalen a un offset GMT fijo. Las horas se calculan usando IANA y horario de verano automático. El script de preparación se encuentra en `docs/scripts/FLC_Zonas_4_Preparacion.gs`; su ejecución es inicialmente de solo lectura.

## Manejo de excepciones
- Arizona: etiqueta Mountain, reloj de UTC-7 todo el año en la mayor parte del estado. Lugares con excepciones (p.ej. Navajo Nation) requieren validación antes de usarlo para contacto.
- Estados de varias zonas: no se asignan arbitrariamente; requieren una selección válida y confirmada. Un campo opcional `Zona FLC Confirmada` admite Eastern/Central/Mountain/Pacific.
- Alaska, Hawaii y Puerto Rico: fuera de las cuatro zonas operativas. Quedan pendientes de revisión, nunca se clasifican falsamente como Pacific.
- El teléfono solo puede señalar posibles discrepancias, no determina por sí mismo residencia ni zona.
- No sustituir el reloj oficial del contacto por la zona horaria del agente.
- No modificar todavía la zona horaria global del Google Sheet ni los activadores de Apps Script.

## Pruebas antes de despliegue
1. Copiar el spreadsheet. Registrar reglas de triggers.
2. Ejecutar `flcNormalizarZonas4(true)` y revisar contadores.
3. Confirmar excepciones y corregir manualmente casos ambiguos.
4. Verificar que no se alteren fórmulas; probar permisos.
5. Ejecutar `flcNormalizarZonas4(false)` **solo en la copia**, después de revisión.
6. Integrar con historial de eventos por Lead ID y validar el flujo completo antes de considerar producción.

**Alcance actual:** solo borrador técnico en GitHub. No se han editado celdas ni ejecutado Apps Scripts.
