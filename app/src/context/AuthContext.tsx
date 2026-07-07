import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthCtx {
  session: Session | null;
  isLoading: boolean;
  userLabel: string;
  isSuperadmin: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthCtx | null>(null);

// Copy de errores de Supabase Auth mapeada a español — un solo rol
// "almacen" en v1 (incluye Superadmin, sin distinción de permisos).
function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de iniciar sesión.';
  return 'No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: mapAuthError(error.message) };
    setSession(data.session);
    return { error: null };
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  const userLabel = session?.user?.email || 'Almacén Central';
  const isSuperadmin = session?.user?.app_metadata?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ session, isLoading, userLabel, isSuperadmin, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
