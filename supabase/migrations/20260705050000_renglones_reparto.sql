-- ================================================================
-- RENGLONES_REPARTO
-- Renglones extraídos por Gemini Vision de la hoja física y
-- confirmados por Almacén en la pantalla de revisión.
-- INMUTABLES tras insert — cualquier corrección va a la tabla
-- 'ajustes', nunca se hace UPDATE aquí.
-- ================================================================
create table if not exists renglones_reparto (
  id              text           primary key,
  requisicion_id  text           not null
                    references requisiciones(id) on delete cascade,
  producto        text           not null,
  cantidad        numeric(10,3)  not null,
  unidad          text           not null,  -- kg, lt, pz, mz, pq, cja, gr
  costo           numeric(10,2)  not null,  -- costo unitario
  origen          text           not null
                    check (origen in ('almacen','cocina')),
                    -- 'almacen': resaltado amarillo en hoja física
                    -- 'cocina' : resaltado naranja (requiere refrigeración)
  confianza_ocr   numeric(4,3),             -- 0.0–1.0, null si se agregó/editó a mano
  creado_en       timestamptz    not null default now()
);

create index if not exists idx_renglon_req on renglones_reparto (requisicion_id);
