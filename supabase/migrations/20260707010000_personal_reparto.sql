-- ================================================================
-- PERSONAL DE REPARTO
-- Catálogo de personas que entregan productos. Se registra desde el
-- frontend ("+ Nuevo" en el dropdown de la pantalla de revisión).
-- Reemplaza al marcatextos como mecanismo de control de entrega:
-- ahora cada renglón se asigna a un repartidor.
-- ================================================================
create table if not exists personal_reparto (
  id        uuid        primary key default gen_random_uuid(),
  nombre    text        not null unique,
  activo    boolean     not null default true,
  creado_en timestamptz not null default now()
);

alter table personal_reparto enable row level security;

create policy "authenticated_select_personal_reparto" on personal_reparto
  for select using (auth.role() = 'authenticated');
create policy "authenticated_insert_personal_reparto" on personal_reparto
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update_personal_reparto" on personal_reparto
  for update using (auth.role() = 'authenticated');

-- Repartidor asignado a cada renglón de reparto
alter table renglones_reparto
  add column if not exists repartidor text;

-- v_conciliacion v5: expone repartidor
drop view if exists v_dashboard;
drop view if exists v_conciliacion;

create view v_conciliacion as
select
  rr.id                                           as renglon_id,
  rr.requisicion_id,
  req.folio,
  req.sucursal,
  req.fecha,
  rr.producto,
  rr.cantidad                                     as cantidad_reparto,
  rf.cantidad                                     as cantidad_foodbot,
  rr.costo,
  rr.unidad,
  rr.origen,
  rr.entregado,
  rr.repartidor,
  rr.confianza_ocr,
  case
    when exists (
      select 1 from ajustes aj where aj.renglon_id = rr.id
    )                                             then 'ajustado'
    when not rr.entregado                         then 'no_entregado'
    when rf.id is null                            then 'no_encontrado'
    when rr.cantidad = rf.cantidad                then 'ok'
    else 'diferencia'
  end                                             as match_status,
  (select aj.cantidad_nueva
   from ajustes aj where aj.renglon_id = rr.id
   order by aj.creado_en desc limit 1)            as cantidad_ajustada,
  (select aj.motivo
   from ajustes aj where aj.renglon_id = rr.id
   order by aj.creado_en desc limit 1)            as motivo_ajuste,
  (select aj.usuario
   from ajustes aj where aj.renglon_id = rr.id
   order by aj.creado_en desc limit 1)            as usuario_ajuste,
  (select aj.creado_en
   from ajustes aj where aj.renglon_id = rr.id
   order by aj.creado_en desc limit 1)            as fecha_ajuste
from renglones_reparto rr
join  requisiciones    req on req.id  = rr.requisicion_id
left join renglones_foodbot rf
  on  rf.requisicion_id = req.id
  and lower(rf.producto) = lower(rr.producto);

create view v_dashboard as
select
  r.id, r.folio, r.sucursal, r.fecha,
  count(distinct rr.id)                                          as total_renglones,
  r.importe_total,
  count(distinct a.id)                                          as total_ajustes,
  case
    when count(rr.id) = 0                                                       then 'pendiente_captura'
    when count(*) filter (where vc.match_status = 'diferencia'
                             or vc.match_status = 'no_encontrado') > 0          then 'con_diferencias'
    when count(*) filter (where vc.match_status = 'ajustado') > 0               then 'con_ajuste'
    else 'conciliada'
  end                                                            as estatus
from requisiciones r
left join renglones_reparto rr on rr.requisicion_id = r.id
left join ajustes            a  on a.renglon_id = rr.id
left join v_conciliacion     vc on vc.renglon_id = rr.id
group by r.id, r.folio, r.sucursal, r.fecha, r.importe_total;
