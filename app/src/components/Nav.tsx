import type { CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import logo from '../assets/brand/logo-rnw-white-on-black.png';

function navBtnStyle(isActive: boolean): CSSProperties {
  return {
    background: isActive ? 'var(--tab-active-bg, #1a1400)' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #FFCD02' : '2px solid transparent',
    color: isActive ? '#FFCD02' : '#b0b0b5',
    padding: '0 18px',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    textTransform: 'uppercase',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: '100%',
  };
}

export default function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { userLabel, logout, isSuperadmin } = useAuth();
  const { dashboardRows } = useData();

  const diffBadgeCount = dashboardRows.filter((r) => r.estatus === 'con_diferencias').length;
  const hasDiffBadge = diffBadgeCount > 0;

  return (
    <header
      style={{
        background: '#000',
        borderBottom: '2px solid #FFCD02',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'stretch',
        height: 52,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 32, flexShrink: 0 }}>
        <img src={logo} style={{ height: 22, width: 'auto' }} alt="RNW" />
        <span style={{ width: 1, height: 16, background: '#2a2a2a', display: 'block', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: '#FFCD02', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          Control de Almacén
        </span>
      </div>
      <nav style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        <button onClick={() => navigate('/dashboard')} style={navBtnStyle(location.pathname === '/dashboard')}>
          DASHBOARD
        </button>
        <button onClick={() => navigate('/requisiciones')} style={navBtnStyle(location.pathname === '/requisiciones')}>
          REQUISICIONES
          {hasDiffBadge && (
            <span
              style={{
                background: '#E84926',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                borderRadius: 999,
                minWidth: 16,
                height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              {diffBadgeCount}
            </span>
          )}
        </button>
        <button onClick={() => navigate('/comparativo')} style={navBtnStyle(location.pathname === '/comparativo')}>
          COMPARATIVO
        </button>
        {isSuperadmin && (
          <button onClick={() => navigate('/admin')} style={navBtnStyle(location.pathname === '/admin')}>
            ★ ADMIN
          </button>
        )}
      </nav>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button
          onClick={toggleTheme}
          title="Cambiar tema"
          style={{
            background: 'transparent',
            border: '1px solid #2a2a2a',
            color: '#b0b0b5',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>{theme === 'light' ? '☾' : '☀'}</span>
          {theme === 'light' ? 'OSCURO' : 'CLARO'}
        </button>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#29E7BC', flexShrink: 0 }} title="Conectado" />
        <span style={{ fontSize: 11, color: '#9a9aa0', fontWeight: 600, letterSpacing: '0.02em' }}>{userLabel}</span>
        <button
          onClick={logout}
          title="Cerrar sesión"
          style={{
            background: 'transparent',
            border: '1px solid #2a2a2a',
            color: '#b0b0b5',
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          SALIR
        </button>
      </div>
    </header>
  );
}
