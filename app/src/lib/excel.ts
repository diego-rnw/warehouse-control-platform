import * as XLSX from 'xlsx';

export const MAX_EXCEL_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_EXT = /\.(xlsx|xls|csv)$/i;

export interface ParsedFoodbotExcel {
  folio: string;
  sucursal: string;
  fecha: string; // ISO date 'YYYY-MM-DD'
  importe_total: number; // Total precalculado del footer del Excel (con IVA)
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

// Convierte valores numéricos de Foodbot a number de forma robusta.
// Formato del documento: coma = separador de millares, punto = decimal.
// La celda puede incluir la unidad de presentación después del primer número
// (ej: "5.000 G3.785" o "2.000 pz") — solo interesa el PRIMER número.
//   "1,500.000" → 1500  |  "2.000" → 2  |  "5.000 G3.785" → 5  |  1500 → 1500
function parseFoodbotNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return NaN;
  // Captura el primer número al inicio (con comas de millares y decimal opcional)
  // y descarta todo lo que siga (espacio, letras, presentación).
  const match = raw.trim().match(/^-?[\d,]+(?:\.\d+)?/);
  if (!match) return NaN;
  return Number(match[0].replace(/,/g, ''));
}

function parseFoodbotDate(raw: string): string {
  // Input: "Jul 2, 2026, 8:25 AM" → output: "2026-07-02"
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
}

// Lee el export de Foodbot tal como viene: metadata en las primeras filas,
// luego fila de encabezados ("Producto", "Precio enviado", etc.) y renglones.
export async function parseFoodbotExcel(file: File): Promise<ParsedFoodbotExcel> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  // Extraer metadatos del bloque de cabecera (primeras ~10 filas)
  let folio = '';
  let sucursal = '';
  let fechaStr = '';
  let headerRowIndex = -1;

  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const row = raw[i] as string[];
    const key = String(row[0] ?? '').trim();
    const val = String(row[1] ?? '').trim();

    if (key === 'Número de Orden de compra') folio = val;
    else if (key === 'Almacén') sucursal = val;
    else if (key === 'Fecha de PO') fechaStr = val;
    else if (key === 'Producto') {
      headerRowIndex = i;
      break;
    }
  }

  if (!folio) throw new Error('No se encontró el Número de Orden de compra. Verifica que sea un export de Foodbot.');
  if (!sucursal) throw new Error('No se encontró la sucursal (Almacén) en el archivo.');
  if (headerRowIndex === -1) throw new Error('No se encontró la tabla de productos — verifica que sea un export de Foodbot.');

  // Detectar columnas por nombre en la fila de encabezados
  const headers = (raw[headerRowIndex] as string[]).map((h) => String(h).trim());
  const colProducto = headers.indexOf('Producto');
  // Cantidad SOLICITADA: lo que se pidió en Foodbot — es la base de la conciliación
  // contra la "Cantidad enviada" que se extrae de las fotos del documento físico.
  // La celda puede traer la presentación después de un espacio: "5.000 G3.785"
  // → solo interesa el primer número ("5.000" = 5).
  const colCantidad = headers.indexOf('Cantidad solicitada');
  const colPrecio = headers.indexOf('Precio enviado'); // precio unitario

  if (colProducto === -1 || colCantidad === -1 || colPrecio === -1) {
    throw new Error('El archivo no tiene las columnas esperadas: Producto, Cantidad solicitada, Precio enviado.');
  }

  // Leer renglones de producto y buscar el total del footer
  const rows: { producto: string; cantidad: number; costo: number }[] = [];
  let importe_total = 0;

  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const firstCell = String(row[0] ?? '').trim();

    // Footer: fila "Total" al pie del documento (total con IVA precalculado por Foodbot)
    if (firstCell === 'Total') {
      importe_total = parseFoodbotNumber(row[1]) || 0;
      continue;
    }

    // Saltar filas de resumen del footer (Monto del impuesto, Importe, etc.)
    if (!firstCell || firstCell === 'Monto del impuesto' || firstCell === 'Monto del descuento' || firstCell === 'Importe') continue;

    const cantidad = parseFoodbotNumber(row[colCantidad]);
    const costo = parseFoodbotNumber(row[colPrecio]);
    if (!Number.isFinite(cantidad) || !Number.isFinite(costo)) continue;
    if (cantidad === 0 && costo === 0) continue;
    rows.push({ producto: firstCell, cantidad, costo });
  }

  if (rows.length === 0) {
    throw new Error('El archivo no tiene renglones válidos con Producto, Cantidad enviada y Precio enviado.');
  }

  return { folio, sucursal, fecha: parseFoodbotDate(fechaStr), importe_total, rows };
}
