-- ================================================================
-- STORAGE BUCKET — requisicion-fotos
-- Privado. Las fotos suben desde la ruta móvil sin sesión de usuario
-- — solo la Edge Function crear-sesion-upload (service role) puede
-- generar la URL firmada de subida; el cliente anónimo nunca escribe
-- directo al bucket, y sólo lee vía URL firmada de corta duración.
-- ================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'requisicion-fotos', 'requisicion-fotos', false,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

-- Solo usuarios autenticados (Almacén) pueden leer objetos del bucket
-- directamente (para revisar fotos ya subidas desde el desktop).
create policy "authenticated_read_requisicion_fotos"
  on storage.objects for select
  using (bucket_id = 'requisicion-fotos' and auth.role() = 'authenticated');

-- Ninguna política de INSERT/UPDATE/DELETE para anon ni authenticated:
-- toda escritura pasa por la Edge Function con la service role key.
