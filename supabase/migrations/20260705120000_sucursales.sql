-- ================================================================
-- SUCURSALES
-- Catálogo de sucursales Rock n' Wok. Fuente de verdad local para
-- el módulo de almacén — independiente del sistema de RRHH.
-- ================================================================
create table if not exists sucursales (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null unique,
  activa     boolean     not null default true,
  creado_en  timestamptz not null default now()
);

-- RLS: solo usuarios autenticados
alter table sucursales enable row level security;

create policy "sucursales_select" on sucursales
  for select using (auth.role() = 'authenticated');

-- Solo superadmin podrá insertar/actualizar en el futuro.
-- Por ahora se gestiona vía migraciones.

-- Sucursales iniciales Rock n' Wok
insert into sucursales (nombre) values
  ('Parque Puebla'),
  ('UPAEP'),
  ('Explanada'),
  ('Sonata'),
  ('Vía San Ángel'),
  ('Galerías Serdán'),
  ('Zócalo'),
  ('Outlet'),
  ('Angelópolis');
