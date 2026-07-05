export function formatMoney(value: number): string {
  return '$' + value.toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

export function formatCantidad(value: number, unidad?: string): string {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + (unidad ? ' ' + unidad : '');
}

export function formatPct(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—';
  return Math.round((numerator / denominator) * 100) + '%';
}

export function formatDelta(delta: number, deltaPct: number): string {
  const sign = delta >= 0 ? '+' : '';
  const pctSign = deltaPct >= 0 ? '+' : '';
  return sign + delta.toLocaleString('es-MX', { maximumFractionDigits: 0 }) + ' (' + pctSign + deltaPct + '%)';
}

export function formatConfianza(conf: number | null): string {
  if (conf === null) return '—';
  const pct = Math.round(conf * 100);
  return pct + (conf < 0.87 ? '% ⚠' : '%');
}

export function confianzaColor(conf: number | null): string {
  if (conf === null) return 'var(--t8)';
  if (conf >= 0.92) return '#0e8f72';
  if (conf >= 0.87) return '#b58900';
  return '#E84926';
}

export function confianzaRowBg(conf: number | null): string {
  if (conf === null) return 'transparent';
  if (conf < 0.82) return 'var(--row-lowc)';
  if (conf < 0.9) return 'var(--row-medc)';
  return 'transparent';
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function monthKey(fecha: string): string {
  return fecha.slice(0, 7); // 'YYYY-MM'
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return MONTH_NAMES[parseInt(m, 10) - 1] + ' ' + y;
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + ':' + secs.toString().padStart(2, '0');
}

export function formatSavedAt(date: Date = new Date()): string {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
