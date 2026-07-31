<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# GustoPOS Monorepo

Monorepo con frontend React e backend NestJS.

## Stack

- `apps/web`: React + Vite + React Router DOM
- `apps/api`: NestJS + Socket.IO + Auth (login staff + JWT) + Drizzle
- `packages/shared`: contratti Zod e tipi condivisi frontend/backend

## Requisiti

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

In alternativa puoi avviare database e redis con Docker Compose:
`docker compose up -d`

## Avvio locale

1. Installa dipendenze:
   `npm install`
2. Configura env API in `apps/api/.env` (puoi copiare da `apps/api/.env.example`)
3. Applica migrazioni DB:
   `npm run db:migrate --workspace @gustopos/api`
4. (Opzionale) configura endpoint API per il frontend in `apps/web/.env`:
   `VITE_API_URL="http://localhost:3001"`
5. Avvia web + api insieme:
   `npm run dev`

## Script utili

- `npm run lint` - typecheck di tutti i workspace
- `npm run build` - build di shared, api e web
- `npm run db:generate --workspace @gustopos/api` - genera nuove migrazioni Drizzle
- `npm run db:migrate --workspace @gustopos/api` - applica migrazioni su PostgreSQL

## Print Agent (Go)

- codice sorgente: `apps/print-agent-go/` (vedi `apps/print-agent-go/README.md`)
- download pubblici dei binari (Windows / Linux / macOS): **`/downloads/`** sul deployment web
- release e versioning: vedi `apps/print-agent-go/RELEASING.md`
- per pubblicare una nuova versione: `make linux windows darwin && make publish-downloads` (poi rebuild + deploy web)

## Sicurezza API

- `GET /api/auth/staff`, `POST /api/auth/login` e `POST /api/auth/refresh` sono pubblici
- `POST /api/auth/logout` e gli endpoint dominio sono protetti con `Bearer JWT`
- RBAC basato su metadata (`@Roles`) per i ruoli `admin`, `waiter`, `chef`
- handshake Socket.IO protetto con access token JWT
- CORS HTTP e Socket origin whitelist via `CORS_ORIGIN`

## Sessione JWT

- login restituisce `token` (access) + `refreshToken`
- access token breve durata (`ACCESS_TOKEN_TTL_SECONDS`, default 900s)
- refresh token ruotato a ogni refresh e persistito su tabella `auth_sessions`
- TTL refresh configurabile (`REFRESH_TOKEN_TTL_SECONDS`, default 604800s)

## Endpoint disponibili (fase 1-2)

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/data`
- `GET /api/payments` (admin)
- `POST /api/orders`
- `PATCH /api/orders/:id`
- `POST /api/tables/:id/pay`
- `POST /api/tables/:id/split-bill`
- `GET /api/staff` (admin)
- `POST /api/staff` (admin)
- `PATCH /api/staff/:id` (admin)
- `POST /api/staff/:id/reset-pin` (admin)
- `POST /api/staff/:id/disable` (admin)
- `POST /api/staff/:id/enable` (admin)
- `GET /api/health`

## Flussi waiter (fase attuale)

- `split bill`: `POST /api/tables/:id/split-bill` con payload `{ people }`
- `close table`: `POST /api/tables/:id/pay` con payload `{ method, paidAmount?, notes? }`
- `transfer table`: `POST /api/tables/:id/transfer` con payload `{ targetTableId }`
- metodi pagamento supportati: `cash`, `card`, `mixed`
- ogni chiusura conto persiste un record su tabella `payments`
- validazioni attive close table: totale > 0 e `paidAmount >= total`
- close table supporta anche `discountAmount` e `surchargeAmount` nel payload

## Magazzino BoM

- endpoint BoM:
  - `GET /api/bom` (admin, chef)
  - `POST /api/bom` (admin, chef)
  - `PATCH /api/bom/:id` (admin, chef)
  - `POST /api/bom/:id/components` (admin, chef)
- ogni ordine ora supporta consumo BoM multi-livello: i componenti BoM vengono esplosi su ingredienti reali e dedotti in transazione
- protezione stock: creazione ordine fallisce se un ingrediente richiesto è insufficiente
- in UI Inventory è disponibile editor BoM (creazione composto, aggiunta/rimozione componenti, attiva/disattiva)

## Vincoli operativi tavoli

- transfer tavolo bloccato verso target con stato `reserved`
- errori shortage stock restituiscono ingrediente e quantità richieste/disponibili

## Storico pagamenti admin

- endpoint: `GET /api/payments`
- query opzionali:
  - `from` (ISO datetime)
  - `to` (ISO datetime)
  - `method` (`cash|card|mixed`)
  - `staffId`
  - `limit` (1-500)
- risposta: elenco pagamenti con breakdown (`subtotal`, `discountAmount`, `surchargeAmount`, `total`)

## PM2

1. Build: `npm run build`
2. Start production profile (porte pubbliche): `pm2 start ecosystem.config.cjs`
3. Start development HMR profile (hot reload): `pm2 start ecosystem.hmr.config.cjs`
4. Persist startup: `pm2 save`
5. Auto reboot startup (systemd): `pm2 startup systemd -u <utente> --hp <home_utente>`

### Porte pubbliche configurate

- Web: `11900`
- API: `11901`

### Note operative HMR

- HMR attivo nel profilo `ecosystem.hmr.config.cjs`
- Web usa Vite in `dev` mode (non `preview`) per avere hot reload reale
- API usa `tsx watch` per reload automatico del backend in sviluppo
