# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Control de Almacen** — internal warehouse management platform for Rock n' Wok. Replaces manual Excel reconciliation between Foodbot (ordering system) and physical deliveries. Two-phase workflow: Excel upload (Phase 1) then photo capture via QR (Phase 2).

Detailed specs: `project/PROJECT.md` (business rules), `project/SCHEMA.md` (data model), `SETUP.md` (deployment).

## Commands

### Frontend (`app/`)

```bash
cd app
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run lint       # oxlint
npm run preview    # Preview production build
```

No test runner is configured — there are no test files in the project.

### Backend (Supabase)

```bash
npx supabase db push                                     # Apply all migrations
npx supabase functions deploy crear-sesion-upload         # Deploy edge function
npx supabase functions deploy procesar-vision
npx supabase functions deploy limpiar-sesiones-expiradas
npx supabase secrets set GEMINI_API_KEY=...               # Set secrets
```

## Architecture

### Frontend — `app/`

React 19 + Vite 8 + TypeScript 6 (strict) + React Router 7. No CSS framework — custom design system only (`src/styles/theme.css`).

**Routing** (`src/App.tsx`) — three auth zones:
- **Protected** (require Supabase session): `/dashboard`, `/requisiciones`, `/comparativo`
- **Login** — shown before session loads
- **No-auth mobile**: `/captura-movil/:sessionId` — session_id in URL is the only access control

**State** — four React context providers (`src/context/`):
- `AuthContext` — Supabase session, `login()`, `logout()`, `userLabel`
- `DataContext` — fetches `v_dashboard`, `v_conciliacion`, `renglones_foodbot`, `ajustes` on login; exposes `refresh()`
- `ThemeContext` — dark/light toggle with localStorage persistence
- `TourContext` — 8-step spotlight onboarding (auto-shows once, completion stored in localStorage)

**Key utilities** (`src/lib/`):
- `types.ts` — all TypeScript interfaces and enums mirroring DB entities and views
- `excel.ts` — SheetJS parser; accepts .xlsx/.xls/.csv up to 10 MB; flexible column detection (Folio|folio, Producto|producto, etc.)
- `format.ts` — money/qty/date formatters all use `es-MX` locale; `formatConfianza()` warns below 87% OCR confidence
- `chips.ts` — status badge styling; chip kinds: ok/warn/mut/pur; origin labels: ALMACÉN/COCINA
- `qr.ts` — generates 220px QR data URLs for session_id

**Key component**: `CaptureFlow.tsx` (406 lines) — modal orchestrating QR generation → Postgres Realtime subscription (no polling) → Vision extraction → review table → save.

### Backend — `supabase/`

Supabase: Postgres 17 + Auth + Storage + Realtime + Edge Functions (Deno).

**Database** — 11+ migrations in `supabase/migrations/`:
- Core tables: `requisiciones`, `renglones_foodbot`, `capture_sessions`, `fotos_requisicion`, `renglones_reparto`, `ajustes`
- Views: `v_dashboard` (1 row/requisicion, derived status), `v_conciliacion` (match_status per line)
- RLS enabled on all tables; `renglones_reparto` and `ajustes` are **immutable at the DB layer** via `FOR UPDATE USING (false)` RLS policies — not just UI convention
- `capture_sessions.estatus` lifecycle: `esperando_fotos` → `fotos_recibidas` → `procesando` → `listo_para_revision` → `completada` / `expirada`

**Edge Functions** (`supabase/functions/`):
- `crear-sesion-upload` — validates session expiry, uploads to `requisicion-fotos` bucket, triggers procesar-vision
- `procesar-vision` — calls **Gemini Vision API** (gemini-2.5-flash) for OCR; writes `renglones_reparto` (note: PROJECT.md references "Claude Vision" but implementation uses Gemini)
- `limpiar-sesiones-expiradas` — cron cleanup (15-min TTL); may need pg_cron workaround on free Supabase plans

### Data Flow

1. Upload Foodbot Excel → `requisiciones` + `renglones_foodbot` (status: `pendiente_captura`)
2. Generate QR → `capture_sessions` (15-min expiry)
3. Mobile user scans QR → uploads photos → `fotos_requisicion` + Storage bucket
4. Vision API extracts delivery lines → `renglones_reparto` (immutable)
5. Reconciliation view matches `renglones_reparto` vs `renglones_foodbot` → `match_status`
6. Corrections only via `INSERT ajustes` (never edit `renglones_reparto`)

## Key Business Rules

- **Status is always derived** from `v_dashboard`, never stored directly: `pendiente_captura` | `con_diferencias` | `con_ajuste` | `conciliada`
- **Immutable audit trail**: corrections go to `ajustes` with required `motivo`; enforced at DB level
- **Mobile route has no auth** — session_id TTL and signed Storage URLs are the only protection
- **Photos**: private Storage bucket `requisicion-fotos`, signed URLs only, 10 MB max

## Environment Variables

Frontend (`app/.env`):
```
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=anon-key
```

Edge Functions (Supabase secrets):
```
GEMINI_API_KEY
GEMINI_MODEL (default: gemini-2.5-flash)
```

Service Role Key and SUPABASE_URL are injected automatically by the Supabase runtime into edge functions.

## Styling

CSS custom properties in `src/styles/theme.css`. Dark theme is default. Brand colors: yellow `#FFCD02`, orange `#E84926`, teal `#29E7BC`. Text layers `--t1`–`--t9`. Row highlight vars `--row-lowc`/`--row-medc` for low/medium OCR confidence. Fonts: Monument Extended 800 (headings) + Montserrat variable (body).
