-- ================================================================
-- FOTOS_REQUISICION
-- Fotos subidas desde el celular vía la URL del QR, ligadas a una
-- capture_session. procesada=true una vez que Gemini Vision terminó
-- de extraer sus renglones.
-- ================================================================
create table if not exists fotos_requisicion (
  id          uuid        primary key default gen_random_uuid(),
  session_id  text        not null
                references capture_sessions(id) on delete cascade,
  url_storage text        not null,    -- path en bucket 'requisicion-fotos'
  procesada   boolean     not null default false,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_fotos_session on fotos_requisicion (session_id);
