// ================================================================
// Edge Function: admin-users
// ================================================================
// Gestión de usuarios para el panel de superadmin. El frontend no
// puede crear/listar usuarios con el anon key — requiere service role,
// por eso pasa por aquí. Verifica que quien llama sea superadmin
// (app_metadata.role) antes de ejecutar cualquier acción.
//
// Acciones (POST body JSON):
//   { action: 'list' }
//   { action: 'create', email, password, role: 'almacen'|'superadmin' }
//   { action: 'toggle_ban', userId, ban: boolean }
// ================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verifica que quien llama sea superadmin
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !caller?.user) return json({ error: 'No autenticado.' }, 401);
    if (caller.user.app_metadata?.role !== 'superadmin') {
      return json({ error: 'Requiere rol de superadmin.' }, 403);
    }

    const body = await req.json();

    if (body.action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (error) throw error;
      return json({
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          nombre: (u.user_metadata?.nombre as string) ?? '',
          role: u.app_metadata?.role ?? 'almacen',
          banned: Boolean((u as { banned_until?: string }).banned_until && new Date((u as { banned_until?: string }).banned_until!) > new Date()),
          pendiente: !u.last_sign_in_at,
          lastSignIn: u.last_sign_in_at,
          createdAt: u.created_at,
        })),
      });
    }

    if (body.action === 'invite') {
      const { email, nombre, role, redirectTo } = body;
      if (!email || !nombre) return json({ error: 'Nombre y correo son obligatorios.' }, 400);
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { nombre },
        redirectTo: redirectTo || undefined,
      });
      if (error) {
        if (/already been registered|already registered/i.test(error.message)) {
          return json({ error: 'Ese correo ya está registrado.' }, 409);
        }
        throw error;
      }
      // El rol vive en app_metadata (no se puede setear en inviteUserByEmail)
      if (data.user) {
        await admin.auth.admin.updateUserById(data.user.id, {
          app_metadata: { role: role === 'superadmin' ? 'superadmin' : 'almacen' },
        });
      }
      return json({ ok: true, id: data.user?.id });
    }

    if (body.action === 'delete') {
      const { userId } = body;
      if (!userId) return json({ error: 'Falta userId.' }, 400);
      if (userId === caller.user.id) return json({ error: 'No puedes eliminar tu propia cuenta.' }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === 'toggle_ban') {
      const { userId, ban } = body;
      if (!userId) return json({ error: 'Falta userId.' }, 400);
      if (userId === caller.user.id) return json({ error: 'No puedes desactivar tu propia cuenta.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: ban ? '876000h' : 'none', // ~100 años = desactivado
      });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Acción no reconocida.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Error inesperado.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
