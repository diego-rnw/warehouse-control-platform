import type { CSSProperties } from 'react';
import type { MatchStatus, RequisicionEstatus } from './types';

type ChipKind = 'ok' | 'warn' | 'mut' | 'pur';

const chipBase: CSSProperties = {
  padding: '2px 8px',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  display: 'inline-block',
  whiteSpace: 'nowrap',
};

export function chip(kind: ChipKind): CSSProperties {
  return {
    ...chipBase,
    color: `var(--chip-${kind}-tx)`,
    background: `var(--chip-${kind}-bg)`,
    border: `1px solid var(--chip-${kind}-bd)`,
  };
}

export const STATUS_LABELS: Record<RequisicionEstatus, string> = {
  conciliada: 'CONCILIADA',
  con_ajuste: 'CON AJUSTE',
  con_diferencias: 'DIFERENCIAS',
  pendiente_captura: 'PENDIENTE CAPTURA',
};

export const STATUS_CHIP_KIND: Record<RequisicionEstatus, ChipKind> = {
  conciliada: 'ok',
  con_ajuste: 'warn',
  con_diferencias: 'warn',
  pendiente_captura: 'mut',
};

export function statusChipStyle(estatus: RequisicionEstatus): CSSProperties {
  return chip(STATUS_CHIP_KIND[estatus]);
}

export const MATCH_LABELS: Record<MatchStatus, string> = {
  ok: '✓ MATCH',
  diferencia: '⚠ DIFERENCIA',
  no_encontrado: '? NO EN FOODBOT',
  ajustado: '✓ AJUSTADO',
};

export const MATCH_CHIP_KIND: Record<MatchStatus, ChipKind> = {
  ok: 'ok',
  diferencia: 'warn',
  no_encontrado: 'pur',
  ajustado: 'ok',
};

export function matchChipStyle(status: MatchStatus): CSSProperties {
  return chip(MATCH_CHIP_KIND[status]);
}

export const ORIGEN_CHIP_ALMACEN: CSSProperties = {
  ...chipBase,
  color: 'var(--org-alm-tx)',
  background: 'var(--org-alm-bg)',
  border: '1px solid var(--org-alm-bd)',
};

export const ORIGEN_CHIP_COCINA: CSSProperties = {
  ...chipBase,
  color: 'var(--org-coc-tx)',
  background: 'var(--org-coc-bg)',
  border: '1px solid var(--org-coc-bd)',
};

export function origenChipStyle(origen: 'almacen' | 'cocina'): CSSProperties {
  return origen === 'almacen' ? ORIGEN_CHIP_ALMACEN : ORIGEN_CHIP_COCINA;
}

export function origenLabel(origen: 'almacen' | 'cocina'): string {
  return origen === 'almacen' ? 'ALMACÉN' : 'COCINA';
}

export type StatusFilter = 'all' | 'conciliada' | 'con_ajuste_diferencias' | 'pendiente_captura';

export const STATUS_FILTER_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  conciliada: 'CONCILIADAS SIN AJUSTE',
  con_ajuste_diferencias: 'CON AJUSTE / DIFERENCIAS',
  pendiente_captura: 'PENDIENTE CAPTURA',
};

export function matchesStatusFilter(estatus: RequisicionEstatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'con_ajuste_diferencias') return estatus === 'con_ajuste' || estatus === 'con_diferencias';
  return estatus === filter;
}
