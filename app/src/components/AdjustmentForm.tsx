import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { matchChipStyle, MATCH_LABELS } from '../lib/chips';
import { formatSavedAt } from '../lib/format';
import type { Ajuste, ConciliacionRow } from '../lib/types';

interface Props {
  row: ConciliacionRow;
  historial: Ajuste[];
  onSaved: () => void;
}

export default function AdjustmentForm({ row, historial, onSaved }: Props) {
  const { userLabel } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [cantidadNueva, setCantidadNueva] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (row.match_status === 'ok') {
    return <span style={matchChipStyle('ok')}>{MATCH_LABELS.ok}</span>;
  }

  async function handleSave() {
    setError('');
    if (!cantidadNueva) { setError('Ingresa la cantidad corregida.'); return; }
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }

    setIsSaving(true);
    try {
      const { error: insertErr } = await supabase.from('ajustes').insert({
        renglon_id: row.renglon_id,
        cantidad_anterior: row.cantidad_reparto,
        cantidad_nueva: parseFloat(cantidadNueva),
        motivo: motivo.trim(),
        usuario: userLabel ?? 'almacen',
      });
      if (insertErr) throw insertErr;
      setIsOpen(false);
      setCantidadNueva('');
      setMotivo('');
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'No se pudo guardar el ajuste.');
    } finally {
      setIsSaving(false);
    }
  }

  // Estado: ajustado
  if (row.match_status === 'ajustado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--chip-ok-bg)', color: 'var(--chip-ok-tx)', border: '1px solid var(--chip-ok-bd)', padding: '2px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ✓ AJUSTADO
          </span>
          <button onClick={() => setIsOpen((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--t6)', fontSize: 10, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            + Nueva corrección
          </button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 600 }}>
          {row.cantidad_ajustada} · {row.fecha_ajuste ? formatSavedAt(new Date(row.fecha_ajuste)) : ''}
        </span>
        <span style={{ fontSize: 10, color: 'var(--t7)', fontStyle: 'italic' }}>{row.motivo_ajuste}</span>
        {historial.length > 0 && (
          <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed var(--border-in)' }}>
            {historial.map((h) => (
              <div key={h.id} style={{ fontSize: 10, color: 'var(--t8)', lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700 }}>{h.cantidad_nueva}</span> · {h.motivo}
              </div>
            ))}
          </div>
        )}
        {isOpen && <AjusteInline cantidadNueva={cantidadNueva} setCantidadNueva={setCantidadNueva} motivo={motivo} setMotivo={setMotivo} isSaving={isSaving} error={error} onSave={handleSave} onCancel={() => { setIsOpen(false); setCantidadNueva(''); setMotivo(''); setError(''); }} />}
      </div>
    );
  }

  // Estado: diferencia / no_encontrado — chip + botón para abrir el form
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={matchChipStyle(row.match_status)}>{MATCH_LABELS[row.match_status]}</span>
        <button
          onClick={() => setIsOpen((v) => !v)}
          style={{ background: isOpen ? 'var(--well)' : 'transparent', border: '1px solid var(--border-in)', color: 'var(--t4)', padding: '3px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
        >
          {isOpen ? 'CANCELAR' : 'AJUSTAR ▸'}
        </button>
      </div>
      {isOpen && (
        <AjusteInline
          cantidadNueva={cantidadNueva}
          setCantidadNueva={setCantidadNueva}
          motivo={motivo}
          setMotivo={setMotivo}
          isSaving={isSaving}
          error={error}
          onSave={handleSave}
          onCancel={() => { setIsOpen(false); setCantidadNueva(''); setMotivo(''); setError(''); }}
        />
      )}
    </div>
  );
}

function AjusteInline({ cantidadNueva, setCantidadNueva, motivo, setMotivo, isSaving, error, onSave, onCancel }: {
  cantidadNueva: string; setCantidadNueva: (v: string) => void;
  motivo: string; setMotivo: (v: string) => void;
  isSaving: boolean; error: string;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--well)', border: '1px solid var(--border-in)', padding: '10px 12px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cant. corregida *</label>
          <input
            type="number"
            value={cantidadNueva}
            onChange={(e) => setCantidadNueva(e.target.value)}
            autoFocus
            style={{ background: 'var(--surface)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '6px 10px', fontSize: 13, width: 90, fontWeight: 700, textAlign: 'right' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Motivo *</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: error en Foodbot"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '6px 10px', fontSize: 12 }}
          />
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{ background: '#E84926', color: '#fff', border: 'none', padding: '8px 14px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', cursor: isSaving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', height: 34, alignSelf: 'flex-end', opacity: isSaving ? 0.7 : 1 }}
        >
          {isSaving ? '...' : 'GUARDAR'}
        </button>
        <button
          onClick={onCancel}
          style={{ background: 'transparent', border: 'none', color: 'var(--t7)', fontSize: 10, cursor: 'pointer', height: 34, alignSelf: 'flex-end', padding: '0 4px' }}
        >
          ✕
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: '#E84926', fontWeight: 700 }}>{error}</span>}
    </div>
  );
}
