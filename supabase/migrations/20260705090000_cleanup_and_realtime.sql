-- ================================================================
-- LIMPIEZA DE SESIONES EXPIRADAS
-- ================================================================
create or replace function limpiar_sesiones_expiradas()
returns integer as $$
declare
  n integer;
begin
  update capture_sessions
  set    estatus = 'expirada'
  where  estatus in ('esperando_fotos', 'fotos_recibidas', 'procesando')
    and  expira_en < now();
  get diagnostics n = row_count;
  return n;
end;
$$ language plpgsql security definer;

-- Cron cada 5 minutos (requiere la extensión pg_cron, disponible en
-- Supabase hosted; en local se puede llamar manualmente o vía Edge
-- Function programada). No falla si la extensión no existe local.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'limpiar-sesiones-expiradas',
      '*/5 * * * *',
      $cron$ select limpiar_sesiones_expiradas(); $cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron no disponible en este entorno — programar limpiar_sesiones_expiradas() externamente.';
end $$;

-- ================================================================
-- REALTIME
-- El escritorio se suscribe a capture_sessions por id para detectar
-- sin polling cuándo llegaron fotos / terminó el análisis de Vision.
-- ================================================================
alter publication supabase_realtime add table capture_sessions;
