# AGENTS.md — GustoPOS

Multi-tenant restaurant POS system. Monorepo: `apps/api` (NestJS), `apps/web` (React 19 + Vite), `apps/print-bridge` (Express), `packages/shared` (Zod contracts).

## Quick Commands

```bash
npm run dev          # Run api + web + print-bridge concurrently
npm run build        # Build shared → api → web → print-bridge (order matters)
npm run lint         # Typecheck all workspaces (tsc --noEmit)
npm test --workspace @gustopos/api          # API unit tests (tsx --test)
npm test --workspace @gustopos/print-bridge # Print-bridge tests
npm run db:generate --workspace @gustopos/api   # Generate Drizzle migrations
npm run db:migrate --workspace @gustopos/api    # Apply migrations to PostgreSQL
npm run db:provision --workspace @gustopos/api  # BRAND-NEW database: schema (push) + migration baseline
```

## Infrastructure

- **PostgreSQL 16** via docker-compose (port 5432), DB name `gustopos`
- **Redis 7** via docker-compose (port 6379)
- Start both: `docker compose up -d`
- API env: copy `apps/api/.env.example` → `apps/api/.env`, fill `DATABASE_URL`, `JWT_SECRET`

## Architecture

- **Multi-tenant**: every DB table has `tenant_id`. Tenant resolved via subdomain → slug → JWT → header (`TenantContextMiddleware`).
- **Shared contracts**: `packages/shared/src/contracts.ts` defines ALL Zod schemas used by both API and web. Changes to API request/response shapes MUST start here.
- **Roles**: `admin`, `waiter`, `chef`, `consumer`. RBAC via `@Roles()` decorator + `RolesGuard`.
- **Feature flags**: per-tenant module toggles (`@FeatureFlagGuard`). Modules: kitchen, course_rounds, inventory, customers, analytics, printing, public_menu, public_takeaway, consumer_accounts, loyalty_points, self_order_qr, reservations, delivery, purchasing_suppliers, staff_shifts_timeclock, fiscal_exports, simple_catalog, public_group_order.
  - Mutual exclusion: `inventory` ↔ `simple_catalog` (enabling one disables the other).
  - Dependencies ([child, parent] in `tenant/module-dependencies.ts`): `loyalty_points`→`customers`, `purchasing_suppliers`→`inventory`, `course_rounds`→`kitchen`. Disabling a parent (or its mutual-exclusion cascade) auto-disables children; enabling a child auto-enables its parent.
- **Print stations (dynamic)**: per-tenant `print_stations` registry (Cucina, Pizzeria, Bar, plus reserved `kind: "cashier"`). A product (`menu_items.station_id`) or category (`categories.station_id`) is assigned to exactly ONE station in Magazzino — explicit assignment only, no name/regex inference. Resolution order: product → category → tenant default station. Station `id` is the routing key in `print_jobs.area` and bridge `claimed_areas`/`mappings`. Endpoints: `GET/POST/PATCH/DELETE /api/print-stations`. Physical printer binding stays in Settings → Stampa.
- **Station tickets / portate**: on order creation (`createPrintJobsForOrder`) one combined ticket is generated per involved active station, containing the WHOLE order; the receiving station's items print 2xl (`doubleSize`) and other stations' items normal size, with time, waiter, order number and a summary block. `course_rounds` config (labels/required/enabled) is editable via `PUT /api/course-rounds/config`; rounds are validated for contiguity (start at 0, no gaps). Manual reprint: `POST /api/orders/:id/resend`.
- **Production references (conteggio contenitori)**: per-tenant catalog `production_references` (BUN, Piadina, Panino, A piatto…). Assignment is explicit (no name/regex inference): category default + product override + "main" modifier option override. Resolution precedence per order line: modifier (lowest `sort_order`) > product > category; quantity is 1:1. The **RIEPILOGO** block on production station tickets prints ONLY this container tally (helper `orders/production-references.ts`). Endpoints: `GET/POST/PATCH/DELETE /api/production-references`; config UI in Magazzino → tab "Referenze" + category/product/modifier selects.
  - In `simple_catalog` mode order creation skips stock tracking (no recipe explosion, no shortage checks, no deductions): see `orders/stock-tracking.ts`.
- **Realtime**: Socket.IO gateway (`RealtimeGateway`) with JWT handshake.
- **Printing**: separate `print-bridge` service (port 11905) using QZ Tray. API dispatches via `PRINT_BRIDGE_URL`.
- **Print diagnostics**: the Go agent (`apps/print-agent-go`) runs a loopback-only dashboard on `127.0.0.1:8183` (status/pairing/logs/jobs/export) and ships logs+health to `POST /api/print-bridge/diagnostics`; admins read them via `GET /api/print-bridge/:id/logs` and the Settings → Stampa panel. Retention: 7 days (`print_bridge_logs`).

## Key Files

- `apps/api/src/db/schema.ts` — Drizzle schema (single file, ~800 lines)
- `apps/api/src/repository/app.repository.ts` — monolithic data access layer (~9000 lines)
- `apps/api/src/app.module.ts` — NestJS root module
- `packages/shared/src/contracts.ts` — Zod schemas (source of truth for contracts)
- `apps/web/src/store/app-store.ts` — Zustand store (~1500 lines)
- `apps/web/src/app/router.tsx` — React Router routes
- `apps/web/src/app/backoffice/routes/module-routes.tsx` — module route definitions

## Dev Gotchas

- **Build order is strict**: shared → api → web → print-bridge. `npm run build` handles this; manual builds don't.
- **API is CommonJS**, web is ESM. Don't mix import styles.
- **`lint` = typecheck only** (`tsc --noEmit`). No ESLint configured.
- **No web tests** — only `tsc --noEmit` for type checking.
- **API tests use Node built-in test runner** (`tsx --test`), not Jest.
- **Port assignments**: Web=11900, API=11901, Print-bridge=11905. In production via PM2.
- **Stock deduction**: order creation deducts inventory via BoM explosion in a transaction. Stock check happens at order creation time — if insufficient, the order fails with ingredient details.
- **Split bill**: `POST /api/tables/:id/split-bill` with `{ people }`, then each share pays separately via `POST /api/tables/:id/pay`.
- **`@gustopos/shared`** is consumed by both API and web. API uses `require()` (CommonJS), web uses `import`.
- **Drizzle migrations**: edit `apps/api/src/db/schema.ts`, then `npm run db:generate --workspace @gustopos/api`. Never edit migration files directly.
- **Brand-new database**: `npm run db:migrate` does **not** work from scratch — it dies at `0029_brainy_johnny_blaze`, which re-creates tables `0008_vivid_console` already created (`0031`, `0033`, `0046`, `0049` and `0079_late_thunderbolts` also emit errors on an empty DB). Use `npm run db:provision` instead: `drizzle-kit push` builds the schema straight from `schema.ts` (69 tables) and `scripts/db-baseline.ts` marks the journal as applied — after that `npm run db:migrate` is a clean no-op and applies *future* migrations normally. Never edit an already-applied migration to make it idempotent: its sha256 is what `drizzle.__drizzle_migrations` records, and a changed hash makes `db:migrate` fail on every environment that already ran it.
- **PM2 production**: `pm2 start ecosystem.config.cjs`. HMR dev: `pm2 start ecosystem.hmr.config.cjs`.
