# Control de Almacén — puesta en marcha

Este repo tiene dos partes:

- **`app/`** — el frontend (React + Vite + TypeScript), ya conectado a tu proyecto Supabase real vía `app/.env`.
- **`supabase/`** — migraciones SQL (tablas, vistas, RLS, storage) y Edge Functions (Deno) para el backend.

El frontend ya corre localmente contra tu proyecto Supabase (`qtduqlxsmcyoipsioewq`). Lo que falta es aplicar las
migraciones y desplegar las Edge Functions a ese mismo proyecto — instrucciones abajo.

## 1. Requisitos

- Node 20+ y npm (ya usados en este repo).
- [Supabase CLI](https://supabase.com/docs/guides/cli) — se puede usar vía `npx supabase <comando>` sin instalar nada global.
- Un **Personal Access Token** de Supabase (Dashboard → Account → Access Tokens) para `supabase login`.
- La contraseña de la base de datos de tu proyecto (Dashboard → Project Settings → Database) para `supabase link`.
- Una **API key de Gemini** (https://aistudio.google.com/apikey) para la Edge Function de visión.

No pegues ninguno de estos tres en el chat — todos son secretos de verdad (a diferencia de la URL/anon key del
proyecto, que sí son seguras de compartir porque están pensadas para ir en el frontend).

## 2. Aplicar el esquema de base de datos

Desde la raíz del repo:

```bash
npx supabase login
npx supabase link --project-ref qtduqlxsmcyoipsioewq
npx supabase db push
```

Esto crea, en orden: `requisiciones`, `renglones_foodbot`, `capture_sessions`, `fotos_requisicion`,
`renglones_reparto`, `ajustes`, las vistas `v_dashboard`/`v_conciliacion`, RLS en las 6 tablas de negocio, el bucket
de Storage `requisicion-fotos`, y la función `limpiar_sesiones_expiradas()` (programada con `pg_cron` si tu plan lo
incluye — ver §5 si no).

## 3. Desplegar las Edge Functions

```bash
npx supabase functions deploy crear-sesion-upload
npx supabase functions deploy procesar-vision
npx supabase functions deploy limpiar-sesiones-expiradas
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta el runtime automáticamente — no hay que configurarlos.
Solo falta el secret de Gemini:

```bash
npx supabase secrets set GEMINI_API_KEY=tu-api-key-de-gemini
```

Opcional — cambiar el modelo (default `gemini-2.5-flash`):

```bash
npx supabase secrets set GEMINI_MODEL=gemini-2.5-pro
```

## 4. Crear el primer usuario (Almacén / Superadmin)

La app usa Supabase Auth (email/password), un solo rol con cuenta en v1 — ver `project/PROJECT.md` §3. Crea el
primer usuario desde el Dashboard → Authentication → Users → Add user (o `supabase.auth.admin.createUser` si
prefieres scriptearlo). No hay flujo de auto-registro en la UI a propósito — el acceso es solo para el equipo de
Almacén/dirección.

## 5. Si tu plan de Supabase no incluye `pg_cron`

La migración `20260705090000_cleanup_and_realtime.sql` intenta programar `limpiar_sesiones_expiradas()` con
`pg_cron` y no falla si la extensión no existe. En ese caso, programa la Edge Function `limpiar-sesiones-expiradas`
en Dashboard → Edge Functions → esa función → Cron, cada 5 minutos.

## 6. Correr el frontend localmente

```bash
cd app
npm install
npm run dev
```

`app/.env` ya tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` apuntando a tu proyecto — no lo subas a git
(ya está en `.gitignore`; `app/.env.example` es la plantilla segura para compartir/subir).

## 7. Desplegar el frontend

Cualquier hosting estático sirve (Vercel/Netlify/Cloudflare Pages) — build command `npm run build` dentro de
`app/`, output `app/dist`. Configura las mismas dos variables de entorno (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) en el panel del hosting.

**Importante para la ruta móvil** (`/captura-movil/:sessionId`): el hosting debe hacer *SPA fallback* (todas las
rutas sirven `index.html`) para que el QR generado en desktop abra correctamente esa ruta en el celular.

## 8. Conectar a GitHub

Este repo aún no tiene remoto configurado. Cuando quieras conectarlo:

```bash
git remote add origin <url-de-tu-repo-en-github>
git push -u origin main
```

## Nota sobre este entorno de desarrollo

Esta sesión corre en un contenedor con una política de red por allowlist — no tiene salida a
`qtduqlxsmcyoipsioewq.supabase.co` (sí la tiene a registries públicos como npm). Por eso el código se verificó de
dos formas sin depender de esa conectividad:

1. Las migraciones se probaron contra un Postgres 16 real en este contenedor (con los esquemas `auth`/`storage`/
   `cron` de Supabase stubbeados) — la derivación de estatus/match en `v_dashboard`/`v_conciliacion` se confirmó
   línea por línea contra la lógica del prototipo.
2. Las tres pantallas principales (Dashboard, Requisiciones, Comparativo) se renderizaron con datos de prueba
   equivalentes a los del prototipo, sin errores de consola/React.

Lo único que no se pudo probar end-to-end desde aquí es el login real y las llamadas en vivo a tu proyecto Supabase
(bloqueadas por el allowlist de red de este contenedor, no por el código). Al correr `npm run dev` desde tu propia
máquina — o desde un entorno de Claude Code con la política de red abierta a tu proyecto Supabase — debería
conectar sin cambios.
