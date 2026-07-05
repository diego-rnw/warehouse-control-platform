// ================================================================
// Edge Function: limpiar-sesiones-expiradas
// ================================================================
// Alternativa a pg_cron (útil si el plan de Supabase no lo incluye):
// programar esta función en Dashboard → Edge Functions → Cron cada
// 5 minutos. Simplemente llama a la función SQL homónima.
// ================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const { data, error } = await admin.rpc('limpiar_sesiones_expiradas');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ ok: true, expiradas: data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
