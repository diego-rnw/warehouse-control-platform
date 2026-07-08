import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import logo from '../assets/brand/logo-rnw-white-on-black.png';

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error';

interface QueuedPhoto {
  file: File;
  objectUrl: string;
}

export default function CapturaMovil() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState('');
  const [totalEnviadas, setTotalEnviadas] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Liberar object URLs al desmontar
  useEffect(() => {
    return () => queue.forEach((q) => URL.revokeObjectURL(q.objectUrl));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const nuevas: QueuedPhoto[] = Array.from(files).map((file) => ({
      file,
      objectUrl: URL.createObjectURL(file),
    }));
    setQueue((prev) => [...prev, ...nuevas]);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function removePhoto(index: number) {
    setQueue((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function sendQueue() {
    if (queue.length === 0 || !sessionId) return;
    setUploadStatus('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('sessionId', sessionId);
      for (const q of queue) form.append('fotos', q.file);

      const { data, error: fnError } = await supabase.functions.invoke('crear-sesion-upload', { body: form });
      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'error');
      }
      const count = queue.length;
      // Liberar object URLs antes de limpiar la cola
      queue.forEach((q) => URL.revokeObjectURL(q.objectUrl));
      setQueue([]);
      setTotalEnviadas((prev) => prev + count);
      setUploadStatus('done');
    } catch {
      setUploadStatus('error');
      setError('No se pudieron subir las fotos. Verifica tu conexión e intenta de nuevo — la sesión sigue activa mientras no expire.');
    }
  }

  const uploading = uploadStatus === 'uploading';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 40px', fontFamily: "'Montserrat', sans-serif" }}>
      <img src={logo} style={{ height: 26, width: 'auto', marginBottom: 32 }} alt="RNW" />

      <p style={{ fontSize: 10, letterSpacing: '0.16em', color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
        CAPTURA DE ENTREGA
      </p>
      <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', marginBottom: 8, lineHeight: 1.3 }}>
        Sube foto(s) de la hoja de requisición
      </h1>
      <p style={{ fontSize: 11, color: '#6a6a70', textAlign: 'center', marginBottom: 28, maxWidth: 300, lineHeight: 1.6 }}>
        Agrega todas las fotos que necesites y toca <strong style={{ color: '#aaa' }}>Enviar</strong> cuando estés listo.
      </p>

      {/* Confirmación de envío anterior */}
      {totalEnviadas > 0 && (
        <div style={{ background: '#0a2218', border: '1px solid #1a4232', padding: '10px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 400 }}>
          <span style={{ fontSize: 16, color: '#29E7BC' }}>✓</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#29E7BC' }}>
            {totalEnviadas} foto{totalEnviadas !== 1 ? 's' : ''} enviada{totalEnviadas !== 1 ? 's' : ''} — Almacén está procesando
          </span>
        </div>
      )}

      {/* Error */}
      {uploadStatus === 'error' && (
        <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600, width: '100%', maxWidth: 400, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Cola de fotos */}
      {queue.length > 0 && (
        <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: '#6a6a70', textTransform: 'uppercase', marginBottom: 10 }}>
            EN COLA — {queue.length} foto{queue.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {queue.map((q, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '4/3', background: '#1a1a1a', overflow: 'hidden' }}>
                <img
                  src={q.objectUrl}
                  alt={`Foto ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => removePhoto(i)}
                  disabled={uploading}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(0,0,0,0.75)', border: 'none', color: '#fff',
                    width: 24, height: 24, borderRadius: '50%', fontSize: 14,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0,
                  }}
                  aria-label="Eliminar foto"
                >
                  ×
                </button>
                <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón agregar fotos */}
      <label
        style={{
          background: 'transparent',
          color: uploading ? '#555' : '#FFCD02',
          border: `2px solid ${uploading ? '#333' : '#FFCD02'}`,
          padding: '14px 28px',
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: uploading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          maxWidth: 400,
          justifyContent: 'center',
          marginBottom: queue.length > 0 ? 12 : 0,
        }}
      >
        📷 {queue.length > 0 ? 'AGREGAR MÁS FOTOS' : 'ABRIR CÁMARA / GALERÍA'}
        {/* Sin capture="environment" para que iOS muestre el menú con opción
            de galería, que sí permite selección múltiple de imágenes. */}
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} style={{ display: 'none' }} />
      </label>

      {/* Botón enviar — solo visible cuando hay fotos en cola */}
      {queue.length > 0 && (
        <button
          onClick={sendQueue}
          disabled={uploading}
          style={{
            background: uploading ? '#555' : '#FFCD02',
            color: '#000',
            border: 'none',
            padding: '16px 28px',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            maxWidth: 400,
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#000' }} /> SUBIENDO…
            </>
          ) : (
            `ENVIAR ${queue.length} FOTO${queue.length !== 1 ? 'S' : ''} →`
          )}
        </button>
      )}

      {totalEnviadas > 0 && queue.length === 0 && uploadStatus !== 'uploading' && (
        <p style={{ fontSize: 11, color: '#6a6a70', textAlign: 'center', marginTop: 24, maxWidth: 280, lineHeight: 1.6 }}>
          Si la hoja tiene más páginas, agrega más fotos. Cuando termines, puedes cerrar esta ventana.
        </p>
      )}
    </div>
  );
}
