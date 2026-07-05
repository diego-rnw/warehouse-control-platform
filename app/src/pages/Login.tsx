import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/brand/logo-rnw-white-on-black.png';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo y contraseña.');
      return;
    }
    setError('');
    setIsLoading(true);
    const { error: loginError } = await login(email.trim(), password);
    setIsLoading(false);
    if (loginError) {
      setError(loginError);
      return;
    }
    setPassword('');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, justifyContent: 'center' }}>
          <img src={logo} style={{ height: 30, width: 'auto' }} alt="RNW" />
        </div>
        <p style={{ fontSize: 10, letterSpacing: '0.18em', color: '#7a7a80', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 }}>
          PANEL OPERATIVO
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', textAlign: 'center', marginBottom: 32 }}>
          Control de Almacén
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@rocknwok.mx"
              autoComplete="username"
              style={{ background: '#111', border: '1px solid #2a2a2a', color: '#fff', padding: '12px 14px', fontSize: 14 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, color: '#8a8a90', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ background: '#111', border: '1px solid #2a2a2a', color: '#fff', padding: '12px 14px', fontSize: 14 }}
            />
          </div>
          {error && <p style={{ fontSize: 12, color: '#E84926', fontWeight: 600, marginTop: -4 }}>{error}</p>}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              background: isLoading ? '#333' : '#FFCD02',
              color: '#000',
              border: 'none',
              padding: '13px 16px',
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              marginTop: 4,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'INGRESANDO…' : 'INICIAR SESIÓN →'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: '#5a5a60', textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
          Acceso exclusivo para personal de Almacén Central.
          <br />
          ¿Problemas para entrar? Contacta a sistemas.
        </p>
      </div>
    </div>
  );
}
