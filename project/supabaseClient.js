// ================================================================
// supabaseClient.js — Control de Almacén · ROCK N' WOK
// ================================================================
// Stub listo para conectar. Instalar: npm install @supabase/supabase-js
// o CDN: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//
// Sustituir SUPABASE_URL y SUPABASE_ANON_KEY con las credenciales
// del proyecto en https://app.supabase.com → Settings → API.
// ================================================================

// import { createClient } from '@supabase/supabase-js';
// const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';
// const SUPABASE_ANON_KEY = 'tu-anon-key-publica';
// export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ================================================================
// TABLA: capture_sessions
// ================================================================
// Una sesión = un QR generado. Se crea al presionar "Capturar
// requisición" y expira automáticamente a los 15 minutos.
//
// id          TEXT      PK — generado en cliente (ej. SESS-XXXXX)
// estatus     TEXT      'esperando_fotos' | 'fotos_recibidas' | 'completada' | 'expirada'
// expira_en   TIMESTAMPTZ
// creado_en   TIMESTAMPTZ DEFAULT now()
//
// OPERACIONES:
//
// [UI: openCapture()] — CREAR sesión
//   await supabase.from('capture_sessions').insert({
//     id:        sessionId,
//     estatus:   'esperando_fotos',
//     expira_en: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
//   });
//
// [UI: polling o Realtime] — LEER estatus para detectar fotos
//   // Opción A — polling (simple):
//   const { data } = await supabase
//     .from('capture_sessions').select('estatus').eq('id', sessionId).single();
//
//   // Opción B — Supabase Realtime (recomendado, sin polling):
//   supabase.channel('session-' + sessionId)
//     .on('postgres_changes', {
//       event: 'UPDATE', schema: 'public',
//       table: 'capture_sessions', filter: 'id=eq.' + sessionId,
//     }, payload => {
//       if (payload.new.estatus === 'fotos_recibidas') {
//         // Activar procesamiento con Claude Vision
//       }
//     })
//     .subscribe();
//
// [UI: saveRequisicion()] — MARCAR como completada
//   await supabase.from('capture_sessions')
//     .update({ estatus: 'completada' }).eq('id', sessionId);


// ================================================================
// TABLA: fotos_requisicion
// ================================================================
// Fotos subidas desde el celular, ligadas a una sesión.
//
// id          UUID      PK DEFAULT gen_random_uuid()
// session_id  TEXT      FK → capture_sessions.id ON DELETE CASCADE
// url_storage TEXT      — Path en Supabase Storage bucket 'requisicion-fotos'
// procesada   BOOLEAN   DEFAULT false
// creado_en   TIMESTAMPTZ DEFAULT now()
//
// OPERACIONES:
//
// [Página móvil /captura-movil/:sessionId] — SUBIR foto + registrar
//   // 1. Upload al bucket:
//   const filename = sessionId + '/' + Date.now() + '.jpg';
//   const { data: storageData } = await supabase.storage
//     .from('requisicion-fotos').upload(filename, file, { upsert: false });
//
//   // 2. Insertar registro:
//   await supabase.from('fotos_requisicion').insert({
//     session_id: sessionId, url_storage: storageData.path, procesada: false,
//   });
//
//   // 3. Actualizar sesión para notificar al escritorio:
//   await supabase.from('capture_sessions')
//     .update({ estatus: 'fotos_recibidas' }).eq('id', sessionId);
//
// [Servidor / Edge Function] — MARCAR como procesada post-OCR
//   await supabase.from('fotos_requisicion')
//     .update({ procesada: true }).eq('session_id', sessionId);


// ================================================================
// TABLA: requisiciones
// ================================================================
// Entidad central. Una por hoja de reparto capturada.
//
// id          TEXT      PK
// folio       TEXT      UNIQUE — viene del folio de Foodbot (ej. REQ-2025-024)
// sucursal    TEXT
// fecha       DATE      — fecha de la entrega, no de captura
// estatus     TEXT      'pendiente' | 'conciliada' | 'con_ajuste'
// session_id  TEXT      FK → capture_sessions.id (nullable)
// creado_en   TIMESTAMPTZ DEFAULT now()
//
// OPERACIONES:
//
// [UI: saveRequisicion()] — INSERT
//   await supabase.from('requisiciones').insert({
//     id: newReq.id, folio: newReq.folio, sucursal: newReq.sucursal,
//     fecha: newReq.fecha, estatus: 'pendiente', session_id: captureSessionId,
//   });
//
// [UI: Dashboard] — SELECT con filtros
//   let q = supabase.from('requisiciones').select(`
//     *, renglones_reparto(*),
//     ajustes:renglones_reparto(ajustes(*))
//   `);
//   if (sucursal !== 'all') q = q.eq('sucursal', sucursal);
//   if (dateFrom) q = q.gte('fecha', dateFrom);
//   if (dateTo)   q = q.lte('fecha', dateTo);
//   const { data } = await q.order('fecha', { ascending: false });
//
// [UI: Conciliación — tras resolver todos los renglones] — UPDATE estatus
//   await supabase.from('requisiciones')
//     .update({ estatus: 'conciliada' }).eq('id', reqId);


// ================================================================
// TABLA: renglones_reparto
// ================================================================
// Renglones extraídos por Claude Vision. INMUTABLES después de insert.
// Los ajustes van en tabla 'ajustes' — nunca aquí.
//
// id              TEXT      PK
// requisicion_id  TEXT      FK → requisiciones.id ON DELETE CASCADE
// producto        TEXT
// cantidad        NUMERIC(10,3)
// unidad          TEXT      — 'kg', 'lt', 'pz', 'mz', 'pq', 'cja', 'gr'
// costo           NUMERIC(10,2)  — costo unitario
// origen          TEXT      CHECK (origen IN ('almacen','cocina'))
//                           almacen = resaltado amarillo en hoja física
//                           cocina  = resaltado naranja (requiere refrigeración)
// confianza_ocr   NUMERIC(4,3)  — 0.0–1.0 devuelto por Claude Vision, NULL si manual
// creado_en       TIMESTAMPTZ DEFAULT now()
//
// OPERACIONES:
//
// [UI: saveRequisicion()] — BATCH INSERT
//   const renglones = reviewRows.map(r => ({
//     id: r.id, requisicion_id: newReq.id,
//     producto: r.producto, cantidad: parseFloat(r.cantidad),
//     unidad: r.unidad, costo: parseFloat(r.costo),
//     origen: r.origen, confianza_ocr: r.confianza,
//   }));
//   await supabase.from('renglones_reparto').insert(renglones);
//
// [UI: Conciliación] — SELECT por requisicion
//   const { data } = await supabase.from('renglones_reparto')
//     .select('*, ajustes(*)').eq('requisicion_id', reqId);


// ================================================================
// TABLA: renglones_foodbot
// ================================================================
// Renglones del Excel exportado de Foodbot. Se reemplazan en cada carga.
//
// id          UUID      PK DEFAULT gen_random_uuid()
// folio       TEXT      — referencia blanda a requisiciones.folio
// producto    TEXT
// cantidad    NUMERIC(10,3)
// costo       NUMERIC(10,2)
// cargado_en  TIMESTAMPTZ DEFAULT now()
//
// OPERACIONES:
//
// [UI: handleExcelUpload()] — PARSEAR Excel e INSERT
//   // Parsear con SheetJS:
//   const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
//   const ws = wb.Sheets[wb.SheetNames[0]];
//   const rows = XLSX.utils.sheet_to_json(ws);
//
//   // Mapear columnas (ajustar a nombres reales de Foodbot):
//   const renglones = rows.map(r => ({
//     folio:    r['Folio'] || r['folio'],
//     producto: r['Producto'] || r['producto'],
//     cantidad: Number(r['Cantidad'] || r['cantidad']),
//     costo:    Number(r['Costo Unitario'] || r['costo']),
//   })).filter(r => r.folio && r.producto);
//
//   // Limpiar datos anteriores de los mismos folios (evitar duplicados):
//   const folios = [...new Set(renglones.map(r => r.folio))];
//   await supabase.from('renglones_foodbot').delete().in('folio', folios);
//
//   // Insertar:
//   await supabase.from('renglones_foodbot').insert(renglones);
//
// [UI: Conciliación match] — SELECT por folio
//   const { data } = await supabase.from('renglones_foodbot')
//     .select('*').eq('folio', folio);


// ================================================================
// TABLA: ajustes
// ================================================================
// Registro de auditoría inmutable. NUNCA borrar ni actualizar filas.
// Cada fila documenta una corrección de cantidad con motivo.
//
// id                UUID      PK DEFAULT gen_random_uuid()
// renglon_id        TEXT      FK → renglones_reparto.id
// cantidad_anterior NUMERIC(10,3)  — valor original en renglones_reparto
// cantidad_nueva    NUMERIC(10,3)  — valor corregido
// motivo            TEXT NOT NULL  — obligatorio, razón del ajuste
// usuario           TEXT NOT NULL  — email o identificador del operador
// creado_en         TIMESTAMPTZ DEFAULT now()
//
// OPERACIONES:
//
// [UI: onSaveAdjustment()] — INSERT ajuste (nunca UPDATE)
//   await supabase.from('ajustes').insert({
//     renglon_id:        rowId,
//     cantidad_anterior: cantidadOriginal,   // de renglones_reparto.cantidad
//     cantidad_nueva:    parseFloat(adj.cantidadNueva),
//     motivo:            adj.motivo.trim(),
//     usuario:           supabase.auth.getUser()?.email || 'almacen',
//   });
//
// [UI: Vista auditoría] — SELECT ajustes de una requisición
//   const { data } = await supabase.from('ajustes')
//     .select(`*, renglones_reparto!inner(requisicion_id, producto)`)
//     .eq('renglones_reparto.requisicion_id', reqId)
//     .order('creado_en', { ascending: false });


// ================================================================
// CLAUDE VISION — Integración OCR
// ================================================================
// La llamada a Claude se debe hacer desde un Edge Function o servidor
// para no exponer la API key en el cliente.
//
// Supabase Edge Function sugerida: supabase/functions/procesar-fotos/index.ts
//
// Prompt recomendado para Claude (claude-opus-4-5, vision):
// ---
// const PROMPT_OCR = `
// Analiza esta imagen de una hoja de requisición de insumos de restaurante.
// Extrae TODOS los renglones resaltados con marcatexto.
// - Amarillo = origen "almacen"
// - Naranja  = origen "cocina"
//
// Devuelve ÚNICAMENTE el siguiente JSON, sin texto adicional:
// {
//   "renglones": [
//     {
//       "producto":  "nombre del insumo",
//       "cantidad":  número,
//       "unidad":    "kg|lt|pz|mz|pq|cja|gr",
//       "costo":     número (costo unitario),
//       "origen":    "almacen" | "cocina",
//       "confianza": número entre 0 y 1 (tu confianza en la lectura)
//     }
//   ]
// }
// `;
// ---
// Llamada desde Edge Function:
//   const response = await fetch('https://api.anthropic.com/v1/messages', {
//     method: 'POST',
//     headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
//     body: JSON.stringify({
//       model: 'claude-opus-4-5',
//       max_tokens: 2048,
//       messages: [{ role: 'user', content: [
//         { type: 'image', source: { type: 'url', url: signedPhotoUrl } },
//         { type: 'text', text: PROMPT_OCR },
//       ]}],
//     }),
//   });
//   const result = await response.json();
//   const renglones = JSON.parse(result.content[0].text).renglones;
