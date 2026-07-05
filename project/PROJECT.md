# Control de Almacén — ROCK N' WOK

## 1. Qué es

Plataforma interna web para que el equipo de **Almacén Central** de ROCK N' WOK capture,
concilie y audite las requisiciones de insumos que se envían a las sucursales. Sustituye
el cruce manual en Excel entre lo que pide el sistema de pedidos (**Foodbot**) y lo que
**Reparto** entrega físicamente en cada sucursal.

No es una app pública ni de cliente final — es una herramienta operativa de uso interno,
un solo rol activo por ahora (Almacén), diseñada para usarse en escritorio (captura de
Excel, conciliación, dashboards) y en celular únicamente para el paso de captura de fotos
vía QR.

## 2. Problema que resuelve

Hoy la conciliación entre lo que Foodbot generó y lo que Reparto entregó en papel es
manual, propensa a error, y no deja rastro auditable de por qué una cantidad cambió entre
la hoja física y el sistema. Esta plataforma:

- Da una fuente única de verdad por requisición (folio + sucursal + fecha).
- Detecta automáticamente diferencias de cantidad entre Foodbot y lo entregado.
- Obliga a documentar (motivo + usuario + timestamp) cualquier ajuste — nunca se
  sobrescribe el dato capturado originalmente.
- Da visibilidad ejecutiva: fricción por sucursal, tendencia mes vs mes.

## 3. Usuarios y roles

| Rol | Dónde | Qué hace |
|---|---|---|
| **Personal de Almacén** | Desktop | Sube el Excel de Foodbot, revisa/concilia, guarda ajustes, ve dashboards. |
| **Superadmin** | Desktop | Mismo acceso operativo que Almacén; es la cuenta del dueño/administrador del
  negocio, sin restricciones adicionales en v1. |
| **Personal de Reparto** | No tiene cuenta | Entrega físicamente la requisición. Su única interacción digital es escanear el QR que genera Almacén y subir fotos de la hoja desde su celular — sin login. |

**Alcance de roles confirmado para v1: solo estos dos roles con cuenta (Almacén y
Superadmin), sin distinción de permisos entre ellos.** No se contemplan roles
adicionales (gerente de sucursal, administración/finanzas de solo lectura, etc.) — se
retira esa previsión de versiones futuras.

## 4. Flujo operativo (las dos fases, siempre en ese orden)

**Fase 1 — Alta de requisición (la hace Almacén, en la sección "Requisiciones")**
1. Foodbot genera y exporta un Excel con los productos pedidos por una sucursal.
2. Almacén sube ese Excel a la plataforma y selecciona la sucursal destino.
3. El sistema crea la requisición con estatus `pendiente_captura` y sus renglones
   esperados (`renglones_foodbot`). Aquí NO hay cantidades de reparto todavía.

**Fase 2 — Captura de entrega (la hace Almacén, disparada por Reparto)**
1. Reparto entrega físicamente la hoja/insumos en Almacén.
2. Almacén pulsa **"Capturar entrega"** sobre esa requisición pendiente → se genera un
   **QR de un solo uso, con expiración (15 min)**.
3. Reparto (o quien tenga el celular a mano) escanea el QR, la página móvil abre la
   cámara y sube foto(s) de la hoja física. Sin cuenta, sin login — el session_id del QR
   es el único control de acceso.
4. Las fotos se procesan con **Claude Vision** para extraer producto/cantidad/unidad/
   costo/origen (almacén vs cocina) en JSON estructurado.
5. Almacén revisa y corrige el JSON extraído en pantalla (celdas editables, indicador de
   confianza OCR) y confirma → se insertan los `renglones_reparto`, inmutables desde ahí.
6. El sistema compara automáticamente `renglones_reparto` vs `renglones_foodbot` por
   producto+costo y calcula el estatus: `conciliada` (match perfecto), `con_diferencias`
   (hay desajustes sin resolver) o `con_ajuste` (los desajustes ya se resolvieron con una
   corrección documentada).
7. Si hay diferencia, Almacén captura una **corrección con motivo obligatorio** → se
   inserta un registro en `ajustes` (nunca se edita `renglones_reparto`).

## 5. Funciones de la plataforma (pantallas)

- **Dashboard** — KPIs del período filtrado (total requisiciones, conciliadas sin ajuste,
  con ajuste/diferencias, importe total), fricción por sucursal, listado reciente.
  Solo lectura, sin acciones de captura.
- **Requisiciones** — Fase 1 (subir Excel Foodbot + sucursal destino) y Fase 2 (lista de
  requisiciones; expandible; botón "Capturar entrega" en las pendientes; tabla de
  conciliación renglón a renglón con formulario de ajuste inline).
- **Comparativo** — Comparación mes vs mes **por sucursal, siempre contra sí misma**
  (nunca cruza sucursales distintas): req., importe, % fricción, Δ importe. Cada tarjeta
  es expandible y muestra el detalle de qué renglones causaron la diferencia en cada mes.
- **Captura vía QR** (overlay, siempre tema oscuro) — genera QR, cuenta regresiva de
  expiración, estado en vivo (esperando fotos → recibidas → procesando con Claude Vision
  → listo), botón de simulación en modo demo.
- **Revisión de datos extraídos** (overlay) — tabla editable de los renglones que Claude
  Vision extrajo, con indicador de confianza por celda, antes de confirmar.

## 6. Reglas de negocio no negociables

- `renglones_reparto` es **inmutable** una vez insertado — es la evidencia de lo que
  llegó físicamente. Cualquier corrección se documenta como un nuevo registro en
  `ajustes` con motivo obligatorio, usuario y timestamp.
- El estatus de una requisición **siempre se deriva** comparando renglones_reparto vs
  renglones_foodbot (+ ajustes) — nunca se marca a mano.
- Una requisición sin `renglones_reparto` está en `pendiente_captura` y muestra
  "Capturar entrega"; no se puede conciliar antes de eso.
- El comparativo mes vs mes compara una sucursal solo contra sí misma en otro período.
  Nunca contra otra sucursal (fricción/insumo por sucursal no es comparable entre
  ubicaciones distintas: mismo padrón, dueños/rentas/volumen diferentes).
- El QR de captura expira (15 min) y es de un solo uso por requisición.

## 7. Stack e infraestructura recomendada

- **Frontend**: React + Vite (SPA), TypeScript. Mobile-first solo para la ruta
  `/captura-movil/:sessionId`; el resto es desktop-first.
- **Backend/datos**: **Supabase** (Postgres administrado + Auth + Storage + Realtime +
  Edge Functions). Ver `schema.sql` para el modelo completo y `SCHEMA.md` para el detalle
  de operaciones/endpoints.
  - **Auth**: Supabase Auth, un solo rol "almacen" para v1 (email/password o magic link).
    La ruta de captura móvil NO requiere sesión — se autoriza solo con el `session_id`
    del QR (corta vida, ver Edge Function `validar-sesion`).
  - **Storage**: bucket privado `requisicion-fotos` para las fotos subidas desde el
    celular; acceso vía URL firmada de corta duración generada por Edge Function.
  - **Realtime**: canal por `capture_sessions.id` para que el navegador de escritorio
    detecte sin polling cuándo llegaron fotos y cuándo terminó el análisis de Vision.
  - **Edge Functions** (Deno, en Supabase):
    - `crear-sesion-upload`: genera URL firmada de subida para la página móvil, validando
      que la sesión exista y no haya expirado.
    - `procesar-vision`: se dispara cuando `capture_sessions.estatus` pasa a
      `fotos_recibidas`; llama a la API de Claude (visión) con las fotos, devuelve JSON
      de renglones y actualiza el estatus a `listo_para_revision`.
    - `limpiar_sesiones_expiradas`: cron periódico (ver función SQL homónima).
- **IA**: Anthropic Claude (modelo con visión) para extraer producto/cantidad/unidad/
  costo/origen de las fotos de la hoja física. Prompt debe forzar salida JSON estricta
  (ver contrato en `SCHEMA.md`).
- **Importación Excel**: SheetJS (`xlsx`) en el cliente o en una Edge Function para parsear
  el archivo de Foodbot antes de insertar `renglones_foodbot`.
- **Hosting**: cualquier estático (Vercel/Netlify/Cloudflare Pages) para el frontend;
  Supabase aloja base de datos, storage y funciones. No se requiere backend propio.
- **Diseño**: Design System ROCK N' WOK (`_ds/`) — negro/amarillo, Monument Extended +
  Montserrat, sin gradientes ni sombras suaves. La app soporta tema claro/oscuro con
  tokens CSS (`--t1`…`--t9`, `--chip-*`, `--org-*`) definidos por tema.

## 8. Qué NO incluye esta v1 (a confirmar antes de construir)

- Multi-rol / permisos granulares por sucursal.
- Notificaciones push/email cuando hay diferencias.
- Edición o eliminación de una requisición ya conciliada.
- Exportación a Excel/PDF de reportes (el comparativo y dashboard son solo en pantalla).
- Integración directa con la API de Foodbot (hoy es carga manual de Excel).

## 9. Funcionalidades agregadas al prototipo (iteración post-v1 inicial)

Sobre la base descrita arriba, el prototipo (`Control de Almacen.dc.html`) ya incluye:

- **Dashboard — filtros por estatus**: las 4 tarjetas KPI (Total, Conciliadas, Con
  ajuste/diferencias, Pendiente captura) son clicables y filtran la lista/tablas del
  dashboard por ese estatus; hay indicador de filtro activo y botón para quitarlo.
- **Dashboard — desglose de productos**: tabla con cantidad total, # de requisiciones e
  importe por producto entregado en el período filtrado (agregado sobre
  `renglones_reparto`).
- **Dashboard — top productos con más fricción**: ranking de productos con más
  ocurrencias de `diferencia`/`no_encontrado`/`ajustado` en el período filtrado.
- **Dashboard — tendencia de fricción mes a mes**: sparkline con el % de requisiciones
  con ajuste/diferencia por mes (todas las sucursales, cronológico).
- **Requisiciones — búsqueda por folio** y estado vacío cuando no hay coincidencias.
- **Requisiciones — historial de correcciones por renglón**: cuando un renglón ya tiene
  un ajuste guardado, "+ Nueva corrección" reabre el formulario; al guardar, el valor
  anterior (cantidad + motivo + hora) se conserva visible como historial — nunca se
  pierde, coherente con que `ajustes` es de solo inserción.
- **Requisiciones — confirmación antes de "Guardar entrega"**: recuerda que
  `renglones_reparto` queda inmutable una vez guardado.
- **Nav — badge de alerta**: contador en "REQUISICIONES" con el # de requisiciones en
  estatus `con_diferencias` (global, no depende de filtros).
- **Login**: pantalla de acceso (correo/contraseña) para los dos roles con cuenta
  (Almacén y Superadmin, sin distinción de permisos en v1). Sesión persistida por ahora
  vía `localStorage` en el prototipo — reemplazar por `supabase.auth.signInWithPassword`
  / `getSession` / `onAuthStateChange` / `signOut` (comentarios `// SUPABASE:` ya
  marcan los puntos exactos en `handleLogin`/`handleLogout`).
- **Manejo de errores**: validación real de archivo en la subida de Excel (extensión
  `.xlsx/.xls/.csv`, tamaño máx. 10 MB) y banners de error en línea (no `alert()`) para
  Guardar entrega, Guardar ajuste y Subir Excel, con puntos ya comentados
  (`// SUPABASE: ... try/catch ...`) para conectar el error real de cada operación de
  Supabase y mostrar el mismo banner con botón de reintento.
- **Guía interactiva (tour)**: ícono de foco (esquina inferior derecha) inicia un
  recorrido de 8 pasos con spotlight que resalta zonas clave del Dashboard,
  Requisiciones y Comparativo. Se auto-muestra una sola vez tras el primer login
  (`localStorage: ca-tour-seen`) y luego solo bajo demanda.

Todo lo anterior opera sobre los mismos datos mock / `state` local del prototipo — no
requiere cambios al esquema de datos (`schema.sql`) para implementarse, salvo el
desglose de productos y el ranking de fricción, que en producción deberían resolverse
como agregaciones sobre `v_conciliacion` (ver `SCHEMA.md` §3) en vez de recalcularse en
cliente sobre todas las requisiciones.

## 10. Archivos de referencia en este repo

- `Control de Almacen.dc.html` — prototipo funcional completo (UI, datos mock,
  comentarios `// SUPABASE:` en cada punto donde va una llamada real).
- `schema.sql` — DDL completo de Postgres/Supabase, vistas y políticas RLS sugeridas.
- `supabaseClient.js` — stub comentado con las operaciones CRUD/Realtime/Storage exactas
  que necesita cada acción de la UI.
- `SCHEMA.md` — este documento hermano, con el contrato de datos y operaciones para
  implementar con Claude Code.
