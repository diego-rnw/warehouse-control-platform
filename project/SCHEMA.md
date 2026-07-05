# Esquema de datos — Control de Almacén

Contrato de datos para implementar con Claude Code sobre Supabase (Postgres + Storage +
Realtime + Edge Functions). El DDL ejecutable vive en `schema.sql` — este documento
explica el modelo, las relaciones, y qué operación de la UI dispara cada query.

## 1. Diagrama de entidades (texto)

```
sucursales (catálogo, opcional en v1 — hoy "sucursal" es texto libre)
        │
        │ 1
        ▼ N
requisiciones ──1───N── renglones_foodbot   (Fase 1: lo que Foodbot pidió)
     │  │
     │  └──1───N── renglones_reparto        (Fase 2: lo que Reparto entregó — INMUTABLE)
     │                    │
     │                    └──1───N── ajustes  (correcciones documentadas, INMUTABLE)
     │
     └──0..1── capture_sessions ──1───N── fotos_requisicion
                  (una sesión de QR por captura de entrega)
```

- Una **requisición** = una hoja física = un folio único.
- `renglones_foodbot` y `renglones_reparto` cuelgan de la MISMA `requisicion_id` — se
  comparan por `producto` + `costo` para encontrar el match.
- `ajustes` referencia un `renglon_id` de `renglones_reparto` — nunca lo modifica.
- `capture_sessions` es efímera: vive mientras dura el QR (15 min) o hasta que la
  requisición pasa a tener `renglones_reparto`.

## 2. Tablas

### `requisiciones`
| Columna | Tipo | Notas |
|---|---|---|
| id | text PK | |
| folio | text UNIQUE | viene del Excel de Foodbot, ej. `REQ-2025-024` |
| sucursal | text | texto libre en v1; candidato a FK si se cataloga `sucursales` |
| fecha | date | fecha de **entrega** (Fase 2), no de alta |
| estatus | text | cache derivado: `pendiente_captura`\|`conciliada`\|`con_ajuste`\|`con_diferencias` — recalcular siempre desde `v_conciliacion`, no confiar en esta columna para lógica crítica |
| session_id | text FK → capture_sessions.id | nullable, sesión activa/última de captura |
| creado_en | timestamptz | |

### `renglones_foodbot`
Se crean junto con la requisición en Fase 1 (una fila = una fila del Excel).
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| requisicion_id | text FK → requisiciones.id | `ON DELETE CASCADE` |
| producto | text | |
| cantidad | numeric(10,3) | |
| costo | numeric(10,2) | costo unitario |
| cargado_en | timestamptz | |

### `renglones_reparto`
Se crean en Fase 2, a partir de la revisión del JSON de Claude Vision. **Inmutables.**
| Columna | Tipo | Notas |
|---|---|---|
| id | text PK | |
| requisicion_id | text FK → requisiciones.id | `ON DELETE CASCADE` |
| producto | text | |
| cantidad | numeric(10,3) | |
| unidad | text | `kg`\|`lt`\|`pz`\|`mz`\|`pq`\|`cja`\|`gr` |
| costo | numeric(10,2) | |
| origen | text | `almacen` (resaltado amarillo en hoja física) \| `cocina` (naranja, refrigerado) |
| confianza_ocr | numeric(4,3) | 0–1, null si se agregó/editó a mano |
| creado_en | timestamptz | |

### `ajustes`
Auditoría inmutable. Nunca se borra ni actualiza una fila existente.
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| renglon_id | text FK → renglones_reparto.id | |
| cantidad_anterior | numeric(10,3) | snapshot del valor original |
| cantidad_nueva | numeric(10,3) | valor corregido |
| motivo | text NOT NULL | obligatorio en UI |
| usuario | text | quién hizo el ajuste |
| creado_en | timestamptz | |

### `capture_sessions`
| Columna | Tipo | Notas |
|---|---|---|
| id | text PK | ej. `SESS-XXXXX`, generado en cliente |
| requisicion_id | text FK → requisiciones.id | **agregar esta columna** (el prototipo la referencia en comentarios pero el DDL v1 no la tiene — añadir antes de implementar) |
| estatus | text | `esperando_fotos`\|`fotos_recibidas`\|`procesando`\|`listo_para_revision`\|`completada`\|`expirada` |
| expira_en | timestamptz | `creado_en + 15 min` |
| creado_en | timestamptz | |

### `fotos_requisicion`
| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| session_id | text FK → capture_sessions.id | `ON DELETE CASCADE` |
| url_storage | text | path en bucket `requisicion-fotos` |
| procesada | boolean | true tras pasar por Claude Vision |
| creado_en | timestamptz | |

## 3. Vistas (ya en `schema.sql`)

- **`v_dashboard`** — una fila por requisición con `importe_total` y `total_ajustes`
  agregados. Base de las tarjetas KPI y del listado "Requisiciones recientes".
- **`v_conciliacion`** — una fila por renglón de reparto, con su match contra
  `renglones_foodbot` (`match_status`: `ok`\|`diferencia`\|`no_encontrado`\|`ajustado`) y
  el último ajuste aplicado (si existe). Base de la tabla de conciliación y del
  comparativo mes vs mes.

Para el **Comparativo**, agregar sobre `v_dashboard`/`v_conciliacion` agrupando por
`sucursal` + `date_trunc('month', fecha)`; nunca hacer `GROUP BY` que mezcle sucursales
en el mismo renglón de comparación.

## 4. Operaciones por acción de UI

| Acción en la UI | Operación |
|---|---|
| Subir Excel Foodbot + elegir sucursal (Fase 1) | Parsear Excel (SheetJS) → `INSERT requisiciones` (estatus `pendiente_captura`) → batch `INSERT renglones_foodbot` |
| Click "Capturar entrega" | `INSERT capture_sessions` (expira_en = +15min) → generar QR con URL `/captura-movil/:sessionId` |
| Página móvil sube fotos | Edge Function `crear-sesion-upload` valida sesión no expirada → URL firmada → `INSERT fotos_requisicion` → `UPDATE capture_sessions SET estatus='fotos_recibidas'` |
| Backend detecta `fotos_recibidas` | Edge Function `procesar-vision`: llama Claude (visión) con las fotos → JSON `{ renglones: [...] }` → `UPDATE capture_sessions SET estatus='listo_para_revision'` (payload cacheado o vía Realtime al cliente) |
| Desktop ve "listo para revisión" | Suscripción Realtime a `capture_sessions` por id → navega a pantalla de revisión con el JSON |
| Confirmar revisión ("Guardar entrega") | batch `INSERT renglones_reparto` (inmutable) → `UPDATE requisiciones SET fecha=...` → `UPDATE capture_sessions SET estatus='completada'` |
| Guardar un ajuste | Validar `motivo` no vacío → `INSERT ajustes` (nunca UPDATE/DELETE sobre `renglones_reparto`) |
| Dashboard / filtros | `SELECT * FROM v_dashboard WHERE fecha BETWEEN ... AND sucursal = ...` |
| Requisiciones (lista + expand) | `SELECT * FROM v_dashboard` + `SELECT * FROM v_conciliacion WHERE requisicion_id = ...` al expandir |
| Comparativo mes vs mes | Dos queries a `v_dashboard`/`v_conciliacion` agrupadas por sucursal, una por cada mes elegido, unidas en cliente por `sucursal` |

## 5. Contrato de salida de Claude Vision (Edge Function `procesar-vision`)

El prompt a Claude debe forzar **solo JSON**, sin texto adicional:

```json
{
  "renglones": [
    {
      "producto": "Aceite de ajonjolí",
      "cantidad": 5,
      "unidad": "lt",
      "costo": 180,
      "origen": "almacen",
      "confianza": 0.97
    }
  ]
}
```

- `origen`: inferir por el resaltado de la hoja física (amarillo = `almacen`, naranja =
  `cocina`) — indicarlo explícitamente en el prompt con ejemplos.
- `confianza`: 0–1, estimación del modelo sobre qué tan segura está la lectura de esa
  fila; la UI resalta en la tabla de revisión cualquier renglón con confianza < 0.87.
- Si el modelo no puede leer una fila, debe omitirla (no inventar) — el usuario puede
  agregar renglones manualmente en la pantalla de revisión (`confianza: null`).

## 6. RLS y seguridad (antes de producción)

- Habilitar RLS en todas las tablas de negocio; política base: `auth.role() = 'authenticated'`
  para SELECT/INSERT (un solo rol "almacen" en v1).
- `ajustes`: políticas `FOR UPDATE USING (false)` y `FOR DELETE USING (false)` — inmutable
  a nivel de base de datos, no solo de UI.
- `renglones_reparto`: mismo criterio — sin política de UPDATE/DELETE.
- La ruta móvil de captura **no autentica usuario**; su única puerta de acceso es el
  `session_id` validado por la Edge Function (uso de Service Role Key solo del lado del
  servidor, nunca expuesta al cliente). Verificar `expira_en > now()` en cada request.
- Bucket `requisicion-fotos`: privado, URLs firmadas de corta duración únicamente.

## 7. Migraciones sugeridas (orden)

1. `sucursales` (opcional/catálogo) — si se decide normalizar en vez de texto libre.
2. `requisiciones`
3. `renglones_foodbot`
4. `capture_sessions` (agregar `requisicion_id` respecto al DDL actual)
5. `fotos_requisicion`
6. `renglones_reparto`
7. `ajustes`
8. Vistas `v_dashboard`, `v_conciliacion`
9. RLS + políticas
10. Función `limpiar_sesiones_expiradas` + cron
