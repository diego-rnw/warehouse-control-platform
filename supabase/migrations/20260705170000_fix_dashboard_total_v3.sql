-- V_DASHBOARD v4: usa siempre r.importe_total como fuente del total.
-- Fase 1: lo pone el parser del Excel de Foodbot (footer).
-- Fase 2: lo actualiza saveCaptura con el total extraído por Gemini del documento.
-- Nunca se recalcula desde renglones_reparto (evita divergencia por unit-conversion).
drop view if exists v_dashboard;
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
