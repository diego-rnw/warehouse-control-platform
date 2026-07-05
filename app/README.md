# Control de Almacén — frontend

React + Vite + TypeScript. Ver `../SETUP.md` en la raíz del repo para desplegar el backend (Supabase) y este
frontend. Ver `../project/PROJECT.md` y `../project/SCHEMA.md` para el diseño funcional y el contrato de datos
completos.

## Estructura

```
src/
  lib/            supabase client, tipos, formateo, chips de estatus, parseo de Excel, QR
  context/        Auth, Theme, Data (fetch de v_dashboard/v_conciliacion), Tour
  components/      Nav, Layout, Tour, CaptureFlow (QR + revisión), AdjustmentForm, RequisicionRow
  pages/          Login, Dashboard, Requisiciones, Comparativo, CapturaMovil (ruta /captura-movil/:sessionId)
```

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — typecheck (`tsc -b`) + build de producción
- `npm run lint` — oxlint
