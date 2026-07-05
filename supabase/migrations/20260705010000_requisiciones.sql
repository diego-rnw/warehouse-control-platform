-- ================================================================
-- REQUISICIONES
-- Entidad central. Una por hoja física capturada. Creada en Fase 1
-- (alta desde el Excel de Foodbot) con estatus 'pendiente_captura';
-- pasa a tener renglones_reparto en Fase 2 (captura de entrega).
-- ================================================================
create table if not exists requisiciones (
  id          text        primary key,
  folio       text        not null unique,  -- ej. 'REQ-2025-024', viene del Excel Foodbot
  sucursal    text        not null,
  fecha       date        not null,         -- fecha de entrega confirmada en Fase 2 (fecha de alta hasta entonces)
  -- estatus es SIEMPRE derivado (ver v_conciliacion) — esta columna es un cache opcional,
  -- no la fuente de verdad para lógica crítica. pendiente_captura = sin renglones_reparto todavía.
  estatus     text        not null default 'pendiente_captura'
                check (estatus in ('pendiente_captura','conciliada','con_ajuste','con_diferencias')),
  -- FK a capture_sessions se agrega en la migración de capture_sessions (dependencia circular).
  session_id  text,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_req_folio    on requisiciones (folio);
create index if not exists idx_req_sucursal on requisiciones (sucursal);
create index if not exists idx_req_fecha    on requisiciones (fecha desc);
create index if not exists idx_req_estatus  on requisiciones (estatus);
