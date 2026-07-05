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

const PROMPT_OCR = `Analiza esta imagen de una hoja de requisición de insumos de un restaurante (Rock n' Wok).
Extrae TODOS los renglones que estén resaltados con marcatexto (highlighter).
- Amarillo = origen "almacen"
- Naranja  = origen "cocina" (requiere refrigeración)

Si un renglón no está resaltado, ignóralo. Si no puedes leer una fila con certeza, ómitela — no inventes datos.

Devuelve ÚNICAMENTE este JSON, sin texto adicional ni markdown:
{
  "renglones": [
    {
      "producto": "nombre del insumo",
      "cantidad": numero,
      "unidad": "kg" | "lt" | "pz" | "mz" | "pq" | "cja" | "gr",
      "costo": numero (costo unitario si es legible, si no 0),
      "origen": "almacen" | "cocina",
      "confianza": numero entre 0 y 1 (tu confianza en la lectura de esta fila)
    }
  ]
}`;

interface RenglonExtraido {
  producto: string;
  cantidad: number;
  unidad: string;
  costo: number;
  origen: 'almacen' | 'cocina';
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

    const { data: fotos, error: fotosErr } = await admin
      .from('fotos_requisicion')
      .select('*')
      .eq('session_id', sessionId)
      .eq('procesada', false);
    if (fotosErr) throw fotosErr;
    if (!fotos || fotos.length === 0) throw new Error('No hay fotos sin procesar para esta sesión.');

    const imageParts = [];
    for (const foto of fotos) {
      const { data: blob, error: dlErr } = await admin.storage.from('requisicion-fotos').download(foto.url_storage);
      if (dlErr || !blob) continue;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const base64 = btoa(bytes.reduce((acc, b) => acc + String.fromCharCode(b), ''));
      imageParts.push({ inlineData: { mimeType: blob.type || 'image/jpeg', data: base64 } });
    }
    if (imageParts.length === 0) throw new Error('No se pudieron descargar las fotos subidas.');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [...imageParts, { text: PROMPT_OCR }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini respondió ${response.status}: ${await response.text()}`);
    }
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini no devolvió contenido interpretable.');

    const parsed = JSON.parse(text) as { renglones: RenglonExtraido[] };
    const renglones = (parsed.renglones || [])
      .filter((r) => r && typeof r.producto === 'string' && r.producto.trim())
      .map((r) => ({
        producto: r.producto.trim(),
        cantidad: Number(r.cantidad) || 0,
        unidad: (['kg', 'lt', 'pz', 'mz', 'pq', 'cja', 'gr'].includes(r.unidad) ? r.unidad : 'pz') as RenglonExtraido['unidad'],
        costo: Number(r.costo) || 0,
        origen: r.origen === 'cocina' ? 'cocina' : 'almacen',
        confianza: typeof r.confianza === 'number' ? r.confianza : null,
      }));

    if (renglones.length === 0) throw new Error('Gemini no extrajo ningún renglón resaltado de las fotos.');

    await admin
      .from('capture_sessions')
      .update({ estatus: 'listo_para_revision', extraccion: { renglones }, error_mensaje: null })
      .eq('id', sessionId);
    await admin.from('fotos_requisicion').update({ procesada: true }).eq('session_id', sessionId).eq('procesada', false);

    return json({ ok: true, count: renglones.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado procesando las fotos.';
    if (sessionId) {
      // Revierte a 'fotos_recibidas' para permitir reintentar procesar-vision
      // manualmente; error_mensaje queda visible en el modal de captura.
      await admin.from('capture_sessions').update({ estatus: 'fotos_recibidas', error_mensaje: message }).eq('id', sessionId);
    }
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
