import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import logo from '../assets/brand/logo-rnw-white-on-black.png';

// Destino del link de invitación por correo. Supabase procesa el token del
// hash de la URL (detectSessionInUrl) y crea la sesión; aquí el usuario
// establece su contraseña para activar la cuenta.
export default function ActivarCuenta() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // El token del correo llega en el hash; supabase-js lo procesa y emite
    // el evento. Esperamos a que exista sesión antes de mostrar el form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
        setNombre((data.session.user.user_metadata?.nombre as string) ?? '');
      }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setHasSession(true);
        setNombre((session.user.user_metadata?.nombre as string) ?? '');
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function activar() {
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateErr) {
      setError('No se pudo establecer la contraseña. Intenta de nuevo o pide una nueva invitación.');
      return;
    }
    navigate('/dashboard', { replace: true });
  }

  const input: React.CSSProperties = { background: '#111', border: '1px solid #2a2a2a', color: '#fff', padding: '12px 16px', fontSize: 14, width: '100%' };
  const label: React.CSSProperties = { fontSize: 9, color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6, display: 'block' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 440, background: '#000', border: '1px solid #1e1e1e', borderTop: '3px solid #FFCD02', padding: '40px 36px' }}>
        <img src={logo} style={{ height: 24, width: 'auto', marginBottom: 28 }} alt="RNW" />

        {!ready && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        )}

        {ready && !hasSession && (
          <>
            <p style={{ fontSize: 10, letterSpacing: '0.16em', color: '#E84926', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>ENLACE INVÁLIDO O EXPIRADO</p>
            <p style={{ fontSize: 13, color: '#9a9aa0', lineHeight: 1.7 }}>
              Este enlace de activación ya no es válido. Pide al administrador que te envíe una nueva invitación.
            </p>
          </>
        )}

        {ready && hasSession && (
          <>
            <p style={{ fontSize: 10, letterSpacing: '0.16em', color: '#FFCD02', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>ACTIVA TU CUENTA</p>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, lineHeight: 1.3 }}>
              {nombre ? `Hola, ${nombre}.` : 'Hola.'}
            </h1>
            <p style={{ fontSize: 13, color: '#9a9aa0', lineHeight: 1.6, marginBottom: 26 }}>
              Fuiste invitado al sistema de Control de Almacén de Rock n' Wok. Crea tu contraseña para activar tu acceso.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={label}>Contraseña (mín. 8 caracteres)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={input} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={label}>Confirmar contraseña</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} onKeyDown={(e) => e.key === 'Enter' && activar()} />
            </div>

            {error && (
              <div style={{ background: '#2a0f00', border: '1px solid #E84926', color: '#E84926', padding: '10px 14px', marginBottom: 16, fontSize: 12, fontWeight: 600 }}>{error}</div>
            )}

            <button
              onClick={activar}
              disabled={saving}
              style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '14px 20px', fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', cursor: saving ? 'not-allowed' : 'pointer', textTransform: 'uppercase', width: '100%', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'ACTIVANDO…' : 'ACTIVAR MI CUENTA →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
