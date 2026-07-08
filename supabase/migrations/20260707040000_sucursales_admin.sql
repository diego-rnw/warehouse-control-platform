-- Gestión de sucursales desde el panel de superadmin
create policy "superadmin_insert_sucursales" on sucursales
  for insert with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
create policy "superadmin_update_sucursales" on sucursales
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');
