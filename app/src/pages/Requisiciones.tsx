import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { validateExcelFile, parseFoodbotExcel } from '../lib/excel';
import RequisicionRow from '../components/RequisicionRow';
import CaptureFlow from '../components/CaptureFlow';
import type { Ajuste } from '../lib/types';

export default function Requisiciones() {
  const { dashboardRows, conciliacionRows, renglonesFoodbot, ajustes, isLoading, error, refresh } = useData();

  const [searchFolio, setSearchFolio] = useState('');
  const [uploadSucursal, setUploadSucursal] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'loaded'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [lastUpload, setLastUpload] = useState<{ folio: string; count: number } | null>(null);
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [captureReqId, setCaptureReqId] = useState<string | null>(null);

  const allSucursales = useMemo(() => [...new Set(dashboardRows.map((r) => r.sucursal))].sort(), [dashboardRows]);

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
    if (!uploadSucursal) {
      setUploadError('Selecciona la sucursal destino antes de subir el Excel.');
      e.target.value = '';
      return;
    }

    setUploadStatus('loading');
    try {
      const parsed = await parseFoodbotExcel(file);
      const reqId = 'req-' + crypto.randomUUID();

      // SUPABASE: INSERT requisiciones (estatus 'pendiente_captura')
      const { error: reqErr } = await supabase.from('requisiciones').insert({
        id: reqId,
        folio: parsed.folio,
        sucursal: uploadSucursal,
        fecha: new Date().toISOString().split('T')[0],
        estatus: 'pendiente_captura',
      });
      if (reqErr) throw reqErr;

      // SUPABASE: batch INSERT renglones_foodbot
      const { error: rowsErr } = await supabase.from('renglones_foodbot').insert(
        parsed.rows.map((r) => ({ requisicion_id: reqId, producto: r.producto, cantidad: r.cantidad, costo: r.costo })),
      );
      if (rowsErr) throw rowsErr;

      setUploadStatus('loaded');
      setLastUpload({ folio: parsed.folio, count: parsed.rows.length });
      setUploadSucursal('');
      await refresh();
    } catch (err) {
      setUploadStatus('idle');
      setUploadError(err instanceof Error && err.message.includes('renglones válidos') ? err.message : 'No se pudo crear la requisición. Verifica tu conexión e intenta de nuevo.');
    } finally {
      e.target.value = '';
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
            Sube el Excel exportado de Foodbot y selecciona la sucursal a la que fue enviada la requisición. Se creará el registro pendiente de captura de entrega.
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
              background: !uploadSucursal ? 'var(--well)' : '#FFCD02',
              color: !uploadSucursal ? 'var(--t7)' : '#000',
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

      {captureReqId && captureTarget && (
        <CaptureFlow
          reqId={captureReqId}
          folio={captureTarget.folio}
          sucursal={captureTarget.sucursal}
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
