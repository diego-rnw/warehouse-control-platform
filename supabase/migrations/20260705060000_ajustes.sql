-- ================================================================
-- AJUSTES
-- Registro de auditoría inmutable. Cada fila documenta una
-- corrección de cantidad con motivo obligatorio, quién y cuándo.
-- NUNCA se borra ni se actualiza una fila existente (ver RLS).
-- ================================================================
create table if not exists ajustes (
  id                  uuid           primary key default gen_random_uuid(),
  renglon_id          text           not null
                        references renglones_reparto(id),
  cantidad_anterior   numeric(10,3)  not null,  -- snapshot del valor original en renglones_reparto
  cantidad_nueva      numeric(10,3)  not null,  -- valor corregido
  motivo              text           not null,  -- obligatorio en UI
  usuario             text           not null default 'almacen',  -- email de quien ajustó
  creado_en           timestamptz    not null default now()
);

create index if not exists idx_ajustes_renglon on ajustes (renglon_id);
create index if not exists idx_ajustes_fecha   on ajustes (creado_en desc);
