-- ================================================================
-- RENGLONES_FOODBOT
-- Renglones del Excel exportado de Foodbot. Se crean junto con la
-- requisición en Fase 1 (una fila = una fila del Excel = un producto
-- esperado por esa sucursal).
-- ================================================================
create table if not exists renglones_foodbot (
  id              uuid           primary key default gen_random_uuid(),
  requisicion_id  text           not null
                    references requisiciones(id) on delete cascade,
  producto        text           not null,
  cantidad        numeric(10,3)  not null,
  costo           numeric(10,2)  not null,  -- costo unitario
  cargado_en      timestamptz    not null default now()
);

create index if not exists idx_foodbot_req on renglones_foodbot (requisicion_id);
