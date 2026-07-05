-- ================================================================
-- capture_sessions.extraccion — payload cacheado del resultado de
-- Gemini Vision (JSON { renglones: [...] }), mientras Almacén no
-- confirma la revisión (ver Edge Function procesar-vision en
-- SCHEMA.md §4 y §5). error_mensaje guarda el motivo si el
-- procesamiento falla, para mostrarlo en el modal de QR.
-- ================================================================
alter table capture_sessions
  add column if not exists extraccion    jsonb,
  add column if not exists error_mensaje text;
