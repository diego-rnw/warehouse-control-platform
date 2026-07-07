-- capture_sessions necesita UPDATE para que el desktop pueda marcar
-- la sesión como 'completada' al guardar la entrega.
create policy "authenticated_update_capture_sessions" on capture_sessions
  for update using (auth.role() = 'authenticated');
