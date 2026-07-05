# Control de Almacén — Rock n' Wok

Plataforma interna para que Almacén Central capture, concilie y audite las requisiciones de insumos entre
sucursales, Reparto y Almacén — reemplaza el cruce manual en Excel entre Foodbot y lo entregado en físico.

- **Qué es, roles, flujo de negocio, reglas no negociables** → [`project/PROJECT.md`](project/PROJECT.md)
- **Modelo de datos y contrato de operaciones** → [`project/SCHEMA.md`](project/SCHEMA.md)
- **Cómo desplegar (migraciones, Edge Functions, frontend)** → [`SETUP.md`](SETUP.md)
- **Origen del proyecto** (handoff del prototipo de Claude Design) → [`HANDOFF.md`](HANDOFF.md)

## Estructura

```
app/         Frontend — React + Vite + TypeScript
supabase/    Backend — migraciones SQL, RLS, Storage, Edge Functions (Deno)
project/     Diseño funcional y esquema de datos del proyecto original
chats/       Transcripciones de las decisiones de diseño (contexto histórico)
```

## Arranque rápido

```bash
cd app
npm install
cp .env.example .env   # llena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

Para el backend (migraciones + Edge Functions + secrets), ver [`SETUP.md`](SETUP.md).
