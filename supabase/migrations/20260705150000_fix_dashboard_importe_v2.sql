-- V_DASHBOARD v3: usa importe_total de requisiciones (del footer del Excel)
-- para Fase 1, y el calculado de renglones_reparto para Fase 2.
create or replace view v_dashboard as
select
  r.id, r.folio, r.sucursal, r.fecha,
  count(distinct rr.id)                                          as total_renglones,
  case
    when count(rr.id) = 0
    then r.importe_total          -- Fase 1: total del footer del Excel de Foodbot
    else coalesce(sum(rr.cantidad * rr.costo), 0)  -- Fase 2: total real recibido
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
group by r.id, r.folio, r.sucursal, r.fecha, r.importe_total;
