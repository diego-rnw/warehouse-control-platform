// ================================================================
// Edge Function: procesar-vision
// ================================================================
// Se dispara cuando capture_sessions.estatus pasa a 'fotos_recibidas'
// (llamada por crear-sesion-upload). Descarga las fotos del bucket
// privado, llama a la API de Gemini (visión) pidiendo SOLO JSON, y
// actualiza capture_sessions con el resultado para que el desktop lo
// reciba vía Realtime.
//
// Requiere el secret GEMINI_API_KEY:
//   supabase secrets set GEMINI_API_KEY=tu-api-key
// Modelo configurable con GEMINI_MODEL (default: gemini-2.5-flash).
// ================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

function buildPrompt(productosEsperados: string[]): string {
  const lista = productosEsperados.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return `Extrae datos de UNA página de una hoja de requisición de insumos de restaurante.
Es posible que esta página no contenga todos los productos de la lista — extrae solo los que aparezcan resaltados EN ESTA imagen.

COLUMNAS A LEER (en ese orden de prioridad):
- Cantidad: columna "Cantidad enviada" (última columna de cantidad)
- Costo: columna "Precio enviado"
- Unidad: columna "Unidad base" (pz/kg/lt junto a la cantidad)

FORMATO DE NÚMEROS — LEE ESTO CON MÁXIMA ATENCIÓN:
Todos los números en el documento tienen el formato X.YYY (parte entera PUNTO tres decimales).
El punto (.) es SIEMPRE separador decimal. Nunca es separador de miles.
La parte entera X puede ser cualquier número: 1, 2, 6, 12, 50, 100, 200, 618...

Tabla de lectura obligatoria:
  "2.000"   → devuelve 2        ← dos unidades exactas
  "6.000"   → devuelve 6        ← seis unidades exactas
  "50.000"  → devuelve 50       ← cincuenta unidades exactas
  "100.000" → devuelve 100      ← cien unidades exactas
  "200.000" → devuelve 200      ← doscientas unidades exactas
  "0.500"   → devuelve 0.5      ← media unidad
  "12.500"  → devuelve 12.5     ← doce y medio
  "618.696" → devuelve 618.696  ← valor con decimales reales

NUNCA modifiques, dividas ni multipliques el número leído. Cópialo exactamente.

LISTA DE ${productosEsperados.length} PRODUCTOS ESPERADOS:
${lista}

INSTRUCCIONES — sigue este proceso en orden:
PASO 1: Extrae TODOS los renglones de producto visibles en esta página.
        No omitas ninguno. Cada fila de la tabla del documento es un renglón.
        (Ignora cualquier marcatexto/subrayado — no afecta la extracción.)
PASO 2: Para el nombre de cada producto: elige el más similar de la lista de arriba.
        Usa el nombre EXACTO de la lista.
PASO 3: Verifica que cada cantidad respete la regla del punto decimal antes de responder.
Si esta página muestra el TOTAL del documento al pie, inclúyelo (misma regla de punto decimal). Si no aparece, usa null.
Nota: solo omite un renglón si su cantidad es COMPLETAMENTE ilegible.

Devuelve SOLO este JSON (sin markdown, sin texto extra):
{
  "total": numero_o_null,
  "renglones": [
    {
      "producto": "nombre exacto de la lista",
      "cantidad": numero,
      "unidad": "pza"|"kg"|"lt",
      "costo": numero,
      "confianza": numero 0-1
    }
  ]
}`;
}

interface RenglonExtraido {
  producto: string;
  cantidad: number;
  unidad: 'pza' | 'kg' | 'lt';
  costo: number;
  confianza: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let sessionId: string | undefined;
  try {
    const body = await req.json();
    sessionId = body.sessionId;
    if (!sessionId) return json({ error: 'Falta sessionId.' }, 400);

    await admin.from('capture_sessions').update({ estatus: 'procesando' }).eq('id', sessionId);

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada (supabase secrets set GEMINI_API_KEY=...).');
    }

    // Obtiene la requisicion_id de la sesión para buscar los productos de Foodbot.
    const { data: session, error: sessErr } = await admin
      .from('capture_sessions')
      .select('requisicion_id')
      .eq('id', sessionId)
      .single();
    if (sessErr || !session) throw new Error('No se encontró la sesión.');

    // Lista de productos canónicos del Excel de Foodbot — se le pasa a Gemini
    // para que use esos nombres exactos en lugar de transcribir libremente.
    const { data: foodbotRows } = await admin
      .from('renglones_foodbot')
      .select('producto')
      .eq('requisicion_id', session.requisicion_id);
    const productosEsperados = (foodbotRows ?? []).map((r: { producto: string }) => r.producto);

    const { data: fotos, error: fotosErr } = await admin
      .from('fotos_requisicion')
      .select('*')
      .eq('session_id', sessionId)
      .eq('procesada', false);
    if (fotosErr) throw fotosErr;
    if (!fotos || fotos.length === 0) throw new Error('No hay fotos sin procesar para esta sesión.');

    const prompt = buildPrompt(productosEsperados);

    // Schema estricto: fuerza a Gemini a devolver tipos correctos (números como
    // NUMBER, enums cerrados). Reduce alucinaciones de formato.
    const responseSchema = {
      type: 'OBJECT',
      properties: {
        total: { type: 'NUMBER', nullable: true },
        renglones: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              producto: { type: 'STRING' },
              cantidad: { type: 'NUMBER' },
              unidad: { type: 'STRING', enum: ['pza', 'kg', 'lt'] },
              costo: { type: 'NUMBER' },
              confianza: { type: 'NUMBER' },
            },
            required: ['producto', 'cantidad', 'unidad'],
          },
        },
      },
      required: ['renglones'],
    };

    // Simplifica cantidades sin decimales significativos: 2.000 → 2, 618.696 → 618.696
    function simplificarCantidad(raw: number): number {
      return Math.abs(raw - Math.round(raw)) < 0.0005 ? Math.round(raw) : raw;
    }

    // UNA llamada a Gemini POR FOTO: menos contenido por llamada = mayor
    // precisión por renglón y mejor cobertura (evita truncamiento en docs largos).
    const todosRenglones: ReturnType<typeof normalizarRenglon>[] = [];
    let totalDocumento: number | null = null;

    function normalizarRenglon(r: RenglonExtraido) {
      return {
        producto: r.producto.trim(),
        cantidad: simplificarCantidad(Number(r.cantidad) || 0),
        unidad: (['pza', 'kg', 'lt'].includes(r.unidad) ? r.unidad : 'pza') as RenglonExtraido['unidad'],
        costo: simplificarCantidad(Number(r.costo) || 0),
        // marcatextos suspendido: origen/entregado se asignan en la revisión
        origen: 'almacen' as const,
        entregado: true,
        confianza: typeof r.confianza === 'number' ? r.confianza : null,
      };
    }

    for (const foto of fotos) {
      const { data: blob, error: dlErr } = await admin.storage.from('requisicion-fotos').download(foto.url_storage);
      if (dlErr || !blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const base64 = btoa(bytes.reduce((acc, b) => acc + String.fromCharCode(b), ''));
      const imagePart = { inlineData: { mimeType: blob.type || 'image/jpeg', data: base64 } };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [imagePart, { text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema,
              thinkingConfig: { thinkingBudget: 8192 },
              // Resolución alta: evita que Gemini comprima la imagen y pierda
              // detalle en tablas densas (números pequeños, renglones juntos).
              mediaResolution: 'MEDIA_RESOLUTION_HIGH',
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Gemini respondió ${response.status}: ${await response.text()}`);
      }
      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const parsed = JSON.parse(text) as { renglones: RenglonExtraido[]; total?: number | null };
      const renglonesPagina = (parsed.renglones || [])
        .filter((r) => r && typeof r.producto === 'string' && r.producto.trim())
        .map(normalizarRenglon);
      todosRenglones.push(...renglonesPagina);

      // El total suele estar solo en la última página — toma el primero no-nulo.
      if (totalDocumento === null && typeof parsed.total === 'number' && parsed.total > 0) {
        totalDocumento = parsed.total;
      }
    }

    const renglones = todosRenglones;
    if (renglones.length === 0) throw new Error('Gemini no extrajo ningún renglón resaltado de las fotos.');

    // Validación de cordura: si el total es más de 20× la suma calculada por renglones,
    // Gemini probablemente leyó mal el separador decimal — lo descartamos.
    const sumaCalculada = renglones.reduce((s, r) => s + r.cantidad * r.costo, 0);
    const total = totalDocumento !== null && (sumaCalculada === 0 || totalDocumento <= sumaCalculada * 20) ? totalDocumento : null;

    await admin
      .from('capture_sessions')
      .update({ estatus: 'listo_para_revision', extraccion: { renglones, ...(total !== null && { total }) }, error_mensaje: null })
      .eq('id', sessionId);
    await admin.from('fotos_requisicion').update({ procesada: true }).eq('session_id', sessionId).eq('procesada', false);

    return json({ ok: true, count: renglones.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado procesando las fotos.';
    if (sessionId) {
      await admin.from('capture_sessions').update({ estatus: 'fotos_recibidas', error_mensaje: message }).eq('id', sessionId);
    }
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
