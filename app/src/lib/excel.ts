import * as XLSX from 'xlsx';

export const MAX_EXCEL_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_EXT = /\.(xlsx|xls|csv)$/i;

export interface ParsedFoodbotExcel {
  folio: string;
  rows: { producto: string; cantidad: number; costo: number }[];
}

export function validateExcelFile(file: File): string | null {
  if (!VALID_EXT.test(file.name)) {
    return 'Formato no soportado. Sube un archivo .xlsx, .xls o .csv exportado por Foodbot.';
  }
  if (file.size > MAX_EXCEL_SIZE) {
    return 'El archivo pesa más de 10 MB — no parece un export válido de Foodbot.';
  }
  return null;
}

// SUPABASE: parseo en cliente con SheetJS antes de INSERT requisiciones / renglones_foodbot.
// Ajustar los nombres de columna reales de Foodbot aquí si difieren.
export async function parseFoodbotExcel(file: File): Promise<ParsedFoodbotExcel> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const rows = raw
    .map((r) => ({
      folio: String(r['Folio'] ?? r['folio'] ?? '').trim(),
      producto: String(r['Producto'] ?? r['producto'] ?? '').trim(),
      cantidad: Number(r['Cantidad'] ?? r['cantidad']),
      costo: Number(r['Costo Unitario'] ?? r['costo'] ?? r['Costo']),
    }))
    .filter((r) => r.producto && Number.isFinite(r.cantidad) && Number.isFinite(r.costo));

  if (rows.length === 0) {
    throw new Error('El archivo no tiene renglones válidos (se esperan columnas Folio, Producto, Cantidad, Costo).');
  }

  const folio = rows.find((r) => r.folio)?.folio || `REQ-${Date.now()}`;

  return { folio, rows: rows.map(({ producto, cantidad, costo }) => ({ producto, cantidad, costo })) };
}
