export type Unidad = 'pza' | 'kg' | 'lt';
export type Origen = 'almacen' | 'cocina';
export type MatchStatus = 'ok' | 'diferencia' | 'no_encontrado' | 'ajustado' | 'no_entregado';
export type RequisicionEstatus = 'pendiente_captura' | 'conciliada' | 'con_ajuste' | 'con_diferencias';
export type CaptureEstatus =
  | 'esperando_fotos'
  | 'fotos_recibidas'
  | 'procesando'
  | 'listo_para_revision'
  | 'completada'
  | 'expirada';

// SUPABASE: fila de la vista v_dashboard
export interface DashboardRow {
  id: string;
  folio: string;
  sucursal: string;
  fecha: string; // YYYY-MM-DD
  total_renglones: number;
  importe_total: number;
  total_ajustes: number;
  estatus: RequisicionEstatus;
}

// SUPABASE: fila de la vista v_conciliacion
export interface ConciliacionRow {
  renglon_id: string;
  requisicion_id: string;
  folio: string;
  sucursal: string;
  fecha: string;
  producto: string;
  cantidad_reparto: number;
  cantidad_foodbot: number | null;
  costo: number;
  unidad: Unidad;
  origen: Origen;
  entregado: boolean;
  repartidor: string | null;
  confianza_ocr: number | null;
  match_status: MatchStatus;
  cantidad_ajustada: number | null;
  motivo_ajuste: string | null;
  usuario_ajuste: string | null;
  fecha_ajuste: string | null;
}

// SUPABASE: tabla renglones_foodbot
export interface RenglonFoodbot {
  id: string;
  requisicion_id: string;
  producto: string;
  cantidad: number;
  costo: number;
  cargado_en: string;
}

// SUPABASE: tabla ajustes
export interface Ajuste {
  id: string;
  renglon_id: string;
  cantidad_anterior: number;
  cantidad_nueva: number;
  motivo: string;
  usuario: string;
  creado_en: string;
}

// SUPABASE: tabla sucursales
export interface Sucursal {
  id: string;
  nombre: string;
  activa: boolean;
}

// SUPABASE: tabla personal_reparto
export interface PersonalReparto {
  id: string;
  nombre: string;
  activo: boolean;
}

// SUPABASE: tabla capture_sessions
export interface CaptureSession {
  id: string;
  requisicion_id: string;
  estatus: CaptureEstatus;
  expira_en: string;
  creado_en: string;
  extraccion: { renglones: RenglonExtraido[]; total?: number } | null;
  error_mensaje: string | null;
}

export interface RenglonExtraido {
  producto: string;
  cantidad: number;
  unidad: Unidad;
  costo: number;
  origen: Origen;
  entregado: boolean;
  confianza: number | null;
}

// Fila editable en la pantalla de revisión (antes de guardar en renglones_reparto)
export interface ReviewRow {
  id: string;
  producto: string;
  cantidad: string;
  unidad: Unidad;
  costo: string;
  origen: Origen;
  entregado: boolean;
  repartidor: string;
  confianza: number | null;
}
