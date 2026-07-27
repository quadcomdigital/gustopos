# GustoPOS — Roadmap Tecnica di Verifica

Data: 2026-06-13
Stato: In sviluppo
Versione: 0.1.0

---

## Stack Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUSTOPOS MONOREPO (npm workspaces)           │
├──────────────────┬──────────────────┬──────────────────────────┤
│  apps/web        │  apps/api        │  apps/print-bridge       │
│  React 19        │  NestJS 11       │  Express 4               │
│  Vite 6          │  Drizzle ORM     │  ESC/POS spool           │
│  Zustand 5       │  Socket.IO 4     │  tsx                     │
│  Tailwind 4      │  JWT + RBAC      │                          │
│  Recharts 3      │  Redis (ioredis) │                          │
│  Motion 12       │  PostgreSQL 16   │                          │
├──────────────────┴──────────────────┴──────────────────────────┤
│  packages/shared — Zod 3.25 contracts + Socket.IO events       │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure: PostgreSQL 16 + Redis 7 (Docker Compose)      │
│  Process Mgmt: PM2 (ports 11900/11901/11905)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Matrice Gap Iniziale

### A. Sicurezza (P0) — SKIP in fase development

| # | Issue | File | Severità |
|---|-------|------|----------|
| S1 | JWT secret fallback `"dev-secret"` | `jwt-secret.ts:11` | CRITICO |
| S2 | Seed PIN hardcoded (1234, 2222, 3333) | `seed.ts:20-40` | CRITICO |
| S3 | JWT_SECRET placeholder in PM2 config | `ecosystem.config.cjs:13` | CRITICO |
| S4 | Nessuna verifica sessione revocata | `jwt-auth.guard.ts` | ALTO |
| S5 | Binding `0.0.0.0` su API/print-bridge | `main.ts:29`, `server.ts:41` | MEDIO |
| S6 | Math.random() per ID server-side | `app.repository.ts` | MEDIO |

### B. Qualità Codice / Type Safety (P1) — COMPLETATO

| # | Issue | Stato |
|---|-------|-------|
| Q1 | Frontend senza `strict: true` | ✅ COMPLETATO |
| Q2 | Nessun ESLint/Prettier | ⏳ Settimana 2 |
| Q3 | Backend TS options mancanti | ⏳ Settimana 3 |
| Q4 | Duplicate devDeps | ✅ COMPLETATO |
| Q5 | console.error senza structured logging | ✅ COMPLETATO |

### C. Testing (P0) — SKIP in fase development

### D. CI/CD (P1) — SKIP in fase development

### E. Architettura / Operativo (P1) — COMPLETATO

| # | Issue | Stato |
|---|-------|-------|
| A1 | Redis URL duplicato in 4 file | ✅ COMPLETATO |
| A2 | CORS parsing duplicato in 2 file | ✅ COMPLETATO |
| A3 | Empty catch blocks senza logging | ✅ COMPLETATO |
| A4 | window.alert in produzione | ✅ COMPLETATO |
| A5 | Moduli parziali (group_order, loyalty) | ⏳ Feature scope |
| A6 | Rate limit in-memory non distribuibile | ⏳ Settimana 2 |

### F. Finanziario / Compliance (P1) — DA IMPLEMENTARE

| # | Issue | Stato |
|---|-------|-------|
| F1 | Split bill non persistente/parziale | ⏳ Settimana 4 |
| F2 | Refund senza idempotency | ⏳ Settimana 3 |
| F3 | Fiscal export senza permissioni granulari | ⏳ Settimana 3 |
| F4 | Shifts/timeclock senza auto-update status | ⏳ Settimana 3 |

---

## Settimana 1 — COMPLETATA

### B-Q4: Hoist devDeps

**Obiettivo:** Eliminare duplicazione dipendenze dev tra workspace.

**Azioni eseguite:**
- Aggiunto alla root `devDependencies`: `typescript ~5.8.2`, `@types/node ^22.14.0`, `@types/express ^4.17.21`, `tsx ^4.21.0`
- Rimosso da `apps/api/package.json`: `typescript`, `@types/node`, `@types/express`, `tsx`
- Rimosso da `apps/web/package.json`: `typescript`
- Rimosso da `apps/print-bridge/package.json`: `typescript`, `@types/node`, `@types/express`, `tsx`
- Rimosso da `packages/shared/package.json`: `typescript`

**File modificati:**
- `/srv/gustopos/package.json`
- `/srv/gustopos/apps/api/package.json`
- `/srv/gustopos/apps/web/package.json`
- `/srv/gustopos/apps/print-bridge/package.json`
- `/srv/gustopos/packages/shared/package.json`

**Verifica:** `npm install` + `tsc --noEmit` su tutti i workspace → ✅ PASS

---

### E-A1: Centralizza Redis config

**Obiettivo:** Eliminare fallback Redis URL duplicato in 4 file.

**Azioni eseguite:**
- Creato `apps/api/src/config/redis.config.ts` con `getRedisUrl()`
- Aggiornato `public-menu.controller.ts` → import da config
- Aggiornato `tenant.service.ts` → import da config, rimosso `redisUrl` field
- Aggiornato `idempotency.middleware.ts` → import da config
- Aggiornato `pubsub.service.ts` → import da config, rimosso `redisUrl` field

**File creati:**
- `/srv/gustopos/apps/api/src/config/redis.config.ts`

**File modificati:**
- `/srv/gustopos/apps/api/src/public/public-menu.controller.ts`
- `/srv/gustopos/apps/api/src/tenant/tenant.service.ts`
- `/srv/gustopos/apps/api/src/tenant/idempotency.middleware.ts`
- `/srv/gustopos/apps/api/src/realtime/pubsub.service.ts`

**Verifica:** `tsc --noEmit` su API → ✅ PASS

---

### E-A2: Centralizza CORS parsing

**Obiettivo:** Eliminare funzione CORS parsing duplicata identica in 2 file.

**Azioni eseguite:**
- Creato `apps/api/src/config/cors.config.ts` con `parseCorsOrigins()`
- Aggiornato `main.ts` → import da config, rimossa funzione locale
- Aggiornato `realtime.gateway.ts` → import da config, rimossa funzione `parseSocketCorsOrigins`

**File creati:**
- `/srv/gustopos/apps/api/src/config/cors.config.ts`

**File modificati:**
- `/srv/gustopos/apps/api/src/main.ts`
- `/srv/gustopos/apps/api/src/realtime.gateway.ts`

**Verifica:** `tsc --noEmit` su API → ✅ PASS

---

### E-A3: Fix empty catch blocks

**Obiettivo:** Aggiungere logging ai catch vuoti per visibilità su errori silenziati.

**Azioni eseguite:**
- `idempotency.middleware.ts:57` — aggiunto `console.debug` per parse error su cached response
- `tenant-context.middleware.ts:74` — aggiunto `console.debug` per JWT extraction failure
- `tenant.service.ts:342` — aggiunto `console.debug` per module cache deserialization failure

**File modificati:**
- `/srv/gustopos/apps/api/src/tenant/idempotency.middleware.ts`
- `/srv/gustopos/apps/api/src/tenant/tenant-context.middleware.ts`
- `/srv/gustopos/apps/api/src/tenant/tenant.service.ts`

**Verifica:** `tsc --noEmit` su API → ✅ PASS

---

### B-Q5 + E-A4: Structured logger + Toast

**Obiettivo:** Sostituire `console.error` + `window.alert` con logger strutturato + toast system.

**Azioni eseguite:**
- Creato `apps/web/src/lib/logger.ts` con wrapper strutturato (timestamp, level, context)
- Sostituiti 2 `console.error` con `logger.error(...)` in `useImpersonationExit.ts`
- Sostituiti 2 `window.alert` con `pushToast('error', ...)` in `useImpersonationExit.ts`

**File creati:**
- `/srv/gustopos/apps/web/src/lib/logger.ts`

**File modificati:**
- `/srv/gustopos/apps/web/src/app/backoffice/hooks/useImpersonationExit.ts`

**Verifica:** `tsc --noEmit` su Web → ✅ PASS

---

### B-Q1: Frontend TypeScript Strict Mode

**Obiettivo:** Abilitare `strict: true` nel frontend e fixare tutti gli errori risultanti.

**Azioni eseguite:**
- Installato `@types/react` e `@types/react-dom` come devDeps nel web workspace
- Abilitato `strict: true` in `apps/web/tsconfig.json`
- Fixato `client.ts`: aggiunto return type `Record<string, string>` a `authHeaders()`, `tenantHeaders()`, `consumerAuthHeaders()`
- Fixato `module-routes.tsx`: rimosso prop `onUpdateIngredient` (dead prop), aggiunto optional chaining su `currentUser.permissions`
- Fixato `InventoryView.tsx`: corretto return type `createBom`, cast `printAreas` array
- Fixato `TenantMenuPage.tsx`: allargato tipo parametro `addToCart` per supportare `TakeawayCartItem`

**File modificati:**
- `/srv/gustopos/apps/web/package.json` (aggiunto @types/react, @types/react-dom)
- `/srv/gustopos/apps/web/tsconfig.json` (aggiunto `strict: true`)
- `/srv/gustopos/apps/web/src/shared/api/client.ts`
- `/srv/gustopos/apps/web/src/app/backoffice/routes/module-routes.tsx`
- `/srv/gustopos/apps/web/src/components/InventoryView.tsx`
- `/srv/gustopos/apps/web/src/pages/TenantMenuPage.tsx`

**Verifica:** `tsc --noEmit` su Web → ✅ PASS (0 errori, da 3727 con solo @types/react)

---

## Settimana 2 — PROSSIMA

### B-Q2: ESLint + Prettier

| Step | Azione | Effort |
|------|--------|--------|
| 1 | `npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh prettier` | 10 min |
| 2 | Creare `eslint.config.mjs` alla root | 30 min |
| 3 | Creare `.prettierrc` alla root | 5 min |
| 4 | Aggiungere script `lint` e `format` al root | 5 min |
| 5 | Eseguire `eslint --fix` + `prettier --write` | 40 min |

### B-Q1 step 3-5: Fix restanti strict errors (se presenti)

### E-A6: Rate limit distribuito (Redis)

| Step | Azione | Effort |
|------|--------|--------|
| 1 | Creare `apps/api/src/middleware/redis-rate-limit.ts` | 1-2h |
| 2 | Sostituire rate limit in-memory in public endpoints | 1-2h |

---

## Settimana 3

### B-Q3: Backend stricter TS options

| Step | Azione | Effort |
|------|--------|--------|
| 1 | Abilitare `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` | 5 min |
| 2 | Fixare errori risultanti | 3-6h |

### F-F3: Fiscal export hardening

| Step | Azione | Effort |
|------|--------|--------|
| 1 | Aggiungere `@RequiresPermissions("fiscal:export")` ai GET endpoints | 10 min |
| 2 | Calcolare checksum SHA-256 su export | 1h |
| 3 | Wrappare `closeFiscalDay` in transazione DB | 30 min |

### F-F4: Shifts/Timeclock hardening

| Step | Azione | Effort |
|------|--------|--------|
| 1 | Aggiungere `@RequiresPermissions` a shift endpoints | 10 min |
| 2 | Auto-update shift status su clock-in/out | 1-2h |
| 3 | Check `toleranceEarlyMin` su clock-out | 1h |
| 4 | Calcolare overtime nel timeReport | 1-2h |

### F-F2: Refund improvements

| Step | Azione | Effort |
|------|--------|--------|
| 1 | Marcare payment originale come refunded | 1-2h |
| 2 | Aggiungere idempotency key | 1h |
| 3 | Validare paymentStatus transitions | 2h |

---

## Settimana 4

### F-F1: Split bill parziale

| Step | Azione | Effort |
|------|--------|--------|
| 1 | Aggiungere colonna `split_group_id` a payments | 1h |
| 2 | Modificare `splitBill` per pagamento parziale | 3-4h |
| 3 | Endpoint "pay remaining shares" | 2-3h |
| 4 | UI: saldo residuo + pagamenti multipli | 4-6h |
| 5 | Audit event per payment parziale | 1h |

---

## KPI di Successo

| Metrica | Target |
|---------|--------|
| Zero credenziali in chiaro a riposo | ✅ (Phase 1) |
| Frontend strict mode | ✅ COMPLETATO |
| Test coverage flussi P0 | > 70% (Phase 2) |
| Linting errors | 0 (Phase 2) |
| Print failure recovery | > 90% (Phase 4) |
| Bundle size principale | < 500kb (Phase 5) |
| CI pipeline pass rate | > 95% (Phase 2) |

---

## File Modificati in Settimana 1

| File | Tipo Modifica |
|------|---------------|
| `package.json` (root) | Aggiunte devDeps hoisted |
| `apps/api/package.json` | Rimosse devDeps duplicate |
| `apps/web/package.json` | Rimosse devDeps, aggiunte @types/react |
| `apps/print-bridge/package.json` | Rimosse devDeps duplicate |
| `packages/shared/package.json` | Rimosse devDeps duplicate |
| `apps/api/src/config/redis.config.ts` | NUOVO — Redis config centralizzato |
| `apps/api/src/config/cors.config.ts` | NUOVO — CORS config centralizzato |
| `apps/web/src/lib/logger.ts` | NUOVO — Structured logger frontend |
| `apps/api/src/public/public-menu.controller.ts` | Import Redis da config |
| `apps/api/src/tenant/tenant.service.ts` | Import Redis da config, debug logging |
| `apps/api/src/tenant/idempotency.middleware.ts` | Import Redis da config, debug logging |
| `apps/api/src/tenant/tenant-context.middleware.ts` | Debug logging catch block |
| `apps/api/src/realtime/pubsub.service.ts` | Import Redis da config |
| `apps/api/src/main.ts` | Import CORS da config |
| `apps/api/src/realtime.gateway.ts` | Import CORS da config |
| `apps/web/tsconfig.json` | Aggiunto `strict: true` |
| `apps/web/src/shared/api/client.ts` | Fix type annotations |
| `apps/web/src/app/backoffice/routes/module-routes.tsx` | Fix dead prop, null safety |
| `apps/web/src/components/InventoryView.tsx` | Fix return type, type cast |
| `apps/web/src/pages/TenantMenuPage.tsx` | Fix type union |
| `apps/web/src/app/backoffice/hooks/useImpersonationExit.ts` | Logger + toast |
