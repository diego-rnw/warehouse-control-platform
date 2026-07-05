-- ================================================================
-- ROW LEVEL SECURITY
-- Un solo rol con cuenta en v1: "almacen" (incluye Superadmin, sin
-- distinción de permisos — ver PROJECT.md §3). Cualquier usuario
-- autenticado de Supabase Auth puede leer/escribir estas tablas.
--
-- La única excepción es la ruta móvil de captura, que NO autentica
-- usuario — su acceso a capture_sessions/fotos_requisicion pasa por
-- las Edge Functions (service role), nunca directo con el anon key
-- desde esa ruta. Por eso no hay política anon aquí: el cliente
-- anónimo no tiene acceso de lectura/escritura directo a estas
-- tablas; sólo las Edge Functions (service role, bypassa RLS).
-- ================================================================

alter table requisiciones     enable row level security;
alter table renglones_foodbot enable row level security;
alter table renglones_reparto enable row level security;
alter table ajustes           enable row level security;
alter table capture_sessions  enable row level security;
alter table fotos_requisicion enable row level security;

-- requisiciones / renglones_foodbot / renglones_reparto: CRUD para
-- cualquier usuario autenticado (rol único "almacen" en v1).
create policy "authenticated_select_requisiciones" on requisiciones
  for select using (auth.role() = 'authenticated');
create policy "authenticated_insert_requisiciones" on requisiciones
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated_update_requisiciones" on requisiciones
  for update using (auth.role() = 'authenticated');

create policy "authenticated_select_renglones_foodbot" on renglones_foodbot
  for select using (auth.role() = 'authenticated');
create policy "authenticated_insert_renglones_foodbot" on renglones_foodbot
  for insert with check (auth.role() = 'authenticated');

-- renglones_reparto: sin UPDATE/DELETE — inmutable a nivel de base de
-- datos, no sólo de UI (ver PROJECT.md §6).
create policy "authenticated_select_renglones_reparto" on renglones_reparto
  for select using (auth.role() = 'authenticated');
create policy "authenticated_insert_renglones_reparto" on renglones_reparto
  for insert with check (auth.role() = 'authenticated');

-- ajustes: solo INSERT + SELECT. Nunca UPDATE/DELETE.
create policy "authenticated_select_ajustes" on ajustes
  for select using (auth.role() = 'authenticated');
create policy "authenticated_insert_ajustes" on ajustes
  for insert with check (auth.role() = 'authenticated');

-- capture_sessions / fotos_requisicion: el desktop autenticado puede
-- leer (para Realtime/polling) y crear sesiones; el upload de fotos
-- desde el celular pasa siempre por la Edge Function (service role).
create policy "authenticated_select_capture_sessions" on capture_sessions
  for select using (auth.role() = 'authenticated');
create policy "authenticated_insert_capture_sessions" on capture_sessions
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated_select_fotos_requisicion" on fotos_requisicion
  for select using (auth.role() = 'authenticated');
