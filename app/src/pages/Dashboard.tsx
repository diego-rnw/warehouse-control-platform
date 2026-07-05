import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { formatMoney, formatCantidad, monthKey, monthLabel } from '../lib/format';
import { STATUS_CHIP_KIND, STATUS_FILTER_LABELS, chip, matchesStatusFilter, statusChipStyle, STATUS_LABELS, type StatusFilter } from '../lib/chips';
import type { CSSProperties } from 'react';

const TREND_SVG_WIDTH = 400;
const TREND_PAD = 16;

export default function Dashboard() {
  const { dashboardRows, conciliacionRows, isLoading, error } = useData();
  const { importeColor } = useTheme();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sucursal, setSucursal] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const allSucursales = useMemo(() => [...new Set(dashboardRows.map((r) => r.sucursal))].sort(), [dashboardRows]);

  const dateFiltered = useMemo(
    () =>
      dashboardRows.filter((r) => {
        if (sucursal !== 'all' && r.sucursal !== sucursal) return false;
        if (dateFrom && r.fecha < dateFrom) return false;
        if (dateTo && r.fecha > dateTo) return false;
        return true;
      }),
    [dashboardRows, sucursal, dateFrom, dateTo],
  );

  const filtered = useMemo(() => dateFiltered.filter((r) => matchesStatusFilter(r.estatus, statusFilter)), [dateFiltered, statusFilter]);

  const statTotal = dateFiltered.length;
  const statConciliadas = dateFiltered.filter((r) => r.estatus === 'conciliada').length;
  const statAjuste = dateFiltered.filter((r) => r.estatus === 'con_ajuste' || r.estatus === 'con_diferencias').length;
  const statPendiente = dateFiltered.filter((r) => r.estatus === 'pendiente_captura').length;
  const importe = filtered.reduce((sum, r) => sum + r.importe_total, 0);

  const filteredIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);

  const productBreakdown = useMemo(() => {
    const map = new Map<string, { cantidad: number; importe: number; reqIds: Set<string>; unidad: string }>();
    for (const row of conciliacionRows) {
      if (!filteredIds.has(row.requisicion_id)) continue;
      const entry = map.get(row.producto) ?? { cantidad: 0, importe: 0, reqIds: new Set<string>(), unidad: row.unidad };
      entry.cantidad += row.cantidad_reparto;
      entry.importe += row.cantidad_reparto * row.costo;
      entry.reqIds.add(row.requisicion_id);
      map.set(row.producto, entry);
    }
    return [...map.entries()]
      .map(([producto, d]) => ({
        producto,
        cantidadStr: formatCantidad(d.cantidad, d.unidad),
        reqCount: d.reqIds.size,
        importeStr: formatMoney(d.importe),
        importe: d.importe,
      }))
      .sort((a, b) => b.importe - a.importe);
  }, [conciliacionRows, filteredIds]);

  const frictionProducts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of conciliacionRows) {
      if (!filteredIds.has(row.requisicion_id)) continue;
      if (row.match_status === 'diferencia' || row.match_status === 'no_encontrado' || row.match_status === 'ajustado') {
        map.set(row.producto, (map.get(row.producto) ?? 0) + 1);
      }
    }
    const maxFriction = Math.max(1, ...map.values());
    return [...map.entries()]
      .map(([producto, count]) => ({
        producto,
        count,
        barStyle: { background: '#E84926', height: 4, width: `${Math.round((count / maxFriction) * 100)}%` } as CSSProperties,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [conciliacionRows, filteredIds]);

  const sucursalBreakdown = useMemo(() => {
    const map = new Map<string, { total: number; ajuste: number }>();
    for (const r of filtered) {
      const entry = map.get(r.sucursal) ?? { total: 0, ajuste: 0 };
      entry.total++;
      if (r.estatus === 'con_ajuste' || r.estatus === 'con_diferencias') entry.ajuste++;
      map.set(r.sucursal, entry);
    }
    const maxAjuste = Math.max(1, ...[...map.values()].map((d) => d.ajuste));
    return [...map.entries()]
      .map(([name, d]) => {
        const pct = d.total > 0 ? Math.round((d.ajuste / d.total) * 100) : 0;
        return {
          name,
          total: d.total,
          ajuste: d.ajuste,
          pct,
          barStyle: { background: d.ajuste > 0 ? '#E84926' : 'var(--t8)', height: 3, width: `${Math.round((d.ajuste / maxAjuste) * 100)}%`, maxWidth: 110, transition: 'width 0.5s ease' } as CSSProperties,
          ajusteStyle: { fontSize: 14, fontWeight: 700, color: d.ajuste > 0 ? '#E84926' : 'var(--t8)' } as CSSProperties,
          pctStyle: { fontSize: 12, fontWeight: 700, color: pct > 33 ? '#E84926' : pct > 0 ? 'var(--t3)' : 'var(--t8)' } as CSSProperties,
        };
      })
      .sort((a, b) => b.ajuste - a.ajuste);
  }, [filtered]);

  const monthlyTrend = useMemo(() => {
    const chronoMonths = [...new Set(dashboardRows.map((r) => monthKey(r.fecha)))].sort();
    if (chronoMonths.length < 2) return null;
    const pcts = chronoMonths.map((mk) => {
      const inMonth = dashboardRows.filter((r) => monthKey(r.fecha) === mk);
      const withAjuste = inMonth.filter((r) => r.estatus === 'con_ajuste' || r.estatus === 'con_diferencias').length;
      return inMonth.length > 0 ? Math.round((withAjuste / inMonth.length) * 100) : 0;
    });
    const points = chronoMonths.map((mk, i) => {
      const pct = pcts[i];
      const x = chronoMonths.length > 1 ? TREND_PAD + (i / (chronoMonths.length - 1)) * (TREND_SVG_WIDTH - TREND_PAD * 2) : TREND_SVG_WIDTH / 2;
      const y = 82 - (pct / 100) * 64;
      return { x: Math.round(x), y: Math.round(y), label: monthLabel(mk), pctStr: `${pct}%` };
    });
    return { points, polyline: points.map((p) => `${p.x},${p.y}`).join(' ') };
  }, [dashboardRows]);

  function cardStyle(active: boolean): CSSProperties {
    return {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      outline: active ? '2px solid #FFCD02' : 'none',
      outlineOffset: -2,
      padding: '16px 20px',
      cursor: 'pointer',
    };
  }

  if (isLoading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '12px 18px', fontSize: 13, fontWeight: 600 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--t5)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>PANEL OPERATIVO</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>Requisiciones de Insumos</h1>
      </div>

      {/* Filtros */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '13px 20px', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--t6)', textTransform: 'uppercase', flexShrink: 0 }}>FILTROS</span>
        <span style={{ width: 1, height: 14, background: 'var(--border-in)', display: 'block', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '5px 10px', fontSize: 12, width: 148 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '5px 10px', fontSize: 12, width: 148 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Sucursal</label>
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '5px 10px', fontSize: 12, cursor: 'pointer', minWidth: 160 }}>
            <option value="all">Todas las sucursales</option>
            {allSucursales.map((suc) => (
              <option key={suc} value={suc}>
                {suc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat cards */}
      <div data-tour="dash-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <div onClick={() => setStatusFilter('all')} style={cardStyle(statusFilter === 'all')}>
          <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Total Requisiciones</p>
          <p style={{ fontSize: 44, fontWeight: 900, color: 'var(--t1)', lineHeight: 1, letterSpacing: '-0.02em' }}>{statTotal}</p>
          <p style={{ fontSize: 10, color: 'var(--t8)', marginTop: 7, fontWeight: 600 }}>en el período · click para ver todas</p>
        </div>
        <div onClick={() => setStatusFilter('conciliada')} style={cardStyle(statusFilter === 'conciliada')}>
          <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Conciliadas sin ajuste</p>
          <p style={{ fontSize: 44, fontWeight: 900, color: '#29E7BC', lineHeight: 1, letterSpacing: '-0.02em' }}>{statConciliadas}</p>
          <p style={{ fontSize: 10, color: 'var(--t8)', marginTop: 7, fontWeight: 600 }}>match perfecto Foodbot</p>
        </div>
        <div onClick={() => setStatusFilter('con_ajuste_diferencias')} style={cardStyle(statusFilter === 'con_ajuste_diferencias')}>
          <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Con Ajuste / Diferencias</p>
          <p style={{ fontSize: 44, fontWeight: 900, color: '#E84926', lineHeight: 1, letterSpacing: '-0.02em' }}>{statAjuste}</p>
          <p style={{ fontSize: 10, color: 'var(--t8)', marginTop: 7, fontWeight: 600 }}>requieren revisión</p>
        </div>
        <div onClick={() => setStatusFilter('pendiente_captura')} style={cardStyle(statusFilter === 'pendiente_captura')}>
          <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Pendiente Captura</p>
          <p style={{ fontSize: 44, fontWeight: 900, color: '#FFCD02', lineHeight: 1, letterSpacing: '-0.02em' }}>{statPendiente}</p>
          <p style={{ fontSize: 10, color: 'var(--t8)', marginTop: 7, fontWeight: 600 }}>sin entrega registrada</p>
        </div>
      </div>

      {statusFilter !== 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '-10px 0 20px' }}>
          <span style={{ fontSize: 10, color: 'var(--t7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filtrando por:</span>
          <span style={chip(STATUS_CHIP_KIND[statusFilter === 'con_ajuste_diferencias' ? 'con_ajuste' : statusFilter])}>{STATUS_FILTER_LABELS[statusFilter]}</span>
          <button onClick={() => setStatusFilter('all')} style={{ background: 'none', border: 'none', color: 'var(--t6)', fontSize: 11, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
            Quitar filtro ✕
          </button>
        </div>
      )}

      {/* Importe total */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '2px solid #FFCD02', padding: '16px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Importe Total · valor de insumos en el período</p>
        <p style={{ fontSize: 28, fontWeight: 900, color: importeColor, lineHeight: 1, letterSpacing: '-0.02em' }}>{formatMoney(importe)}</p>
      </div>

      {/* Tendencia */}
      {monthlyTrend && (
        <div data-tour="dash-trend" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t6)', textTransform: 'uppercase' }}>TENDENCIA DE FRICCIÓN MES A MES</span>
            <span style={{ fontSize: 9, color: 'var(--t8)', fontWeight: 700, letterSpacing: '0.08em' }}>% REQUISICIONES CON AJUSTE/DIFERENCIA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
            <svg viewBox={`0 0 ${TREND_SVG_WIDTH} 90`} style={{ width: '100%', height: 90, overflow: 'visible' }}>
              <polyline points={monthlyTrend.polyline} fill="none" stroke="#E84926" strokeWidth={2} />
              {monthlyTrend.points.map((tp, i) => (
                <circle key={i} cx={tp.x} cy={tp.y} r={3.5} fill="#E84926" />
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {monthlyTrend.points.map((tp, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700 }}>{tp.label}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 800 }}>{tp.pctStr}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sucursal breakdown + recientes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t6)', textTransform: 'uppercase' }}>FRICCIÓN POR SUCURSAL</span>
            <span style={{ fontSize: 9, color: '#E84926', fontWeight: 700, letterSpacing: '0.08em' }}>MAYOR ARRIBA</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider-2)' }}>
                <th style={{ textAlign: 'left', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sucursal</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Req.</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ajuste</th>
                <th style={{ textAlign: 'right', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Fricción</th>
              </tr>
            </thead>
            <tbody>
              {sucursalBreakdown.map((branch) => (
                <tr key={branch.name} style={{ borderBottom: '1px solid var(--divider)' }}>
                  <td style={{ padding: '10px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>{branch.name}</div>
                    <div style={{ background: 'var(--divider-2)', height: 3, width: 110 }}>
                      <div style={branch.barStyle} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--t5)' }}>{branch.total}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span style={branch.ajusteStyle}>{branch.ajuste}</span>
                  </td>
                  <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                    <span style={branch.pctStyle}>{branch.pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t6)', textTransform: 'uppercase' }}>REQUISICIONES RECIENTES</span>
            <span style={{ fontSize: 10, color: 'var(--t8)', fontWeight: 600 }}>{statTotal} total</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 420 }}>
            {filtered.map((req) => (
              <div key={req.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', letterSpacing: '0.04em' }}>{req.folio}</span>
                    <span style={statusChipStyle(req.estatus)}>{STATUS_LABELS[req.estatus]}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--t4)', fontWeight: 600 }}>
                    {req.sucursal} · {req.fecha}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: importeColor, fontWeight: 800, flexShrink: 0 }}>{formatMoney(req.importe_total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desglose de productos */}
      <div data-tour="dash-products" style={{ background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t6)', textTransform: 'uppercase' }}>DESGLOSE DE PRODUCTOS ENVIADOS</span>
          <span style={{ fontSize: 9, color: 'var(--t8)', fontWeight: 700, letterSpacing: '0.08em' }}>MAYOR IMPORTE ARRIBA</span>
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--divider-2)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
                <th style={{ textAlign: 'left', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Producto</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cantidad total</th>
                <th style={{ textAlign: 'right', padding: '8px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Req.</th>
                <th style={{ textAlign: 'right', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {productBreakdown.map((prod) => (
                <tr key={prod.producto} style={{ borderBottom: '1px solid var(--divider)' }}>
                  <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>{prod.producto}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13, color: 'var(--t3)', fontWeight: 700 }}>{prod.cantidadStr}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: 'var(--t6)', fontWeight: 600 }}>{prod.reqCount}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, color: importeColor, fontWeight: 800 }}>{prod.importeStr}</td>
                </tr>
              ))}
              {productBreakdown.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 20px', textAlign: 'center', fontSize: 12, color: 'var(--t8)' }}>
                    Sin renglones de reparto capturados en el período filtrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top fricción */}
      {frictionProducts.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t6)', textTransform: 'uppercase' }}>TOP PRODUCTOS CON MÁS FRICCIÓN</span>
            <span style={{ fontSize: 9, color: '#E84926', fontWeight: 700, letterSpacing: '0.08em' }}>DIFERENCIAS + AJUSTES</span>
          </div>
          {frictionProducts.map((fp) => (
            <div key={fp.producto} style={{ padding: '10px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2)' }}>{fp.producto}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ background: 'var(--divider-2)', height: 4, width: 90 }}>
                  <div style={fp.barStyle} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#E84926', minWidth: 18, textAlign: 'right' }}>{fp.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
