import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { validateExcelFile, parseFoodbotExcel } from '../lib/excel';
import type { ParsedFoodbotExcel } from '../lib/excel';
import { formatMoney, formatCantidad } from '../lib/format';
import RequisicionRow from '../components/RequisicionRow';
import CaptureFlow from '../components/CaptureFlow';
import type { Ajuste } from '../lib/types';

export default function Requisiciones() {
  const { dashboardRows, conciliacionRows, renglonesFoodbot, ajustes, sucursales, isLoading, error, refresh } = useData();

  const [searchFolio, setSearchFolio] = useState('');
  const [uploadSucursal, setUploadSucursal] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [lastUpload, setLastUpload] = useState<{ folio: string; count: number } | null>(null);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [captureReqId, setCaptureReqId] = useState<string | null>(null);
  // Vista previa del Excel parseado — se confirma antes de insertar en DB
  const [preview, setPreview] = useState<ParsedFoodbotExcel | null>(null);
  const [previewSucursal, setPreviewSucursal] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const allSucursales = useMemo(() => sucursales.map((s) => s.nombre), [sucursales]);

  const searchNorm = searchFolio.trim().toLowerCase();
  const reqsForConciliation = useMemo(
    () => (searchNorm ? dashboardRows.filter((r) => r.folio.toLowerCase().includes(searchNorm)) : dashboardRows),
    [dashboardRows, searchNorm],
  );

  const renglonesByReq = useMemo(() => {
    const map = new Map<string, typeof conciliacionRows>();
    for (const row of conciliacionRows) {
      const arr = map.get(row.requisicion_id) ?? [];
      arr.push(row);
      map.set(row.requisicion_id, arr);
    }
    return map;
  }, [conciliacionRows]);

  const foodbotByReq = useMemo(() => {
    const map = new Map<string, typeof renglonesFoodbot>();
    for (const row of renglonesFoodbot) {
      const arr = map.get(row.requisicion_id) ?? [];
      arr.push(row);
      map.set(row.requisicion_id, arr);
    }
    return map;
  }, [renglonesFoodbot]);

  // Historial de ajustes por renglón = todas las correcciones previas a la última
  // (la última ya se refleja como "actual" vía v_conciliacion.cantidad_ajustada).
  const ajustesByRenglon = useMemo(() => {
    const map = new Map<string, Ajuste[]>();
    for (const a of ajustes) {
      const arr = map.get(a.renglon_id) ?? [];
      arr.push(a);
      map.set(a.renglon_id, arr);
    }
    for (const [key, arr] of map) {
      map.set(key, arr.slice(0, -1)); // todas menos la última
    }
    return map;
  }, [ajustes]);

  // Paso 1: parsear el archivo y mostrar vista previa (aún no toca la DB)
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    const validationError = validateExcelFile(file);
    if (validationError) {
      setUploadError(validationError);
      e.target.value = '';
      return;
    }

    setUploadStatus('loading');
    try {
      const parsed = await parseFoodbotExcel(file);

      // Buscar el nombre canónico de la sucursal (case-insensitive)
      // Foodbot puede escribir "Upaep" mientras la DB tiene "UPAEP"
      const sucursalCanonica = allSucursales.find(
        (s) => s.toLowerCase() === parsed.sucursal.toLowerCase()
      ) ?? parsed.sucursal;

      // Si el usuario pre-seleccionó una sucursal, verificar que coincida
      if (uploadSucursal && uploadSucursal.toLowerCase() !== parsed.sucursal.toLowerCase()) {
        setUploadError(`La sucursal del archivo es "${sucursalCanonica}" pero seleccionaste "${uploadSucursal}". Verifica la selección o sube el archivo correcto.`);
        setUploadStatus('idle');
        e.target.value = '';
        return;
      }

      setPreview(parsed);
      setPreviewSucursal(sucursalCanonica);
      setUploadStatus('idle');
    } catch (err) {
      setUploadStatus('idle');
      const msg = err instanceof Error ? err.message : '';
      setUploadError(msg || 'No se pudo leer el archivo. Verifica que sea un export válido de Foodbot.');
    } finally {
      e.target.value = '';
    }
  }

  // Paso 2: el usuario revisó la vista previa y confirma la carga
  async function confirmUpload() {
    if (!preview) return;
    setIsConfirming(true);
    setUploadError('');
    try {
      const reqId = 'req-' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');

      const { error: reqErr } = await supabase.from('requisiciones').insert({
        id: reqId,
        folio: preview.folio,
        sucursal: previewSucursal,
        fecha: preview.fecha,
        importe_total: preview.importe_total,
        estatus: 'pendiente_captura',
      });
      if (reqErr) {
        if (reqErr.code === '23505') {
          throw new Error(`La orden de compra "${preview.folio}" ya fue cargada anteriormente.`);
        }
        throw reqErr;
      }

      const { error: rowsErr } = await supabase.from('renglones_foodbot').insert(
        preview.rows.map((r) => ({ requisicion_id: reqId, producto: r.producto, cantidad: r.cantidad, costo: r.costo })),
      );
      if (rowsErr) throw rowsErr;

      setUploadStatus('loaded');
      setLastUpload({ folio: preview.folio, count: preview.rows.length });
      setUploadSucursal('');
      setPreview(null);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setUploadError(msg || 'No se pudo crear la requisición. Verifica tu conexión e intenta de nuevo.');
      setPreview(null);
    } finally {
      setIsConfirming(false);
    }
  }

  const captureTarget = captureReqId ? dashboardRows.find((r) => r.id === captureReqId) : null;

  if (isLoading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--t5)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>PANEL OPERATIVO</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>Requisiciones</h1>
        </div>
        <div data-tour="req-search" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Buscar folio</label>
          <input type="text" value={searchFolio} onChange={(e) => setSearchFolio(e.target.value)} placeholder="REQ-2025-024" style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '8px 12px', fontSize: 12, width: 200 }} />
        </div>
      </div>

      {error && (
        <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '10px 16px', marginBottom: 20, fontSize: 12, fontWeight: 600 }}>{error}</div>
      )}

      {/* Fase 1: Excel upload */}
      <div data-tour="req-upload" style={{ background: 'var(--surface)', border: '2px dashed var(--border-in)', padding: '20px 24px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t5)', textTransform: 'uppercase', marginBottom: 5 }}>FASE 1 · ARCHIVO FOODBOT</p>
          <p style={{ fontSize: 13, color: 'var(--t7)', lineHeight: 1.6 }}>
            Sube el Excel exportado de Foodbot. La sucursal y fecha de PO se leen automáticamente del archivo. Si seleccionas una sucursal, se verificará que coincida.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          {uploadStatus === 'loaded' && lastUpload && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--chip-ok-bg)', border: '1px solid var(--chip-ok-bd)', padding: '8px 16px' }}>
              <span style={{ color: 'var(--chip-ok-tx)', fontWeight: 700, fontSize: 13 }}>✓</span>
              <span style={{ fontSize: 12, color: 'var(--chip-ok-tx)', fontWeight: 700, letterSpacing: '0.04em' }}>
                {lastUpload.folio} creada · {lastUpload.count} renglones
              </span>
            </div>
          )}
          {uploadStatus === 'loading' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
              <div className="spinner" style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 12, color: 'var(--t4)' }}>Procesando Excel...</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Sucursal destino</label>
            <select value={uploadSucursal} onChange={(e) => setUploadSucursal(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '8px 10px', fontSize: 12, cursor: 'pointer', minWidth: 160 }}>
              <option value="">Selecciona…</option>
              {allSucursales.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <label
            style={{
              background: '#FFCD02',
              color: '#000',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 900,
              fontSize: 11,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              textTransform: 'uppercase',
              display: 'inline-block',
            }}
          >
            ↑ SUBIR EXCEL FOODBOT
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      {uploadError && (
        <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '10px 16px', margin: '0 0 20px', fontSize: 12, fontWeight: 600 }}>{uploadError}</div>
      )}

      {/* Fase 2: accordion */}
      <div data-tour="req-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 20 }}>
        {reqsForConciliation.map((req) => (
          <RequisicionRow
            key={req.id}
            req={req}
            renglonesFoodbot={foodbotByReq.get(req.id) ?? []}
            renglones={renglonesByReq.get(req.id) ?? []}
            ajustesByRenglon={ajustesByRenglon}
            isExpanded={expandedReqId === req.id}
            onToggle={() => setExpandedReqId((cur) => (cur === req.id ? null : req.id))}
            onCapturarEntrega={() => setCaptureReqId(req.id)}
            onAjusteSaved={refresh}
          />
        ))}
        {reqsForConciliation.length === 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--t6)', fontWeight: 600 }}>Ninguna requisición coincide con "{searchFolio}".</p>
          </div>
        )}
      </div>

      {/* Vista previa del Excel antes de confirmar la carga */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', border: '2px solid #FFCD02', width: '100%', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#FFCD02', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#000', textTransform: 'uppercase', marginBottom: 2 }}>
                  VISTA PREVIA · ARCHIVO FOODBOT
                </p>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#000', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.1 }}>Revisa antes de cargar</p>
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'rgba(0,0,0,0.12)', border: 'none', color: '#000', width: 32, height: 32, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', gap: 28, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Folio</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{preview.folio}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Sucursal</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{previewSucursal}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Fecha PO</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{preview.fecha}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Renglones</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>{preview.rows.length}</p>
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Importe total</p>
                <p style={{ fontSize: 13, fontWeight: 900, color: '#FFCD02' }}>{formatMoney(preview.importe_total)}</p>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--well)', position: 'sticky', top: 0 }}>
                    <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase', width: 40 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Producto</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cant. solicitada</th>
                    <th style={{ textAlign: 'right', padding: '8px 20px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Precio enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 12px', fontSize: 10, color: 'var(--t9)', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</td>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{r.producto}</td>
                      <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--t3)', fontWeight: 700, textAlign: 'right' }}>{formatCantidad(r.cantidad)}</td>
                      <td style={{ padding: '7px 20px', fontSize: 12, color: 'var(--t6)', textAlign: 'right' }}>{formatMoney(r.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setPreview(null)} style={{ background: 'transparent', border: '1px solid var(--border-in)', color: 'var(--t4)', padding: '11px 20px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}>
                CANCELAR
              </button>
              <button
                onClick={confirmUpload}
                disabled={isConfirming}
                style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '11px 26px', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', cursor: isConfirming ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: isConfirming ? 0.7 : 1 }}
              >
                {isConfirming ? 'CARGANDO…' : `CONFIRMAR CARGA — ${preview.rows.length} RENGLONES →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {captureReqId && captureTarget && (
        <CaptureFlow
          reqId={captureReqId}
          folio={captureTarget.folio}
          sucursal={captureTarget.sucursal}
          productosEsperados={(foodbotByReq.get(captureReqId) ?? []).map((r) => r.producto)}
          onClose={() => setCaptureReqId(null)}
          onSaved={async () => {
            setCaptureReqId(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}
