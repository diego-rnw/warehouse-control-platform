-- Los renglones NO entregados también son ajustables: si ya tienen un ajuste
-- registrado, su match_status pasa a 'ajustado' (antes quedaban atrapados en
-- 'no_entregado' y el ajuste no se reflejaba).
create or replace view v_conciliacion as
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
