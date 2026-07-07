-- Columna "entregado": renglones subrayados en el documento físico = entregado,
-- sin subrayar = no entregado. Editable en la revisión antes de guardar.
alter table renglones_reparto
  add column if not exists entregado boolean not null default true;

-- v_conciliacion v3: expone entregado. Los renglones NO entregados no generan
-- 'diferencia' contra Foodbot — su estado de match se marca 'no_entregado'.
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
  rr.confianza_ocr,
  case
    when not rr.entregado                         then 'no_entregado'
    when rf.id is null                            then 'no_encontrado'
    when rr.cantidad = rf.cantidad                then 'ok'
    when exists (
      select 1 from ajustes aj where aj.renglon_id = rr.id
    )                                             then 'ajustado'
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

-- v_dashboard v5: no_entregado no cuenta como diferencia abierta.
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
