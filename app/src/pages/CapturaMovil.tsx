import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import logo from '../assets/brand/logo-rnw-white-on-black.png';

type Status = 'idle' | 'uploading' | 'done' | 'error';

export default function CapturaMovil() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [totalEnviadas, setTotalEnviadas] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !sessionId) return;
    setStatus('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('sessionId', sessionId);
      for (const file of files) form.append('fotos', file);

      // SUPABASE: Edge Function crear-sesion-upload — valida que la sesión
      // exista y no haya expirado, sube las fotos al bucket privado
      // 'requisicion-fotos' con la service role key, inserta fotos_requisicion
      // y marca capture_sessions.estatus = 'fotos_recibidas'. El cliente
      // anónimo (este celular, sin login) nunca toca Storage directo.
      const { data, error: fnError } = await supabase.functions.invoke('crear-sesion-upload', { body: form });
      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'error');
      }
      setTotalEnviadas((prev) => prev + files.length);
      setStatus('done');
    } catch {
      setStatus('error');
      setError('No se pudieron subir las fotos. Verifica tu conexión e intenta de nuevo — la sesión sigue activa mientras no expire.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const uploading = status === 'uploading';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Montserrat', sans-serif" }}>
      <img src={logo} style={{ height: 26, width: 'auto', marginBottom: 32 }} alt="RNW" />

      <p style={{ fontSize: 10, letterSpacing: '0.16em', color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
        CAPTURA DE ENTREGA
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 24, lineHeight: 1.3 }}>
        Sube foto(s) de la hoja de requisición
      </h1>

      {status === 'done' && (
        <div style={{ background: '#0a2218', border: '1px solid #1a4232', padding: '12px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 320 }}>
          <span style={{ fontSize: 18, color: '#29E7BC' }}>✓</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#29E7BC' }}>
            {totalEnviadas} foto{totalEnviadas === 1 ? '' : 's'} enviada{totalEnviadas === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, maxWidth: 320, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <label
        style={{
          background: uploading ? '#333' : '#FFCD02',
          color: '#000',
          border: 'none',
          padding: '18px 32px',
          fontWeight: 900,
          fontSize: 14,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: uploading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: uploading ? 0.7 : 1,
        }}
      >
        {uploading ? (
          <>
            <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#000' }} /> SUBIENDO…
          </>
        ) : status === 'done' ? (
          '📷 SUBIR MÁS FOTOS'
        ) : (
          '📷 ABRIR CÁMARA / GALERÍA'
        )}
        {/* Sin capture="environment" para que iOS muestre el menú con opción
            de galería, que sí permite selección múltiple de imágenes. */}
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} style={{ display: 'none' }} />
      </label>

      {status === 'done' ? (
        <p style={{ fontSize: 11, color: '#6a6a70', textAlign: 'center', marginTop: 24, maxWidth: 280, lineHeight: 1.6 }}>
          Si la hoja tiene más páginas, toca "Subir más fotos". Cuando termines, puedes cerrar esta ventana — Almacén está procesando los datos.
        </p>
      ) : (
        <p style={{ fontSize: 11, color: '#6a6a70', textAlign: 'center', marginTop: 24, maxWidth: 280, lineHeight: 1.6 }}>
          Selecciona varias fotos a la vez si la hoja tiene más de una página. Esta pantalla no requiere iniciar sesión.
        </p>
      )}
    </div>
  );
}
