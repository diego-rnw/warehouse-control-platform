-- ================================================================
-- PANEL SUPERADMIN
-- - Rol vía app_metadata.role en Supabase Auth ('superadmin' | 'almacen')
-- - api_usage_log: registro de cada llamada a Gemini (tokens reportados
--   por la API en usageMetadata) para medir consumo y costo estimado.
--   Google NO expone saldo por API — el presupuesto se configura manualmente.
-- - app_config: configuración clave-valor del sistema.
-- ================================================================

create table if not exists api_usage_log (
  id            uuid        primary key default gen_random_uuid(),
  session_id    text,
  modelo        text        not null,
  tokens_input  integer     not null default 0,
  tokens_output integer     not null default 0,
  tokens_think  integer     not null default 0,
  ok            boolean     not null default true,
  creado_en     timestamptz not null default now()
);

create index if not exists idx_api_usage_fecha on api_usage_log (creado_en desc);

create table if not exists app_config (
  clave         text        primary key,
  valor         text        not null,
  actualizado_en timestamptz not null default now()
);

insert into app_config (clave, valor) values
  ('presupuesto_api_mensual_usd', '10'),
  ('gemini_model', 'gemini-2.5-flash')
on conflict (clave) do nothing;

alter table api_usage_log enable row level security;
alter table app_config    enable row level security;

-- Solo superadmin lee el log de uso (inserts vía service role, bypassa RLS)
create policy "superadmin_select_api_usage" on api_usage_log
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- Config: cualquier autenticado lee, solo superadmin escribe
create policy "authenticated_select_app_config" on app_config
  for select using (auth.role() = 'authenticated');
create policy "superadmin_update_app_config" on app_config
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy "superadmin_insert_app_config" on app_config
  for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- Asigna superadmin al usuario fundador
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"superadmin"}'::jsonb
where email = 'diego@rockandwok.com';
