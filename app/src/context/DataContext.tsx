import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Ajuste, ConciliacionRow, DashboardRow, RenglonFoodbot } from '../lib/types';
import { useAuth } from './AuthContext';

interface DataCtx {
  dashboardRows: DashboardRow[];
  conciliacionRows: ConciliacionRow[];
  renglonesFoodbot: RenglonFoodbot[];
  ajustes: Ajuste[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        // SUPABASE: SELECT * FROM v_dashboard — una fila por requisición con
        // estatus siempre derivado e importe/ajustes agregados.
        { data: dash, error: dashErr },
        // SUPABASE: SELECT * FROM v_conciliacion — una fila por renglón de reparto con su match.
        { data: conc, error: concErr },
        // SUPABASE: SELECT * FROM renglones_foodbot — lo esperado según Foodbot (Fase 1).
        { data: fb, error: fbErr },
        // SUPABASE: SELECT * FROM ajustes ORDER BY creado_en — historial completo por renglón.
        { data: adj, error: adjErr },
      ] = await Promise.all([
        supabase.from('v_dashboard').select('*').order('fecha', { ascending: false }),
        supabase.from('v_conciliacion').select('*'),
        supabase.from('renglones_foodbot').select('*'),
        supabase.from('ajustes').select('*').order('creado_en', { ascending: true }),
      ]);
      if (dashErr) throw dashErr;
      if (concErr) throw concErr;
      if (fbErr) throw fbErr;
      if (adjErr) throw adjErr;
      setDashboardRows(dash ?? []);
      setConciliacionRows(conc ?? []);
      setRenglonesFoodbot(fb ?? []);
      setAjustes(adj ?? []);
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
    <DataContext.Provider value={{ dashboardRows, conciliacionRows, renglonesFoodbot, ajustes, isLoading, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider');
  return ctx;
}
