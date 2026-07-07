import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Ajuste, ConciliacionRow, DashboardRow, RenglonFoodbot, Sucursal } from '../lib/types';
import { useAuth } from './AuthContext';

interface DataCtx {
  dashboardRows: DashboardRow[];
  conciliacionRows: ConciliacionRow[];
  renglonesFoodbot: RenglonFoodbot[];
  ajustes: Ajuste[];
  sucursales: Sucursal[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const DataContext = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [dashboardRows, setDashboardRows] = useState<DashboardRow[]>([]);
  const [conciliacionRows, setConciliacionRows] = useState<ConciliacionRow[]>([]);
  const [renglonesFoodbot, setRenglonesFoodbot] = useState<RenglonFoodbot[]>([]);
  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        { data: dash, error: dashErr },
        { data: conc, error: concErr },
        { data: fb, error: fbErr },
        { data: adj, error: adjErr },
        { data: suc, error: sucErr },
      ] = await Promise.all([
        supabase.from('v_dashboard').select('*').order('fecha', { ascending: false }),
        supabase.from('v_conciliacion').select('*'),
        supabase.from('renglones_foodbot').select('*'),
        supabase.from('ajustes').select('*').order('creado_en', { ascending: true }),
        supabase.from('sucursales').select('id, nombre, activa').eq('activa', true).order('nombre'),
      ]);
      if (dashErr) throw dashErr;
      if (concErr) throw concErr;
      if (fbErr) throw fbErr;
      if (adjErr) throw adjErr;
      if (sucErr) throw sucErr;
      setDashboardRows(dash ?? []);
      setConciliacionRows(conc ?? []);
      setRenglonesFoodbot(fb ?? []);
      setAjustes(adj ?? []);
      setSucursales(suc ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las requisiciones.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  return (
    <DataContext.Provider value={{ dashboardRows, conciliacionRows, renglonesFoodbot, ajustes, sucursales, isLoading, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
