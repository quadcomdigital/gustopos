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
- **Feature flags**: per-tenant module toggles (`@FeatureFlagGuard`). Modules: kitchen, inventory, customers, analytics, printing, public_menu, public_takeaway, consumer_accounts, loyalty_points, self_order_qr, reservations, delivery, purchasing_suppliers, staff_shifts_timeclock, fiscal_exports, simple_catalog, public_group_order.
- **Realtime**: Socket.IO gateway (`RealtimeGateway`) with JWT handshake.
- **Printing**: separate `print-bridge` service (port 11905) using QZ Tray. API dispatches via `PRINT_BRIDGE_URL`.

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
- **PM2 production**: `pm2 start ecosystem.config.cjs`. HMR dev: `pm2 start ecosystem.hmr.config.cjs`.
