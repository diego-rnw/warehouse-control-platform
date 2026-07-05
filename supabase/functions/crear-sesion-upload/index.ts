// ================================================================
// Edge Function: crear-sesion-upload
// ================================================================
// Llamada desde /captura-movil/:sessionId (SIN sesión de usuario —
// el session_id del QR es el único control de acceso). Valida que
// la capture_session exista y no haya expirado, sube las fotos al
// bucket privado 'requisicion-fotos' con la service role key,
// inserta fotos_requisicion, marca capture_sessions.estatus =
// 'fotos_recibidas' y dispara procesar-vision.
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta el runtime
// de Edge Functions automáticamente — no requieren `secrets set`.
// ================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const form = await req.formData();
    const sessionId = String(form.get('sessionId') ?? '');
    const fotos = form.getAll('fotos').filter((f): f is File => f instanceof File);

    if (!sessionId || fotos.length === 0) {
      return json({ error: 'Faltan la sesión o las fotos.' }, 400);
    }

    const { data: session, error: sessionErr } = await admin
      .from('capture_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return json({ error: 'Sesión no encontrada. Pide a Almacén que genere un nuevo QR.' }, 404);
    }
    if (new Date(session.expira_en).getTime() < Date.now()) {
      await admin.from('capture_sessions').update({ estatus: 'expirada' }).eq('id', sessionId);
      return json({ error: 'La sesión expiró. Pide a Almacén que genere un nuevo QR.' }, 410);
    }
    if (session.estatus === 'completada') {
      return json({ error: 'Esta entrega ya fue confirmada por Almacén.' }, 409);
    }

    let uploaded = 0;
    for (const foto of fotos) {
      const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${sessionId}/${crypto.randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await foto.arrayBuffer());

      const { error: uploadErr } = await admin.storage
        .from('requisicion-fotos')
        .upload(path, bytes, { contentType: foto.type || 'image/jpeg', upsert: false });
      if (uploadErr) continue;

      await admin.from('fotos_requisicion').insert({ session_id: sessionId, url_storage: path, procesada: false });
      uploaded++;
    }

    if (uploaded === 0) {
      return json({ error: 'No se pudo subir ninguna foto. Intenta de nuevo.' }, 500);
    }

    await admin.from('capture_sessions').update({ estatus: 'fotos_recibidas', error_mensaje: null }).eq('id', sessionId);

    // Dispara el análisis de Gemini Vision. Se espera a que termine para que
    // el celular sepa que el flujo completo funcionó; el desktop de todas
    // formas se actualiza vía Realtime en cuanto cambie el estatus.
    await fetch(`${supabaseUrl}/functions/v1/procesar-vision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {
      // Si procesar-vision falla en dispararse, el estatus se queda en
      // 'fotos_recibidas' — Almacén ve el banner de error la próxima vez
      // que procesar-vision corra o se reintente manualmente.
    });

    return json({ ok: true, count: uploaded });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error inesperado.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
