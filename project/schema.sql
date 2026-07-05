-- ================================================================
-- schema.sql — Control de Almacén · ROCK N' WOK
-- ================================================================
-- Ejecutar en Supabase → SQL Editor para crear el modelo completo.
-- Habilitar Row Level Security (RLS) y agregar políticas según
-- el sistema de autenticación antes de ir a producción.
-- ================================================================

-- ----------------------------------------------------------------
-- CAPTURE_SESSIONS
-- Una sesión por QR generado. Expira automáticamente.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capture_sessions (
  id          TEXT PRIMARY KEY,
  estatus     TEXT NOT NULL DEFAULT 'esperando_fotos'
                CHECK (estatus IN ('esperando_fotos','fotos_recibidas','completada','expirada')),
  expira_en   TIMESTAMPTZ NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Para limpiar sesiones expiradas (job noctурно o trigger)
CREATE INDEX IF NOT EXISTS idx_capture_sessions_expira
  ON capture_sessions (expira_en);


-- ----------------------------------------------------------------
-- FOTOS_REQUISICION
-- Fotos subidas desde el celular vía la URL del QR.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fotos_requisicion (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT        NOT NULL
                REFERENCES capture_sessions(id) ON DELETE CASCADE,
  url_storage TEXT        NOT NULL,    -- Path en bucket 'requisicion-fotos'
  procesada   BOOLEAN     NOT NULL DEFAULT false,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fotos_session
  ON fotos_requisicion (session_id);


-- ----------------------------------------------------------------
-- REQUISICIONES
-- Entidad central. Una por hoja física capturada.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requisiciones (
  id          TEXT        PRIMARY KEY,
  folio       TEXT        NOT NULL UNIQUE,  -- Ej. 'REQ-2025-024', viene del Excel Foodbot
  sucursal    TEXT        NOT NULL,
  fecha       DATE        NOT NULL,         -- Fecha de entrega confirmada en Fase 2
  -- estatus es SIEMPRE derivado (ver v_conciliacion) — esta columna es un cache opcional,
  -- no la fuente de verdad. pendiente_captura = sin renglones_reparto todavía.
  estatus     TEXT        NOT NULL DEFAULT 'pendiente_captura'
                CHECK (estatus IN ('pendiente_captura','conciliada','con_ajuste','con_diferencias')),
  session_id  TEXT        REFERENCES capture_sessions(id),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_req_folio    ON requisiciones (folio);
CREATE INDEX IF NOT EXISTS idx_req_sucursal ON requisiciones (sucursal);
CREATE INDEX IF NOT EXISTS idx_req_fecha    ON requisiciones (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_req_estatus  ON requisiciones (estatus);


-- ----------------------------------------------------------------
-- RENGLONES_REPARTO
-- Renglones extraídos por Claude Vision. INMUTABLES tras insert.
-- Los ajustes van en la tabla 'ajustes' — NUNCA hacer UPDATE aquí.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS renglones_reparto (
  id              TEXT           PRIMARY KEY,
  requisicion_id  TEXT           NOT NULL
                    REFERENCES requisiciones(id) ON DELETE CASCADE,
  producto        TEXT           NOT NULL,
  cantidad        NUMERIC(10,3)  NOT NULL,
  unidad          TEXT           NOT NULL,  -- kg, lt, pz, mz, pq, cja, gr
  costo           NUMERIC(10,2)  NOT NULL,  -- Costo unitario
  origen          TEXT           NOT NULL
                    CHECK (origen IN ('almacen','cocina')),
                    -- 'almacen': resaltado amarillo en hoja física
                    -- 'cocina' : resaltado naranja (requiere refrigeración)
  confianza_ocr   NUMERIC(4,3),             -- 0.0–1.0, NULL si se agregó manualmente
  creado_en       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renglon_req
  ON renglones_reparto (requisicion_id);


-- ----------------------------------------------------------------
-- RENGLONES_FOODBOT
-- Renglones del Excel de Foodbot. Se crean junto con la requisición
-- en Fase 1 (fila del Excel = producto esperado por esa sucursal).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS renglones_foodbot (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicion_id  TEXT           NOT NULL
                    REFERENCES requisiciones(id) ON DELETE CASCADE,
  producto        TEXT           NOT NULL,
  cantidad        NUMERIC(10,3)  NOT NULL,
  costo           NUMERIC(10,2)  NOT NULL,
  cargado_en      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_foodbot_req
  ON renglones_foodbot (requisicion_id);


-- ----------------------------------------------------------------
-- AJUSTES
-- Registro de auditoría inmutable.
-- Cada fila documenta una corrección con motivo, quién y cuándo.
-- NUNCA borrar ni actualizar filas en esta tabla.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ajustes (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  renglon_id          TEXT           NOT NULL
                        REFERENCES renglones_reparto(id),
  cantidad_anterior   NUMERIC(10,3)  NOT NULL,  -- Valor original en renglones_reparto
  cantidad_nueva      NUMERIC(10,3)  NOT NULL,  -- Valor corregido
  motivo              TEXT           NOT NULL,  -- Obligatorio
  usuario             TEXT           NOT NULL DEFAULT 'almacen',
  creado_en           TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_renglon
  ON ajustes (renglon_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_fecha
  ON ajustes (creado_en DESC);


-- ================================================================
-- VISTAS ÚTILES
-- ================================================================

-- Dashboard: resumen de requisiciones con importe y conteo de ajustes
CREATE OR REPLACE VIEW v_dashboard AS
SELECT
  r.id, r.folio, r.sucursal, r.fecha, r.estatus,
  COUNT(DISTINCT rr.id)                        AS total_renglones,
  COALESCE(SUM(rr.cantidad * rr.costo), 0)     AS importe_total,
  COUNT(DISTINCT a.id)                         AS total_ajustes
FROM requisiciones r
LEFT JOIN renglones_reparto rr ON rr.requisicion_id = r.id
LEFT JOIN ajustes            a  ON a.renglon_id = rr.id
GROUP BY r.id, r.folio, r.sucursal, r.fecha, r.estatus;


-- Conciliación: comparación renglón a renglón reparto vs Foodbot
CREATE OR REPLACE VIEW v_conciliacion AS
SELECT
  rr.id                                           AS renglon_id,
  rr.requisicion_id,
  req.folio,
  req.sucursal,
  rr.producto,
  rr.cantidad                                     AS cantidad_reparto,
  rf.cantidad                                     AS cantidad_foodbot,
  rr.costo,
  rr.unidad,
  rr.origen,
  rr.confianza_ocr,
  CASE
    WHEN rf.id IS NULL                            THEN 'no_encontrado'
    WHEN rr.cantidad = rf.cantidad                THEN 'ok'
    WHEN EXISTS (
      SELECT 1 FROM ajustes aj WHERE aj.renglon_id = rr.id
    )                                             THEN 'ajustado'
    ELSE 'diferencia'
  END                                             AS match_status,
  (SELECT aj.cantidad_nueva
   FROM ajustes aj WHERE aj.renglon_id = rr.id
   ORDER BY aj.creado_en DESC LIMIT 1)            AS cantidad_ajustada,
  (SELECT aj.motivo
   FROM ajustes aj WHERE aj.renglon_id = rr.id
   ORDER BY aj.creado_en DESC LIMIT 1)            AS motivo_ajuste,
  (SELECT aj.usuario
   FROM ajustes aj WHERE aj.renglon_id = rr.id
   ORDER BY aj.creado_en DESC LIMIT 1)            AS usuario_ajuste,
  (SELECT aj.creado_en
   FROM ajustes aj WHERE aj.renglon_id = rr.id
   ORDER BY aj.creado_en DESC LIMIT 1)            AS fecha_ajuste
FROM renglones_reparto rr
JOIN  requisiciones    req ON req.id  = rr.requisicion_id
LEFT JOIN renglones_foodbot rf
  ON  rf.requisicion_id = req.id
  AND rf.producto        = rr.producto
  AND rf.costo           = rr.costo;


-- ================================================================
-- STORAGE BUCKET (configurar en Supabase Dashboard → Storage)
-- ================================================================
-- Bucket: 'requisicion-fotos'
--   Public:              false  (acceso privado, URL firmada)
--   Allowed MIME types:  image/jpeg, image/png, image/webp, image/heic
--   Max file size:       10 MB
--
-- La página móvil (/captura-movil/:sessionId) necesita subir fotos
-- sin autenticación de usuario. Opciones:
--   A) Edge Function que valida session_id y devuelve una URL firmada
--      con expiración corta (~15 min) para el upload.
--   B) Service Role Key en el servidor (NUNCA exponer al cliente).
-- Recomendado: opción A con Edge Function en Supabase.


-- ================================================================
-- ROW LEVEL SECURITY (habilitar antes de producción)
-- ================================================================

-- ALTER TABLE capture_sessions  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE fotos_requisicion ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE requisiciones     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE renglones_reparto ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE renglones_foodbot ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ajustes           ENABLE ROW LEVEL SECURITY;

-- Política base (ajustar según roles reales):
-- CREATE POLICY "almacen_select" ON requisiciones
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "almacen_insert" ON requisiciones
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "ajustes_no_delete" ON ajustes
--   FOR DELETE USING (false);  -- Nunca se puede borrar
-- CREATE POLICY "ajustes_no_update" ON ajustes
--   FOR UPDATE USING (false);  -- Nunca se puede modificar


-- ================================================================
-- FUNCIÓN DE LIMPIEZA (opcional, ejecutar periódicamente)
-- ================================================================
CREATE OR REPLACE FUNCTION limpiar_sesiones_expiradas()
RETURNS INTEGER AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE capture_sessions
  SET    estatus = 'expirada'
  WHERE  estatus = 'esperando_fotos'
    AND  expira_en < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Llamar con: SELECT limpiar_sesiones_expiradas();
-- O programar como cron job en Supabase → Edge Functions → Cron.
