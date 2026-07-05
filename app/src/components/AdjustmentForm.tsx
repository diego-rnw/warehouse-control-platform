import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { matchChipStyle, MATCH_LABELS } from '../lib/chips';
import { formatSavedAt } from '../lib/format';
import type { Ajuste, ConciliacionRow } from '../lib/types';

interface Props {
  row: ConciliacionRow;
  historial: Ajuste[]; // todas las correcciones previas de este renglón, orden ascendente
  onSaved: () => void;
}

export default function AdjustmentForm({ row, historial, onSaved }: Props) {
  const { userLabel } = useAuth();
  const needsAdjustment = row.match_status === 'diferencia' || row.match_status === 'no_encontrado';
  const [isEditing, setIsEditing] = useState(needsAdjustment);
  const [cantidadNueva, setCantidadNueva] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (row.match_status === 'ok') {
    return <span style={matchChipStyle('ok')}>{MATCH_LABELS.ok}</span>;
  }

  async function handleSave() {
    setError('');
    if (!cantidadNueva) {
      setError('Ingresa la cantidad corregida.');
      return;
    }
    if (!motivo.trim()) {
      setError('El motivo del ajuste es obligatorio para guardar.');
      return;
    }
    setIsSaving(true);
    try {
      // SUPABASE: INSERT INTO ajustes — nunca UPDATE renglones_reparto, el dato
      // original es inmutable; cada corrección es un nuevo registro.
      const { error: insertErr } = await supabase.from('ajustes').insert({
        renglon_id: row.renglon_id,
        cantidad_anterior: row.cantidad_reparto,
        cantidad_nueva: parseFloat(cantidadNueva),
        motivo: motivo.trim(),
        usuario: userLabel,
      });
      if (insertErr) throw insertErr;
      setIsEditing(false);
      setCantidadNueva('');
      setMotivo('');
      onSaved();
    } catch {
      setError('No se pudo guardar el ajuste. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }

  function reopen() {
    setCantidadNueva('');
    setMotivo('');
    setError('');
    setIsEditing(true);
  }

  if (!isEditing && row.match_status === 'ajustado') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'var(--chip-ok-bg)', color: 'var(--chip-ok-tx)', border: '1px solid var(--chip-ok-bd)', padding: '2px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'inline-block' }}>
            ✓ AJUSTE GUARDADO
          </span>
          <button onClick={reopen} style={{ background: 'none', border: 'none', color: 'var(--t6)', fontSize: 10, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
            + Nueva corrección
          </button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 600 }}>
          Nueva cant.: {row.cantidad_ajustada} · {row.fecha_ajuste ? formatSavedAt(new Date(row.fecha_ajuste)) : ''}
        </span>
        <span style={{ fontSize: 10, color: 'var(--t7)', fontStyle: 'italic', lineHeight: 1.4 }}>{row.motivo_ajuste}</span>
        {historial.length > 0 && (
          <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px dashed var(--border-in)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--t8)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Correcciones anteriores</span>
            {historial.map((h) => (
              <div key={h.id} style={{ fontSize: 10, color: 'var(--t8)', lineHeight: 1.4 }}>
                <span style={{ fontWeight: 700 }}>{h.cantidad_nueva}</span> · {h.motivo} · {formatSavedAt(new Date(h.creado_en))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 300 }}>
      <span style={matchChipStyle(row.match_status)}>{MATCH_LABELS[row.match_status]}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cant. corregida *</label>
          <input type="number" value={cantidadNueva} onChange={(e) => setCantidadNueva(e.target.value)} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '6px 10px', fontSize: 13, width: 90, fontWeight: 700, textAlign: 'right' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Motivo obligatorio *</label>
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: error en Foodbot" style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '6px 10px', fontSize: 12 }} />
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{ background: '#E84926', color: '#fff', border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', cursor: isSaving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap', height: 34, alignSelf: 'flex-end', opacity: isSaving ? 0.7 : 1 }}
        >
          GUARDAR AJUSTE
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: '#E84926', fontWeight: 700 }}>{error}</span>}
    </div>
  );
}
