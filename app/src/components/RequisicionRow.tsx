import type { CSSProperties } from 'react';
import { formatMoney } from '../lib/format';
import { statusChipStyle, STATUS_LABELS, origenChipStyle, origenLabel } from '../lib/chips';
import AdjustmentForm from './AdjustmentForm';
import type { Ajuste, ConciliacionRow, DashboardRow, RenglonFoodbot } from '../lib/types';

interface Props {
  req: DashboardRow;
  renglonesFoodbot: RenglonFoodbot[];
  renglones: ConciliacionRow[];
  ajustesByRenglon: Map<string, Ajuste[]>;
  isExpanded: boolean;
  onToggle: () => void;
  onCapturarEntrega: () => void;
  onAjusteSaved: () => void;
}

export default function RequisicionRow({ req, renglonesFoodbot, renglones, ajustesByRenglon, isExpanded, onToggle, onCapturarEntrega, onAjusteSaved }: Props) {
  const needsCaptura = req.estatus === 'pendiente_captura';
  const rengCount = needsCaptura ? renglonesFoodbot.length : renglones.length;

  function rowBg(matchStatus: ConciliacionRow['match_status']): CSSProperties {
    if (matchStatus === 'diferencia') return { background: 'var(--row-diff)' };
    if (matchStatus === 'no_encontrado') return { background: 'var(--row-none)' };
    return {};
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{req.folio}</span>
          <span style={{ fontSize: 12, color: 'var(--t4)', fontWeight: 600 }}>{req.sucursal}</span>
          <span style={{ fontSize: 11, color: 'var(--t7)' }}>{req.fecha}</span>
          <span style={statusChipStyle(req.estatus)}>{STATUS_LABELS[req.estatus]}</span>
          <span style={{ fontSize: 10, color: 'var(--t7)', fontWeight: 600 }}>{rengCount} renglones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {needsCaptura && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCapturarEntrega();
              }}
              style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '0 16px', height: 32, fontWeight: 900, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 15, fontWeight: 300, lineHeight: 1 }}>+</span>CAPTURAR ENTREGA
            </button>
          )}
          <span style={{ fontSize: 13, color: '#FFCD02', fontWeight: 800 }}>{formatMoney(req.importe_total)}</span>
          <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: 'var(--t7)', fontSize: 11 }}>▶</span>
        </div>
      </div>

      {isExpanded && (
        <>
          {needsCaptura && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '22px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 12, color: 'var(--t6)', lineHeight: 1.6, maxWidth: 480 }}>
                Aún no se captura la entrega de Reparto para esta requisición. {rengCount} renglones esperados según Foodbot.
              </p>
              <button onClick={onCapturarEntrega} style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '10px 18px', fontWeight: 900, fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                + CAPTURAR ENTREGA
              </button>
            </div>
          )}

          {!needsCaptura && (
            <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                <thead>
                  <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--divider-2)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Producto</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cant. Foodbot</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cant. Reparto</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Unidad</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Costo</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Origen</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Repartidor</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Entregado</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Caducidad</th>
                    <th style={{ textAlign: 'left', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Estado / Ajuste</th>
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((rl) => (
                    <tr key={rl.renglon_id} style={rowBg(rl.match_status)}>
                      <td style={{ padding: '10px 20px', fontSize: 13, color: 'var(--t2)', fontWeight: 600 }}>{rl.producto}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: rl.cantidad_foodbot !== null && rl.cantidad_foodbot !== rl.cantidad_reparto ? '#E84926' : 'var(--t7)' }}>
                          {rl.cantidad_foodbot ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: 'var(--t3)', fontWeight: 700 }}>{rl.cantidad_reparto}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--t6)' }}>{rl.unidad}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: 'var(--t6)' }}>${rl.costo}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={origenChipStyle(rl.origen)}>{origenLabel(rl.origen)}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: rl.repartidor ? 'var(--t3)' : 'var(--t8)', fontWeight: 600 }}>
                        {rl.repartidor ?? '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: rl.entregado ? 'var(--chip-ok-tx)' : '#E84926' }}>
                          {rl.entregado ? '✓ ENTREGADO' : '✕ NO ENTREGADO'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {rl.tiene_caducidad ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)' }}>{rl.caducidad ?? '—'}</span>
                            {rl.lote && <span style={{ fontSize: 10, color: 'var(--t7)' }}>Lote: {rl.lote}</span>}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--t8)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 20px' }}>
                        <AdjustmentForm row={rl} historial={ajustesByRenglon.get(rl.renglon_id) ?? []} onSaved={onAjusteSaved} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
