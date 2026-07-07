import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { generateQrDataUrl, captureUrl } from '../lib/qr';
import { formatCountdown, formatMoney, todayIso } from '../lib/format';
import { confianzaColor, confianzaRowBg, formatConfianza } from '../lib/format';
import type { CaptureEstatus, CaptureSession, PersonalReparto, ReviewRow, Unidad } from '../lib/types';

const QR_CFG: Record<CaptureEstatus, { text: string; bg: string; border: string; dot: string; color: string; anim: string }> = {
  esperando_fotos: { text: 'Esperando fotos desde el celular...', bg: '#0d0d00', border: '#2a2000', dot: '#FFCD02', color: '#FFCD02', anim: 'blink 1.4s ease-in-out infinite' },
  fotos_recibidas: { text: 'Fotos recibidas — iniciando análisis...', bg: '#0a1420', border: '#1a2840', dot: '#5a9acc', color: '#6aaae0', anim: 'blink 0.7s ease-in-out infinite' },
  procesando: { text: 'Gemini Vision extrayendo datos del documento...', bg: '#0a1420', border: '#1a2840', dot: '#5a9acc', color: '#6aaae0', anim: 'spin 1s linear infinite' },
  listo_para_revision: { text: '¡Datos listos para revisión!', bg: '#0a2218', border: '#1a4232', dot: '#29E7BC', color: '#29E7BC', anim: 'none' },
  completada: { text: 'Entrega guardada.', bg: '#0a2218', border: '#1a4232', dot: '#29E7BC', color: '#29E7BC', anim: 'none' },
  expirada: { text: 'Sesión expirada. Genera un nuevo QR.', bg: '#1e0800', border: '#3a1200', dot: '#E84926', color: '#E84926', anim: 'none' },
};

const UNIDADES: Unidad[] = ['pza', 'kg', 'lt'];

interface Props {
  reqId: string;
  folio: string;
  sucursal: string;
  productosEsperados: string[]; // productos del Excel de Foodbot
  onClose: () => void;
  onSaved: () => void;
}

export default function CaptureFlow({ reqId, folio, sucursal, productosEsperados, onClose, onSaved }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [estatus, setEstatus] = useState<CaptureEstatus>('esperando_fotos');
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [initError, setInitError] = useState('');
  const [visionError, setVisionError] = useState('');
  const [remaining, setRemaining] = useState(900);
  const [phase, setPhase] = useState<'qr' | 'review'>('qr');

  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [reviewFecha, setReviewFecha] = useState(todayIso());
  const [docTotal, setDocTotal] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [personal, setPersonal] = useState<PersonalReparto[]>([]);

  const sessionIdRef = useRef<string | null>(null);

  // Catálogo de personal de reparto para el dropdown de la revisión.
  useEffect(() => {
    supabase
      .from('personal_reparto')
      .select('id, nombre, activo')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        if (data) setPersonal(data as PersonalReparto[]);
      });
  }, []);

  async function handleRepartidorChange(rowId: string, value: string) {
    if (value === '__nuevo__') {
      const nombre = window.prompt('Nombre del nuevo repartidor:')?.trim();
      if (!nombre) return;
      const { data, error } = await supabase
        .from('personal_reparto')
        .insert({ nombre })
        .select('id, nombre, activo')
        .single();
      if (error) {
        // 23505 = nombre duplicado: recupera el existente y asígnalo
        if (error.code === '23505') {
          setReviewRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, repartidor: nombre } : r)));
          return;
        }
        window.alert('No se pudo registrar al repartidor: ' + error.message);
        return;
      }
      setPersonal((prev) => [...prev, data as PersonalReparto].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setReviewRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, repartidor: (data as PersonalReparto).nombre } : r)));
      return;
    }
    setReviewRows((rows) => rows.map((r) => (r.id === rowId ? { ...r, repartidor: value } : r)));
  }

  // Crea la capture_session al abrir el modal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = 'SESS-' + Array.from(crypto.getRandomValues(new Uint8Array(10))).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const expira = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      // SUPABASE: INSERT INTO capture_sessions (id, requisicion_id, estatus, expira_en)
      const { error } = await supabase.from('capture_sessions').insert({
        id,
        requisicion_id: reqId,
        estatus: 'esperando_fotos',
        expira_en: expira,
      });
      if (cancelled) return;
      if (error) {
        setInitError(`Error al crear sesión: ${error.message} (${error.code})`);
        return;
      }
      setSessionId(id);
      sessionIdRef.current = id;
      setExpiraEn(expira);
      const dataUrl = await generateQrDataUrl(id);
      if (!cancelled) setQrDataUrl(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId]);

  // SUPABASE: Realtime — detecta sin polling cuándo la Edge Function marcó
  // fotos_recibidas / procesando / listo_para_revision.
  // COMPLEMENTO: el websocket se suspende cuando la pestaña pasa a segundo
  // plano y los eventos se pierden. Por eso también re-sincronizamos desde la
  // DB al volver a la pestaña (visibilitychange) y con un polling ligero de
  // respaldo mientras la sesión sigue en espera.
  useEffect(() => {
    if (!sessionId) return;

    function applySession(row: CaptureSession) {
      setEstatus(row.estatus);
      setVisionError(row.error_mensaje ?? '');
      if (row.estatus === 'listo_para_revision' && row.extraccion?.renglones) {
        if (typeof row.extraccion.total === 'number') setDocTotal(row.extraccion.total);
        setReviewRows((prev) => {
          // Merge: conserva las filas existentes (con ediciones del usuario) y
          // agrega solo los productos nuevos de rondas adicionales de fotos.
          const existentes = new Set(prev.map((r) => r.producto.trim().toLowerCase()));
          const nuevas = row.extraccion!.renglones
            .filter((r) => !existentes.has(r.producto.trim().toLowerCase()))
            .map((r, i) => ({
              id: `nr-${prev.length + i}-${Date.now()}`,
              producto: r.producto,
              cantidad: String(r.cantidad),
              unidad: r.unidad,
              costo: String(r.costo),
              origen: r.origen,
              entregado: r.entregado !== false,
              repartidor: '',
              confianza: r.confianza,
            }));
          return nuevas.length > 0 ? [...prev, ...nuevas] : prev;
        });
      }
    }

    async function refetchSession() {
      const { data } = await supabase.from('capture_sessions').select('*').eq('id', sessionId).single();
      if (data) applySession(data as CaptureSession);
    }

    const channel = supabase
      .channel('session-' + sessionId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'capture_sessions', filter: `id=eq.${sessionId}` },
        (payload) => applySession(payload.new as CaptureSession),
      )
      .subscribe();

    // Re-sincroniza al volver a la pestaña (eventos Realtime perdidos en background)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchSession();
    };
    document.addEventListener('visibilitychange', onVisible);

    // Polling de respaldo cada 8s — barato y garantiza avance aunque Realtime falle
    const poll = window.setInterval(() => {
      setEstatus((cur) => {
        if (cur === 'esperando_fotos' || cur === 'fotos_recibidas' || cur === 'procesando') refetchSession();
        return cur;
      });
    }, 8000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
    };
  }, [sessionId]);

  // Countdown derivado de expira_en (no un contador local independiente).
  useEffect(() => {
    if (!expiraEn) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(expiraEn).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) setEstatus((prev) => (prev === 'listo_para_revision' || prev === 'completada' ? prev : 'expirada'));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiraEn]);

  const reviewTotal = useMemo(
    () => reviewRows.filter((r) => r.entregado).reduce((sum, r) => sum + (parseFloat(r.cantidad) || 0) * (parseFloat(r.costo) || 0), 0),
    [reviewRows],
  );

  // Productos del Excel de Foodbot que Gemini NO extrajo de las fotos.
  const productosFaltantes = useMemo(() => {
    const extraidos = new Set(reviewRows.map((r) => r.producto.trim().toLowerCase()));
    return productosEsperados.filter((p) => !extraidos.has(p.trim().toLowerCase()));
  }, [reviewRows, productosEsperados]);

  function addMissingRow(producto: string) {
    setReviewRows((rows) => [...rows, { id: 'nr-' + Date.now(), producto, cantidad: '1', unidad: 'pza', costo: '0', origen: 'almacen', entregado: false, repartidor: '', confianza: null }]);
  }

  function updateRow(id: string, field: keyof ReviewRow, value: string) {
    setReviewRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function deleteRow(id: string) {
    setReviewRows((rows) => rows.filter((r) => r.id !== id));
  }

  function addRow() {
    setReviewRows((rows) => [...rows, { id: 'nr-' + Date.now(), producto: '', cantidad: '1', unidad: 'pza', costo: '0', origen: 'almacen', entregado: true, repartidor: '', confianza: null }]);
  }

  async function saveCaptura() {
    setSaveError('');
    if (!reviewFecha) {
      setSaveError('La fecha de entrega es obligatoria.');
      return;
    }
    if (reviewRows.length === 0) {
      setSaveError('Debes capturar al menos un renglón.');
      return;
    }
    const confirmed = window.confirm(
      `Vas a guardar la entrega de ${folio} con ${reviewRows.length} renglón(es).\n\nEsta acción es irreversible: renglones_reparto queda inmutable una vez guardado. ¿Confirmas?`,
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      // SUPABASE: batch INSERT renglones_reparto (inmutable desde este punto)
      const { error: insertErr } = await supabase.from('renglones_reparto').insert(
        reviewRows.map((r) => ({
          id: 'rp-' + Array.from(crypto.getRandomValues(new Uint8Array(10))).map((b) => b.toString(16).padStart(2, '0')).join(''),
          requisicion_id: reqId,
          producto: r.producto,
          cantidad: parseFloat(r.cantidad) || 0,
          unidad: r.unidad,
          costo: parseFloat(r.costo) || 0,
          origen: r.origen,
          entregado: r.entregado,
          repartidor: r.repartidor || null,
          confianza_ocr: r.confianza,
        })),
      );
      if (insertErr) throw insertErr;

      // SUPABASE: UPDATE requisiciones — también actualiza importe_total con el total
      // leído por Gemini del footer del documento (o el calculado si no hubo footer).
      const { error: updateReqErr } = await supabase
        .from('requisiciones')
        .update({ fecha: reviewFecha, session_id: sessionIdRef.current, importe_total: docTotal ?? reviewTotal })
        .eq('id', reqId);
      if (updateReqErr) throw updateReqErr;

      // SUPABASE: UPDATE capture_sessions SET estatus = 'completada'
      if (sessionIdRef.current) {
        await supabase.from('capture_sessions').update({ estatus: 'completada' }).eq('id', sessionIdRef.current);
      }

      onSaved();
    } catch {
      setSaveError('No se pudo guardar la entrega. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }

  const isWaiting = estatus === 'esperando_fotos' || estatus === 'fotos_recibidas' || estatus === 'procesando';
  const isReady = estatus === 'listo_para_revision';
  const cfg = QR_CFG[estatus];

  if (phase === 'qr') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#0a0a0a', border: '2px solid #FFCD02', width: '100%', maxWidth: 600 }}>
          <div style={{ background: '#FFCD02', padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#000', textTransform: 'uppercase', marginBottom: 2 }}>
                CAPTURA DE ENTREGA · {folio} · {sucursal}
              </p>
              <p style={{ fontSize: 15, fontWeight: 900, color: '#000', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.1 }}>Escanea con tu celular</p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.12)', border: 'none', color: '#000', width: 32, height: 32, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>
              ×
            </button>
          </div>

          <div style={{ padding: 28, display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#fff', padding: 16, display: 'inline-flex' }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} width={220} height={220} alt="QR Code" />
                ) : (
                  <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" style={{ width: 36, height: 36, borderTopColor: '#000' }} />
                  </div>
                )}
              </div>
              <p style={{ fontSize: 9, color: '#9a9aa0', textAlign: 'center', maxWidth: 220, lineHeight: 1.7, wordBreak: 'break-all', fontFamily: "'Courier New', monospace" }}>
                {sessionId ? captureUrl(sessionId) : ''}
              </p>
            </div>

            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {initError && <p style={{ fontSize: 12, color: '#E84926', fontWeight: 600 }}>{initError}</p>}
              {visionError && (
                <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>{visionError}</div>
              )}

              <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, animation: cfg.anim, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.text}</span>
                </div>
              </div>

              {isWaiting && (
                <div>
                  <p style={{ fontSize: 9, color: '#9a9aa0', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>SESIÓN EXPIRA EN</p>
                  <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{formatCountdown(remaining)}</p>
                </div>
              )}

              <div>
                <p style={{ fontSize: 9, color: '#9a9aa0', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>INSTRUCCIONES</p>
                <ol style={{ fontSize: 12, color: '#aeaeb3', lineHeight: 2, paddingLeft: 18 }}>
                  <li>Abre la cámara del celular</li>
                  <li>Enfoca el código QR</li>
                  <li>Sube la(s) foto(s) de la hoja</li>
                  <li>Esta pantalla avanza automáticamente</li>
                </ol>
              </div>

              {isReady && (
                <button onClick={() => setPhase('review')} style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '14px 20px', fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', width: '100%' }}>
                  REVISAR DATOS EXTRAÍDOS →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== REVIEW =====
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--canvas)', zIndex: 200, overflowY: 'auto' }}>
      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--t5)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>FASE 2 — REVISIÓN Y CONFIRMACIÓN</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              Confirmar entrega — {folio} · {sucursal}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--t7)', marginTop: 6, lineHeight: 1.6 }}>Revisa y corrige antes de guardar. Confianza baja = verificar contra la hoja física. Campos * obligatorios.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-in)', color: 'var(--t4)', padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}>
              CANCELAR
            </button>
            <button onClick={saveCaptura} disabled={isSaving} style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '10px 24px', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em', cursor: isSaving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: isSaving ? 0.7 : 1 }}>
              GUARDAR ENTREGA
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '2px solid #FFCD02', padding: '18px 22px', marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 140 }}>
            <p style={{ fontSize: 9, color: 'var(--t5)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Folio</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', letterSpacing: '0.02em' }}>{folio}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 140 }}>
            <p style={{ fontSize: 9, color: 'var(--t5)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Sucursal</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)' }}>{sucursal}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
            <label style={{ fontSize: 9, color: 'var(--t5)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Fecha de entrega *</label>
            <input type="date" value={reviewFecha} onChange={(e) => setReviewFecha(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '10px 14px', fontSize: 14, fontWeight: 700 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130, alignSelf: 'flex-end' }}>
            <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {docTotal !== null ? 'Total del documento' : 'Importe calculado'}
            </p>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#FFCD02', lineHeight: 1, letterSpacing: '-0.01em' }}>
              {formatMoney(docTotal ?? reviewTotal)}
            </p>
          </div>
        </div>

        {productosFaltantes.length > 0 && (
          <div style={{ background: '#1e1400', border: '1px solid #b58900', padding: '14px 20px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#FFCD02', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              ⚠ {productosFaltantes.length} producto{productosFaltantes.length === 1 ? '' : 's'} del Excel no detectado{productosFaltantes.length === 1 ? '' : 's'} en las fotos
            </p>
            <p style={{ fontSize: 11, color: 'var(--t6)', marginBottom: 10, lineHeight: 1.5 }}>
              Verifica contra la hoja física. Haz clic para agregarlo a la tabla y captura su cantidad manualmente.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {productosFaltantes.map((p) => (
                <button
                  key={p}
                  onClick={() => addMissingRow(p)}
                  style={{ background: 'transparent', border: '1px dashed #b58900', color: '#FFCD02', padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  + {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 16, overflowX: 'auto' }}>
          <div style={{ padding: '11px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t6)', textTransform: 'uppercase' }}>RENGLONES — {reviewRows.length} PRODUCTOS EXTRAÍDOS</span>
            <span style={{ fontSize: 10, color: 'var(--t8)', fontStyle: 'italic' }}>Celdas editables — confianza baja requiere verificación manual</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--divider-2)' }}>
                <th style={{ textAlign: 'center', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase', width: 36 }}>#</th>
                <th style={{ textAlign: 'left', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Producto</th>
                <th style={{ textAlign: 'right', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cantidad</th>
                <th style={{ textAlign: 'left', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Unidad</th>
                <th style={{ textAlign: 'right', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Costo</th>
                <th style={{ textAlign: 'left', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Origen</th>
                <th style={{ textAlign: 'left', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Repartidor</th>
                <th style={{ textAlign: 'left', padding: '9px 10px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Entregado</th>
                <th style={{ textAlign: 'center', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Confianza</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {reviewRows.map((row, i) => (
                <tr key={row.id} style={{ background: confianzaRowBg(row.confianza) }}>
                  <td style={{ padding: '7px 14px', fontSize: 10, color: 'var(--t9)', fontWeight: 700, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</td>
                  <td style={{ padding: '5px 10px' }}>
                    <input type="text" value={row.producto} onChange={(e) => updateRow(row.id, 'producto', e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border)', color: 'var(--t1)', padding: '6px 10px', fontSize: 13, width: '100%', minWidth: 240, fontWeight: 600 }} />
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <input type="number" value={row.cantidad} onChange={(e) => updateRow(row.id, 'cantidad', e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border)', color: 'var(--t1)', padding: '6px 10px', fontSize: 13, width: 110, fontWeight: 700, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <select value={row.unidad} onChange={(e) => updateRow(row.id, 'unidad', e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border)', color: 'var(--t2)', padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <input type="number" value={row.costo} onChange={(e) => updateRow(row.id, 'costo', e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border)', color: 'var(--t1)', padding: '6px 10px', fontSize: 13, width: 88, fontWeight: 700, textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <select
                      value={row.origen}
                      onChange={(e) => updateRow(row.id, 'origen', e.target.value)}
                      style={
                        {
                          background: 'var(--well)',
                          border: '1px solid var(--border)',
                          color: 'var(--t2)',
                          padding: '6px 8px',
                          fontSize: 12,
                          cursor: 'pointer',
                          borderLeft: `3px solid ${row.origen === 'almacen' ? '#FFCD02' : '#E84926'}`,
                        } as CSSProperties
                      }
                    >
                      <option value="almacen">ALMACÉN</option>
                      <option value="cocina">COCINA</option>
                    </select>
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <select
                      value={row.repartidor}
                      onChange={(e) => handleRepartidorChange(row.id, e.target.value)}
                      style={
                        {
                          background: 'var(--well)',
                          border: '1px solid var(--border)',
                          color: row.repartidor ? 'var(--t2)' : 'var(--t8)',
                          padding: '6px 8px',
                          fontSize: 12,
                          cursor: 'pointer',
                          minWidth: 130,
                        } as CSSProperties
                      }
                    >
                      <option value="">Selecciona…</option>
                      {personal.map((p) => (
                        <option key={p.id} value={p.nombre}>
                          {p.nombre}
                        </option>
                      ))}
                      <option value="__nuevo__">+ Nuevo…</option>
                    </select>
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    <select
                      value={row.entregado ? 'si' : 'no'}
                      onChange={(e) => setReviewRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, entregado: e.target.value === 'si' } : r)))}
                      style={
                        {
                          background: 'var(--well)',
                          border: '1px solid var(--border)',
                          color: row.entregado ? 'var(--chip-ok-tx)' : '#E84926',
                          padding: '6px 8px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          borderLeft: `3px solid ${row.entregado ? '#0e8f72' : '#E84926'}`,
                        } as CSSProperties
                      }
                    >
                      <option value="si">ENTREGADO</option>
                      <option value="no">NO ENTREGADO</option>
                    </select>
                  </td>
                  <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: confianzaColor(row.confianza) }}>{formatConfianza(row.confianza)}</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                    <button onClick={() => deleteRow(row.id)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--t8)', width: 26, height: 26, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '11px 20px', borderTop: '1px solid var(--divider-2)' }}>
            <button onClick={addRow} style={{ background: 'transparent', border: '1px dashed var(--border-in)', color: 'var(--t7)', padding: '7px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', textTransform: 'uppercase' }}>
              + AGREGAR RENGLÓN
            </button>
          </div>
        </div>

        {saveError && (
          <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '12px 18px', marginBottom: 14, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>{saveError}</span>
            <span style={{ fontSize: 10, color: '#ff8a6a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Reintenta con "GUARDAR ENTREGA"</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border-in)', color: 'var(--t4)', padding: '12px 22px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}>
            CANCELAR
          </button>
          <button onClick={saveCaptura} disabled={isSaving} style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '12px 28px', fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', cursor: isSaving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: isSaving ? 0.7 : 1 }}>
            GUARDAR ENTREGA →
          </button>
        </div>
      </div>
    </div>
  );
}
