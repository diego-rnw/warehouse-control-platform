-- Agrega el importe total precalculado de Foodbot a la requisición.
-- Se lee directamente del footer del Excel (fila "Total") para evitar
-- recalcular con las cantidades internas de Foodbot (que usan conversiones
-- de unidad base que difieren del total visible en el documento).
alter table requisiciones
  add column if not exists importe_total numeric(14,3) not null default 0;
