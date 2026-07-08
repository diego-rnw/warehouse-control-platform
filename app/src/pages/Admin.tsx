import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';
import type { PersonalReparto, Sucursal } from '../lib/types';

// ================================================================
// Panel de superadmin — estructura homogénea con la plataforma RRHH:
// sidebar de secciones a la izquierda, contenido con título grande,
// formulario de alta con borde amarillo y tabla de registros.
// ================================================================

type SectionId = 'usuarios' | 'sucursales' | 'personal' | 'api';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'usuarios', label: 'USUARIOS' },
  { id: 'sucursales', label: 'SUCURSALES' },
  { id: 'personal', label: 'PERSONAL DE REPARTO' },
  { id: 'api', label: 'CONSUMO API' },
];

interface AdminUser {
  id: string;
  email: string;
  nombre: string;
  role: string;
  banned: boolean;
  pendiente: boolean;
  lastSignIn: string | null;
  createdAt: string;
}

interface UsageRow {
  modelo: string;
  tokens_input: number;
  tokens_output: number;
  tokens_think: number;
  creado_en: string;
}

// Precios por millón de tokens (USD). Thinking se cobra como output.
const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
};

function estimateCost(rows: UsageRow[]): number {
  return rows.reduce((sum, r) => {
    const p = PRICING[r.modelo] ?? PRICING['gemini-2.5-flash'];
    return sum + (r.tokens_input / 1e6) * p.input + ((r.tokens_output + r.tokens_think) / 1e6) * p.output;
  }, 0);
}

// ===== estilos compartidos =====
const th: CSSProperties = { textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 800, color: '#E84926', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--divider-2)' };
const td: CSSProperties = { padding: '12px 16px', fontSize: 13, color: 'var(--t3)', borderBottom: '1px solid var(--border)' };
const inputStyle: CSSProperties = { background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '10px 14px', fontSize: 13 };
const labelStyle: CSSProperties = { fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5, display: 'block' };
const primaryBtn: CSSProperties = { background: '#FFCD02', color: '#000', border: 'none', padding: '11px 22px', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', whiteSpace: 'nowrap' };

function chipEstado(activo: boolean): CSSProperties {
  return {
    background: activo ? 'var(--chip-ok-bg)' : '#2a0f00',
    color: activo ? 'var(--chip-ok-tx)' : '#E84926',
    border: `1px solid ${activo ? 'var(--chip-ok-bd)' : '#E84926'}`,
    padding: '3px 10px',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    display: 'inline-block',
  };
}

function FormBox({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid #FFCD02', padding: '22px 26px', marginBottom: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--t1)', textTransform: 'uppercase', marginBottom: subtitle ? 6 : 16 }}>{title}</p>
      {subtitle && <p style={{ fontSize: 12, color: 'var(--t7)', marginBottom: 16, lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

export default function Admin() {
  const { session } = useAuth();
  const [section, setSection] = useState<SectionId>('usuarios');

  // ===== Usuarios =====
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'almacen' | 'superadmin'>('almacen');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const loadUsers = useCallback(async () => {
    setUsersError('');
    const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } });
    if (error || data?.error) {
      setUsersError(data?.error || error?.message || 'No se pudieron cargar los usuarios.');
      return;
    }
    setUsers(data.users);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function inviteUser() {
    setCreateMsg('');
    setUsersError('');
    if (!newNombre.trim() || !newEmail.trim()) {
      setUsersError('Nombre y correo son obligatorios.');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'invite',
          nombre: newNombre.trim(),
          email: newEmail.trim(),
          role: newRole,
          redirectTo: window.location.origin + '/activar-cuenta',
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setCreateMsg(`Invitación enviada a ${newEmail.trim()}.`);
      setNewNombre('');
      setNewEmail('');
      setNewRole('almacen');
      await loadUsers();
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'No se pudo enviar la invitación.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleBan(u: AdminUser) {
    const verb = u.banned ? 'reactivar' : 'desactivar';
    if (!window.confirm(`¿Seguro que quieres ${verb} a ${u.email}?`)) return;
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'toggle_ban', userId: u.id, ban: !u.banned },
    });
    if (error || data?.error) {
      setUsersError(data?.error || error?.message || 'No se pudo actualizar el usuario.');
      return;
    }
    await loadUsers();
  }

  // ===== Sucursales =====
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucError, setSucError] = useState('');
  const [newSucursal, setNewSucursal] = useState('');

  const loadSucursales = useCallback(async () => {
    const { data } = await supabase.from('sucursales').select('id, nombre, activa').order('nombre');
    if (data) setSucursales(data as Sucursal[]);
  }, []);

  useEffect(() => {
    loadSucursales();
  }, [loadSucursales]);

  async function addSucursal() {
    setSucError('');
    const nombre = newSucursal.trim();
    if (!nombre) return;
    const { error } = await supabase.from('sucursales').insert({ nombre });
    if (error) {
      setSucError(error.code === '23505' ? 'Esa sucursal ya existe.' : error.message);
      return;
    }
    setNewSucursal('');
    await loadSucursales();
  }

  async function toggleSucursal(s: Sucursal) {
    const { error } = await supabase.from('sucursales').update({ activa: !s.activa }).eq('id', s.id);
    if (error) {
      setSucError(error.message);
      return;
    }
    await loadSucursales();
  }

  // ===== Personal de reparto =====
  const [personal, setPersonal] = useState<PersonalReparto[]>([]);
  const [perError, setPerError] = useState('');
  const [newPersona, setNewPersona] = useState('');

  const loadPersonal = useCallback(async () => {
    const { data } = await supabase.from('personal_reparto').select('id, nombre, activo').order('nombre');
    if (data) setPersonal(data as PersonalReparto[]);
  }, []);

  useEffect(() => {
    loadPersonal();
  }, [loadPersonal]);

  async function addPersona() {
    setPerError('');
    const nombre = newPersona.trim();
    if (!nombre) return;
    const { error } = await supabase.from('personal_reparto').insert({ nombre });
    if (error) {
      setPerError(error.code === '23505' ? 'Esa persona ya está registrada.' : error.message);
      return;
    }
    setNewPersona('');
    await loadPersonal();
  }

  async function togglePersona(p: PersonalReparto) {
    const { error } = await supabase.from('personal_reparto').update({ activo: !p.activo }).eq('id', p.id);
    if (error) {
      setPerError(error.message);
      return;
    }
    await loadPersonal();
  }

  // ===== Consumo API =====
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [budget, setBudget] = useState('');
  const [budgetSaved, setBudgetSaved] = useState('');

  useEffect(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    supabase
      .from('api_usage_log')
      .select('modelo, tokens_input, tokens_output, tokens_think, creado_en')
      .gte('creado_en', monthStart.toISOString())
      .then(({ data }) => {
        if (data) setUsage(data as UsageRow[]);
      });
    supabase
      .from('app_config')
      .select('valor')
      .eq('clave', 'presupuesto_api_mensual_usd')
      .single()
      .then(({ data }) => {
        if (data) setBudget(data.valor);
      });
  }, []);

  async function saveBudget() {
    setBudgetSaved('');
    const { error } = await supabase
      .from('app_config')
      .update({ valor: budget, actualizado_en: new Date().toISOString() })
      .eq('clave', 'presupuesto_api_mensual_usd');
    setBudgetSaved(error ? 'Error al guardar.' : 'Guardado.');
  }

  const stats = useMemo(() => {
    const calls = usage.length;
    const tokensIn = usage.reduce((s, r) => s + r.tokens_input, 0);
    const tokensOut = usage.reduce((s, r) => s + r.tokens_output + r.tokens_think, 0);
    const cost = estimateCost(usage);
    const budgetNum = parseFloat(budget) || 0;
    const pct = budgetNum > 0 ? Math.min(100, (cost / budgetNum) * 100) : 0;
    return { calls, tokensIn, tokensOut, cost, budgetNum, pct };
  }, [usage, budget]);

  if (!session) return null;

  const SECTION_META: Record<SectionId, { title: string; desc: string }> = {
    usuarios: { title: 'USUARIOS', desc: 'Administra los usuarios con acceso al sistema de Control de Almacén.' },
    sucursales: { title: 'SUCURSALES', desc: 'Catálogo de sucursales Rock n\u2019 Wok — destino de las requisiciones.' },
    personal: { title: 'PERSONAL DE REPARTO', desc: 'Personas que entregan los productos. Se asignan por renglón al capturar una entrega.' },
    api: { title: 'CONSUMO API', desc: 'Uso de la API de Gemini (OCR de entregas) y presupuesto mensual.' },
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ marginBottom: 26 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--t5)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>SUPERADMINISTRADOR</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Administración</h1>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ===== SIDEBAR ===== */}
        <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                style={{
                  background: active ? '#FFCD02' : 'var(--surface)',
                  color: active ? '#000' : 'var(--t3)',
                  border: active ? '1px solid #FFCD02' : '1px solid var(--border)',
                  padding: '14px 18px',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </aside>

        {/* ===== CONTENIDO ===== */}
        <main style={{ flex: 1, minWidth: 480 }}>
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)', letterSpacing: '0.02em', textTransform: 'uppercase', marginBottom: 6 }}>
              {SECTION_META[section].title}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--t7)', lineHeight: 1.5 }}>{SECTION_META[section].desc}</p>
          </div>

          {/* ---------- USUARIOS ---------- */}
          {section === 'usuarios' && (
            <>
              <FormBox title="REGISTRAR NUEVO USUARIO" subtitle="Se enviará una invitación por correo para que el usuario cree su propia contraseña.">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input type="text" value={newNombre} onChange={(e) => setNewNombre(e.target.value)} placeholder="Ej. Sofía Martínez" style={{ ...inputStyle, width: 200 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Correo</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nombre@rockandwok.com" style={{ ...inputStyle, width: 230 }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Rol</label>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'almacen' | 'superadmin')} style={{ ...inputStyle, cursor: 'pointer', height: 41 }}>
                      <option value="almacen">Almacén</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <button onClick={inviteUser} disabled={creating} style={{ ...primaryBtn, opacity: creating ? 0.7 : 1, cursor: creating ? 'not-allowed' : 'pointer' }}>
                    {creating ? 'ENVIANDO…' : 'INVITAR USUARIO'}
                  </button>
                </div>
                {usersError && <p style={{ fontSize: 12, color: '#E84926', fontWeight: 600, marginTop: 12 }}>{usersError}</p>}
                {createMsg && <p style={{ fontSize: 12, color: 'var(--chip-ok-tx)', fontWeight: 600, marginTop: 12 }}>{createMsg}</p>}
              </FormBox>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th style={th}>Nombre</th>
                      <th style={th}>Correo</th>
                      <th style={th}>Rol</th>
                      <th style={th}>Estado</th>
                      <th style={th}>Último acceso</th>
                      <th style={{ ...th, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--t1)' }}>{u.nombre || '—'}</td>
                        <td style={td}>{u.email}</td>
                        <td style={td}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: u.role === 'superadmin' ? '#E84926' : 'var(--t6)' }}>
                            {u.role === 'superadmin' ? 'SUPERADMIN' : 'ALMACÉN'}
                          </span>
                        </td>
                        <td style={td}>
                          {u.banned ? (
                            <span style={chipEstado(false)}>DESACTIVADO</span>
                          ) : u.pendiente ? (
                            <span style={{ background: '#1e1400', color: '#FFCD02', border: '1px solid #b58900', padding: '3px 10px', fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'inline-block' }}>INVITADO</span>
                          ) : (
                            <span style={chipEstado(true)}>ACTIVO</span>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--t7)' }}>
                          {u.lastSignIn ? new Date(u.lastSignIn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {u.id === session.user.id ? (
                            <span style={{ fontSize: 10, color: 'var(--t8)', fontWeight: 700, letterSpacing: '0.08em' }}>TÚ</span>
                          ) : (
                            <button
                              onClick={() => toggleBan(u)}
                              style={{ background: 'transparent', border: '1px solid var(--border-in)', color: u.banned ? 'var(--chip-ok-tx)' : '#E84926', padding: '5px 14px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                              {u.banned ? 'REACTIVAR' : 'DESACTIVAR'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---------- SUCURSALES ---------- */}
          {section === 'sucursales' && (
            <>
              <FormBox title="AGREGAR SUCURSAL">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input type="text" value={newSucursal} onChange={(e) => setNewSucursal(e.target.value)} placeholder="Ej: Solesta" style={{ ...inputStyle, width: 260 }} onKeyDown={(e) => e.key === 'Enter' && addSucursal()} />
                  </div>
                  <button onClick={addSucursal} style={primaryBtn}>AGREGAR</button>
                </div>
                {sucError && <p style={{ fontSize: 12, color: '#E84926', fontWeight: 600, marginTop: 12 }}>{sucError}</p>}
              </FormBox>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={th}>Nombre</th>
                      <th style={th}>Estado</th>
                      <th style={{ ...th, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sucursales.map((s) => (
                      <tr key={s.id}>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--t1)' }}>{s.nombre}</td>
                        <td style={td}>
                          <span style={chipEstado(s.activa)}>{s.activa ? 'ACTIVA' : 'INACTIVA'}</span>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button
                            onClick={() => toggleSucursal(s)}
                            style={{ background: 'transparent', border: '1px solid var(--border-in)', color: s.activa ? '#E84926' : 'var(--chip-ok-tx)', padding: '5px 14px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
                          >
                            {s.activa ? 'DESACTIVAR' : 'REACTIVAR'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---------- PERSONAL DE REPARTO ---------- */}
          {section === 'personal' && (
            <>
              <FormBox title="REGISTRAR PERSONA" subtitle="También se pueden dar de alta desde el dropdown de la pantalla de captura.">
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <label style={labelStyle}>Nombre completo</label>
                    <input type="text" value={newPersona} onChange={(e) => setNewPersona(e.target.value)} placeholder="Ej: Juan Pérez" style={{ ...inputStyle, width: 260 }} onKeyDown={(e) => e.key === 'Enter' && addPersona()} />
                  </div>
                  <button onClick={addPersona} style={primaryBtn}>REGISTRAR</button>
                </div>
                {perError && <p style={{ fontSize: 12, color: '#E84926', fontWeight: 600, marginTop: 12 }}>{perError}</p>}
              </FormBox>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={th}>Nombre</th>
                      <th style={th}>Estado</th>
                      <th style={{ ...th, textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personal.map((p) => (
                      <tr key={p.id}>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--t1)' }}>{p.nombre}</td>
                        <td style={td}>
                          <span style={chipEstado(p.activo)}>{p.activo ? 'ACTIVO' : 'INACTIVO'}</span>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button
                            onClick={() => togglePersona(p)}
                            style={{ background: 'transparent', border: '1px solid var(--border-in)', color: p.activo ? '#E84926' : 'var(--chip-ok-tx)', padding: '5px 14px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
                          >
                            {p.activo ? 'DESACTIVAR' : 'REACTIVAR'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {personal.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ ...td, textAlign: 'center', color: 'var(--t7)' }}>Aún no hay personal registrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ---------- CONSUMO API ---------- */}
          {section === 'api' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'Llamadas del mes', value: String(stats.calls) },
                  { label: 'Tokens entrada', value: stats.tokensIn.toLocaleString('es-MX') },
                  { label: 'Tokens salida (+think)', value: stats.tokensOut.toLocaleString('es-MX') },
                  { label: 'Costo estimado (USD)', value: formatMoney(stats.cost), highlight: true },
                ].map((c) => (
                  <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: c.highlight ? '2px solid #FFCD02' : '1px solid var(--border)', padding: '18px 20px' }}>
                    <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{c.label}</p>
                    <p style={{ fontSize: 26, fontWeight: 900, color: c.highlight ? '#FFCD02' : 'var(--t1)', lineHeight: 1 }}>{c.value}</p>
                  </div>
                ))}
              </div>

              <FormBox title="PRESUPUESTO MENSUAL" subtitle="Google no expone el saldo de la cuenta por API — el costo se estima con los tokens que Gemini reporta en cada llamada y las tarifas publicadas del modelo.">
                {stats.budgetNum > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--t6)', fontWeight: 700 }}>
                        {formatMoney(stats.cost)} de {formatMoney(stats.budgetNum)} presupuestados
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: stats.pct > 80 ? '#E84926' : 'var(--t6)' }}>{Math.round(stats.pct)}%</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--well)', border: '1px solid var(--border-in)' }}>
                      <div style={{ height: '100%', width: `${stats.pct}%`, background: stats.pct > 80 ? '#E84926' : '#FFCD02' }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <label style={labelStyle}>Presupuesto (USD)</label>
                    <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ ...inputStyle, width: 130 }} />
                  </div>
                  <button onClick={saveBudget} style={primaryBtn}>GUARDAR</button>
                  {budgetSaved && <span style={{ fontSize: 12, color: budgetSaved === 'Guardado.' ? 'var(--chip-ok-tx)' : '#E84926', fontWeight: 700, paddingBottom: 12 }}>{budgetSaved}</span>}
                </div>
              </FormBox>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
