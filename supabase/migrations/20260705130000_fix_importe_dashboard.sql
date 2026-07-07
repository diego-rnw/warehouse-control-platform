-- ================================================================
-- FIX: v_dashboard — importe_total en Fase 1
-- Antes calculaba importe solo de renglones_reparto (Fase 2),
-- resultando en $0 para requisiciones pendiente_captura.
-- Ahora usa renglones_foodbot como fallback cuando no hay reparto.
-- ================================================================
create or replace view v_dashboard as
select
  r.id, r.folio, r.sucursal, r.fecha,
  count(distinct rr.id)                                          as total_renglones,
  case
    when count(rr.id) = 0
    -- Fase 1: sin entrega capturada → importe del Excel de Foodbot
    then (
      select coalesce(sum(rf.cantidad * rf.costo), 0)
      from renglones_foodbot rf
      where rf.requisicion_id = r.id
    )
    -- Fase 2: con entrega → importe real de lo recibido
    else coalesce(sum(rr.cantidad * rr.costo), 0)
  end                                                            as importe_total,
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
group by r.id, r.folio, r.sucursal, r.fecha;
