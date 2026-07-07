import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/format';

interface AdminUser {
  id: string;
  email: string;
  role: string;
  banned: boolean;
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

// Precios por millón de tokens (USD) — actualizar si Google cambia tarifas.
// Los tokens de thinking se cobran como output.
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

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t8)', letterSpacing: '0.12em', textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '10px 14px', fontSize: 12, color: 'var(--t3)' };
const input: React.CSSProperties = { background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t1)', padding: '8px 12px', fontSize: 12 };
const sectionTitle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t5)', textTransform: 'uppercase', marginBottom: 12 };

export default function Admin() {
  const { session } = useAuth();

  // ===== Usuarios =====
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  async function createUser() {
    setCreateMsg('');
    setUsersError('');
    if (!newEmail.trim() || !newPassword) {
      setUsersError('Email y contraseña son obligatorios.');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'create', email: newEmail.trim(), password: newPassword, role: newRole },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setCreateMsg(`Usuario ${newEmail.trim()} creado.`);
      setNewEmail('');
      setNewPassword('');
      setNewRole('almacen');
      await loadUsers();
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'No se pudo crear el usuario.');
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

  // ===== Uso de API =====
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

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--t5)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>SUPERADMIN</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Administración</h1>
      </div>

      {/* ===== USO DE API ===== */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '2px solid #FFCD02', padding: '20px 24px', marginBottom: 24 }}>
        <p style={sectionTitle}>USO DE API GEMINI — MES ACTUAL</p>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Llamadas</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)' }}>{stats.calls}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Tokens entrada</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)' }}>{stats.tokensIn.toLocaleString('es-MX')}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Tokens salida (+think)</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--t1)' }}>{stats.tokensOut.toLocaleString('es-MX')}</p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Costo estimado (USD)</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#FFCD02' }}>{formatMoney(stats.cost)}</p>
          </div>
        </div>

        {stats.budgetNum > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--t6)', fontWeight: 700 }}>
                {formatMoney(stats.cost)} de {formatMoney(stats.budgetNum)} presupuestados
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: stats.pct > 80 ? '#E84926' : 'var(--t6)' }}>{Math.round(stats.pct)}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--well)', border: '1px solid var(--border-in)' }}>
              <div style={{ height: '100%', width: `${stats.pct}%`, background: stats.pct > 80 ? '#E84926' : '#FFCD02' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Presupuesto mensual (USD)</label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} style={{ ...input, width: 120 }} />
          </div>
          <button onClick={saveBudget} style={{ background: 'var(--well)', border: '1px solid var(--border-in)', color: 'var(--t2)', padding: '8px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase', height: 33 }}>
            GUARDAR
          </button>
          {budgetSaved && <span style={{ fontSize: 11, color: budgetSaved === 'Guardado.' ? 'var(--chip-ok-tx)' : '#E84926', fontWeight: 700 }}>{budgetSaved}</span>}
        </div>
        <p style={{ fontSize: 10, color: 'var(--t8)', marginTop: 12, lineHeight: 1.5 }}>
          Google no expone el saldo de la cuenta por API — el costo se estima con los tokens que Gemini reporta en cada llamada y las tarifas publicadas del modelo.
        </p>
      </div>

      {/* ===== USUARIOS ===== */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <p style={sectionTitle}>USUARIOS</p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap', marginBottom: 18, paddingBottom: 18, borderBottom: '1px dashed var(--border-in)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Correo</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="usuario@rockandwok.com" style={{ ...input, width: 220 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Contraseña (mín. 8)</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ ...input, width: 160 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 9, color: 'var(--t6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rol</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as 'almacen' | 'superadmin')} style={{ ...input, cursor: 'pointer' }}>
              <option value="almacen">Almacén</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </div>
          <button
            onClick={createUser}
            disabled={creating}
            style={{ background: '#FFCD02', color: '#000', border: 'none', padding: '9px 18px', fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', cursor: creating ? 'not-allowed' : 'pointer', textTransform: 'uppercase', height: 33, opacity: creating ? 0.7 : 1 }}
          >
            {creating ? 'CREANDO…' : '+ CREAR USUARIO'}
          </button>
        </div>

        {usersError && <p style={{ fontSize: 12, color: '#E84926', fontWeight: 600, marginBottom: 10 }}>{usersError}</p>}
        {createMsg && <p style={{ fontSize: 12, color: 'var(--chip-ok-tx)', fontWeight: 600, marginBottom: 10 }}>{createMsg}</p>}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--well)', borderBottom: '1px solid var(--divider-2)' }}>
              <th style={th}>Correo</th>
              <th style={th}>Rol</th>
              <th style={th}>Estado</th>
              <th style={th}>Último acceso</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600, color: 'var(--t2)' }}>{u.email}</td>
                <td style={td}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: u.role === 'superadmin' ? '#FFCD02' : 'var(--t6)' }}>
                    {u.role === 'superadmin' ? '★ SUPERADMIN' : 'ALMACÉN'}
                  </span>
                </td>
                <td style={td}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: u.banned ? '#E84926' : 'var(--chip-ok-tx)' }}>{u.banned ? 'DESACTIVADO' : 'ACTIVO'}</span>
                </td>
                <td style={{ ...td, fontSize: 11, color: 'var(--t7)' }}>
                  {u.lastSignIn ? new Date(u.lastSignIn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {u.id !== session.user.id && (
                    <button
                      onClick={() => toggleBan(u)}
                      style={{ background: 'transparent', border: '1px solid var(--border-in)', color: u.banned ? 'var(--chip-ok-tx)' : '#E84926', padding: '4px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', textTransform: 'uppercase' }}
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
    </div>
  );
}
