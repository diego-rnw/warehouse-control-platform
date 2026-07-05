import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useData } from '../context/DataContext';
import { monthKey, monthLabel, formatMoney, formatDelta } from '../lib/format';
import { statusChipStyle, STATUS_LABELS, matchChipStyle, MATCH_LABELS } from '../lib/chips';
import type { ConciliacionRow, DashboardRow } from '../lib/types';

interface DiffLine {
  key: string;
  folio: string;
  fecha: string;
  producto: string;
  cantReparto: string;
  cantFoodbot: string;
  matchLabel: string;
  matchChipStyle: CSSProperties;
}

export default function Comparativo() {
  const { dashboardRows, conciliacionRows, isLoading } = useData();
  const [expanded, setExpanded] = useState<string | null>(null);

  const availableMonths = useMemo(() => {
    const keys = [...new Set(dashboardRows.map((r) => monthKey(r.fecha)))].sort().reverse();
    return keys.map((v) => ({ value: v, label: monthLabel(v) }));
  }, [dashboardRows]);

  const [monthA, setMonthA] = useState('');
  const [monthB, setMonthB] = useState('');
  const effectiveMonthA = monthA || availableMonths[0]?.value || '';
  const effectiveMonthB = monthB || availableMonths[1]?.value || availableMonths[0]?.value || '';

  const conciliacionByReq = useMemo(() => {
    const map = new Map<string, ConciliacionRow[]>();
    for (const row of conciliacionRows) {
      const arr = map.get(row.requisicion_id) ?? [];
      arr.push(row);
      map.set(row.requisicion_id, arr);
    }
    return map;
  }, [conciliacionRows]);

  const monthStats = useCallback(
    (mk: string) => {
      const map = new Map<string, { req: number; importe: number; ajuste: number; reqs: DashboardRow[] }>();
      for (const r of dashboardRows) {
        if (monthKey(r.fecha) !== mk) continue;
        const entry = map.get(r.sucursal) ?? { req: 0, importe: 0, ajuste: 0, reqs: [] };
        entry.req++;
        entry.importe += r.importe_total;
        if (r.estatus === 'con_ajuste' || r.estatus === 'con_diferencias') entry.ajuste++;
        entry.reqs.push(r);
        map.set(r.sucursal, entry);
      }
      return map;
    },
    [dashboardRows],
  );

  function diffLinesForReqs(reqs: DashboardRow[]): DiffLine[] {
    const lines: DiffLine[] = [];
    for (const r of reqs) {
      if (r.estatus === 'pendiente_captura') {
        lines.push({
          key: r.id,
          folio: r.folio,
          fecha: r.fecha,
          producto: '— (pendiente de captura de entrega)',
          cantReparto: '—',
          cantFoodbot: '—',
          matchLabel: STATUS_LABELS.pendiente_captura,
          matchChipStyle: statusChipStyle('pendiente_captura'),
        });
        continue;
      }
      const rows = conciliacionByReq.get(r.id) ?? [];
      for (const rl of rows) {
        if (rl.match_status === 'ok') continue;
        lines.push({
          key: rl.renglon_id,
          folio: r.folio,
          fecha: r.fecha,
          producto: rl.producto,
          cantReparto: String(rl.cantidad_reparto),
          cantFoodbot: rl.cantidad_foodbot !== null ? String(rl.cantidad_foodbot) : '—',
          matchLabel: MATCH_LABELS[rl.match_status],
          matchChipStyle: matchChipStyle(rl.match_status),
        });
      }
    }
    return lines;
  }

  const statsA = useMemo(() => monthStats(effectiveMonthA), [monthStats, effectiveMonthA]);
  const statsB = useMemo(() => monthStats(effectiveMonthB), [monthStats, effectiveMonthB]);

  const comparativoRows = useMemo(() => {
    const branches = [...new Set([...statsA.keys(), ...statsB.keys()])].sort();
    return branches.map((sucursal) => {
      const a = statsA.get(sucursal) ?? { req: 0, importe: 0, ajuste: 0, reqs: [] };
      const b = statsB.get(sucursal) ?? { req: 0, importe: 0, ajuste: 0, reqs: [] };
      const delta = a.importe - b.importe;
      const deltaPct = b.importe > 0 ? Math.round((delta / b.importe) * 100) : a.importe > 0 ? 100 : 0;
      const isExpanded = expanded === sucursal;
      const diffLinesA = isExpanded ? diffLinesForReqs(a.reqs) : [];
      const diffLinesB = isExpanded ? diffLinesForReqs(b.reqs) : [];
      return {
        sucursal,
        isExpanded,
        labelA: monthLabel(effectiveMonthA),
        labelB: monthLabel(effectiveMonthB),
        reqA: a.req,
        reqB: b.req,
        importeAStr: formatMoney(a.importe),
        importeBStr: formatMoney(b.importe),
        friccionAStr: a.req > 0 ? `${Math.round((a.ajuste / a.req) * 100)}%` : '—',
        friccionBStr: b.req > 0 ? `${Math.round((b.ajuste / b.req) * 100)}%` : '—',
        deltaStr: formatDelta(delta, deltaPct),
        deltaColor: delta > 0 ? '#E84926' : delta < 0 ? '#29E7BC' : 'var(--t6)',
        diffLinesA,
        diffLinesB,
        hasNoDiffs: isExpanded && diffLinesA.length === 0 && diffLinesB.length === 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsA, statsB, expanded, effectiveMonthA, effectiveMonthB]);

  if (isLoading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--t5)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>PANEL OPERATIVO</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>Comparativo mes vs mes</h1>
        <p style={{ fontSize: 12, color: 'var(--t6)', marginTop: 6, lineHeight: 1.6 }}>Cada sucursal se compara únicamente contra sí misma en otro período — nunca contra otra sucursal.</p>
      </div>

      <div data-tour="comp-months" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '13px 20px', marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Mes A</label>
          <select value={effectiveMonthA} onChange={(e) => setMonthA(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '5px 10px', fontSize: 12, cursor: 'pointer', minWidth: 160 }}>
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: 11, color: 'var(--t7)', fontWeight: 700 }}>VS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Mes B</label>
          <select value={effectiveMonthB} onChange={(e) => setMonthB(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '5px 10px', fontSize: 12, cursor: 'pointer', minWidth: 160 }}>
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div data-tour="comp-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comparativoRows.map((c) => (
          <div key={c.sucursal} style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded((cur) => (cur === c.sucursal ? null : c.sucursal))}
              style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '160px 1fr 1fr 140px', gap: 20, alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', display: 'flex', alignItems: 'center' }}>
                {c.sucursal}
                <span style={{ display: 'inline-block', marginLeft: 8, transform: c.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: 11, color: 'var(--t7)' }}>▶</span>
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{c.labelA}</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--t1)', lineHeight: 1 }}>
                    {c.reqA} <span style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700 }}>req.</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Importe</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#FFCD02' }}>{c.importeAStr}</p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fricción</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--t3)' }}>{c.friccionAStr}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{c.labelB}</p>
                  <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--t1)', lineHeight: 1 }}>
                    {c.reqB} <span style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700 }}>req.</span>
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Importe</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#FFCD02' }}>{c.importeBStr}</p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Fricción</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--t3)' }}>{c.friccionBStr}</p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Δ Importe</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: c.deltaColor }}>{c.deltaStr}</p>
              </div>
            </div>

            {c.isExpanded && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--t6)', textTransform: 'uppercase', marginBottom: 10 }}>Diferencias — {c.labelA}</p>
                  {c.diffLinesA.map((dl) => (
                    <div key={dl.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>{dl.producto}</div>
                        <div style={{ fontSize: 10, color: 'var(--t7)' }}>
                          {dl.folio} · {dl.fecha} · Reparto {dl.cantReparto} / Foodbot {dl.cantFoodbot}
                        </div>
                      </div>
                      <span style={dl.matchChipStyle}>{dl.matchLabel}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--t6)', textTransform: 'uppercase', marginBottom: 10 }}>Diferencias — {c.labelB}</p>
                  {c.diffLinesB.map((dl) => (
                    <div key={dl.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--divider)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)' }}>{dl.producto}</div>
                        <div style={{ fontSize: 10, color: 'var(--t7)' }}>
                          {dl.folio} · {dl.fecha} · Reparto {dl.cantReparto} / Foodbot {dl.cantFoodbot}
                        </div>
                      </div>
                      <span style={dl.matchChipStyle}>{dl.matchLabel}</span>
                    </div>
                  ))}
                </div>
                {c.hasNoDiffs && <p style={{ fontSize: 12, color: 'var(--t6)', gridColumn: '1 / -1' }}>Sin diferencias en ninguno de los dos períodos — match perfecto contra Foodbot.</p>}
              </div>
            )}
          </div>
        ))}
        {comparativoRows.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-in)', padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--t6)' }}>No hay requisiciones registradas en los meses seleccionados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
