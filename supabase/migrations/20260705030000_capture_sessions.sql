-- ================================================================
-- CAPTURE_SESSIONS
-- Una sesión = un QR generado al presionar "Capturar entrega" sobre
-- una requisición pendiente. Expira automáticamente a los 15 min.
-- Ruta móvil que la consume: /captura-movil/:sessionId (sin login,
-- el session_id es el único control de acceso).
-- ================================================================
create table if not exists capture_sessions (
  id              text        primary key,  -- generado en cliente, ej. SESS-XXXXX
  requisicion_id  text        not null
                    references requisiciones(id) on delete cascade,
  estatus         text        not null default 'esperando_fotos'
                    check (estatus in (
                      'esperando_fotos', 'fotos_recibidas', 'procesando',
                      'listo_para_revision', 'completada', 'expirada'
                    )),
  expira_en       timestamptz not null,      -- creado_en + 15 min
  creado_en       timestamptz not null default now()
);

create index if not exists idx_capture_sessions_expira      on capture_sessions (expira_en);
create index if not exists idx_capture_sessions_requisicion on capture_sessions (requisicion_id);

-- Cierra la dependencia circular con requisiciones.session_id (Fase 1 crea la
-- requisición sin sesión; Fase 2 crea la sesión y la enlaza de vuelta).
alter table requisiciones
  add constraint fk_requisiciones_session
  foreign key (session_id) references capture_sessions(id);
