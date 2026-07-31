# 🚀 Audit Performance — GustoPOS

**Data:** 31 Luglio 2026
**Obiettivo:** Ridurre il refetch continuo, i payload sovradimensionati e i re-render inutili. **Focus esclusivo su performance** (non refactoring strutturale).

---

## 🎯 Il problema in una frase

Il sistema è progettato per il **realtime** (Socket.IO) ma implementato come se fosse **polling**: ogni mutazione lato server rigenera l'**intero dataset** e lo reinvia a tutti i client, e ogni mutazione lato client fa un **refetch completo** ridondante. Il risultato: **ogni singolo ordine genera ~40 query DB e un payload da decine di KB** inviato a tutti i dispositivi.

---

## 🔴 CRITICAL — I colli di bottiglia principali

### C1. `dataUpdate` via socket trasporta l'intero dataset (il problema #1)

**Dove:** `apps/api/src/app.controller.ts` — righe 1797-1798, 1845-1846, 1882-1883, 1929-1930, 1977-1978, 2009-2010

```ts
const publicData = await this.appRepository.getPublicData();   // 18+ query SQL
await this.realtimeGateway.emit(socketEvents.dataUpdate, publicData); // payload ENORME a TUTTI i socket
```

**Ogni** `voidOrder`, `closeTable`, `transferTable`, `splitBill`, `paySelectedItems`, `markShareAsPaid` rigenera l'intero dataset e lo invia a **tutti** i client connessi del tenant (POS, cucina, tablet).

**Costo di UNA singola operazione (es. `voidOrder`):**
1. `result.order` → emit `orderUpdate` (targeted ✅)
2. `getPublicData()` → **18+ query** (staff, tables, inventory, menu, ingredienti, BoM, ordini, orderItems, modificatori, pool, categorie, delivery…) → emit `dataUpdate` con payload completo ❌
3. `listInventoryItems()` → query + emit `inventoryUpdate` con **lista inventory completa** ❌
4. Il client riceve `dataUpdate` → sostituisce `data` → **12+ componenti** che ascoltano `s.data` fanno re-render.

**Fix proposto (priorità ASSOLUTA):**
- Per ordini/tavoli usare solo eventi **targeted** (`orderNew`, `orderUpdate`, `orderUpdate`/`tables:update`) — già emessi a riga 1726, 1748, 1767, 1796.
- **Eliminare l'emit `dataUpdate` full-payload dalle mutazioni.** Va emesso solo per cambi *strutturali* (menu, categorie, settings) o mai, in favore di eventi granulari.
- `inventoryUpdate` → emettere solo la lista ingredienti **modificata** o usare eventi `stock:update` per singolo ingrediente.

**Rischio:** Medio-Basso. **Punto critico concreto:** `closeTable`/`transferTable` cambiano lo stato dei **tavoli**, ma oggi non esiste alcun evento targeted `tables:update` (l'event map del gateway ha solo order/inventory/settings) e TablesView/POSView leggono `data.tables`. **Prima di eliminare `dataUpdate` dalle mutazioni, serve un nuovo evento `tables:update`** (o eventi per-dominio equivalenti), altrimenti si introduce stale state reale sui tavoli.

---

### C2. `getPublicData()` — il mostro a 18+ query

**Dove:** `apps/api/src/repository/app.repository.ts:1392`

```ts
const [staffRows, tableRows, inventoryRows, menuRows, ingredientLinks, menuBomLinks,
  orderRows, orderItemRows, mappedBomItems, modifierGroupRows, modifierOptionRows,
  modifierOptionOverrideRows, catPoolRows, catPoolOptionRows, catPoolCategoryRows,
  menuItemModifierRows, categoryRows, deliveryOrderRows] = await Promise.all([
  db.select().from(staff).where(...),           // TUTTI gli staff
  db.select().from(tables).where(...),          // TUTTI i tavoli
  db.select().from(inventory).where(...),       // TUTTO l'inventory
  db.select().from(menuItems).where(...),       // TUTTO il menu
  ... 14 query aggiuntive senza paginazione ...
]);
```

**Problemi:**
- **Nessuna paginazione** su nessuna tabella. `orderItems` scarica **tutti gli item di tutti gli ordini** del tenant.
- `mapBomItems()` (richiamata dentro) lancia altre 2 query su `bomItems` + `bomComponents` complete.
- `mapMenuItemsAdmin()` → 11 query complete.
- Il risultato viene `JSON.stringify`-ato, inviato su socket **e** su HTTP bootstrap, **ogni volta**.

**Fix proposto:**
- Limitare `orderRows`/`orderItemRows` agli **ordini aperti** (status ≠ paid/cancelled) — già filtrato su orders ma **non** su orderItems (riga ~1405: `db.select().from(orderItems).where(eq(orderItems.tenantId, tenantId))` senza filtro status).
- Proiettare solo le **colonne necessarie** (`select({ id, name, ... })`) invece di `select()` completo.
- `deliveryOrderRows` serve solo per `eta` → selezionare solo `orderId, eta` (già fatto ✅).

---

### C3. `fetchData()` client dopo ogni mutazione — ridondante col socket

**Dove:** `apps/web/src/store/app-store.ts`

| Righe | Azione | Dopo la chiamata |
|---|---|---|
| 1208 | `createOrder` | `fetchData()` completo |
| 1418 | `voidOrder` | `fetchData()` completo |
| 1439 | `payTable` | `fetchData()` completo |
| 1461 | `closeTable` | `fetchData()` + `fetchPayments()` |
| 1482 | `splitBill` | `fetchData()` + `fetchPayments()` |
| 1507 | `paySelectedItems` | `fetchData()` + `fetchPayments()` |
| 1531 | `markShareAsPaid` | `fetchData()` + `fetchPayments()` |
| 1560 | `transferTable` | `fetchData()` completo |

**Il paradosso:** il server **già emette** eventi socket dopo ogni mutazione (C1). Il client riceve il payload via socket **E poi fa un'ulteriore richiesta HTTP completa**. In pratica ogni azione POS genera **2 volte** il trasferimento dell'intero dataset (una via WS, una via HTTP) + 2 volte le query DB.

**Fix proposto:** Il client dovrebbe aggiornare lo store **ottimisticamente** (aggiornamento locale immediato), usare gli eventi socket come **conferma/riparazione** dello stato e chiamare `fetchData()` **solo** come fallback quando il socket non è connesso. **Attenzione all'ordine temporale:** fare affidamento solo sul round-trip socket aggiunge latenza percepita (il carrello si svuoterebbe quando arriva l'evento, non al click). L'optimistic update è la prima scelta; il socket conferma; il refetch HTTP è l'ultima rete di sicurezza.

**Rischio:** Medio — richiede che gli eventi socket coprano davvero tutti i casi (es. `closeTable` aggiorna anche tavoli e pagamenti).

---

### C4. Bootstrap monolitico su login

**Dove:** `apps/web/src/store/app-store.ts:941` (`fetchBootstrap`), `apps/api/src/repository/app.repository.ts:978` (`getBootstrapData`)

Alla **prima connessione di ogni utente** (anche un cameriere che usa solo la cucina):
- `getPublicData()` (18+ query)
- `listStaffPublic()`, `getUiSettings()`, `listStaffAdmin()`
- `listPayments({limit: 200})`, `listPrintJobs({limit: 100})`
- `listInventoryItems()`, `listBomItems()`, `listPrepItems()`, `listCategories()`, `listMenuItemsAdmin()` (11 query)
- `listCustomers({limit:100})`, `listOrderHistory({limit:200})`, `getCustomerAnalytics()`

**Un cameriere al POS scarica payments, orderHistory, analytics, customers e tutto l'inventory admin** — dati che non vede mai.

**Fix proposto:** Caricare **solo** i domini necessari al ruolo/modulo: `kitchen` → solo `getPublicData()` (alleggerita). I domini admin (analytics, inventory admin, customers…) si caricano **lazy** alla prima apertura della view (già esistono le `refresh*` per farlo — manca solo il trigger).

**Rischio:** Basso-Medio. Migliora drasticamente il tempo di primo render.

---

### C5. `realtime.gateway.ts` — log per socket + loop O(n)

**Dove:** `apps/api/src/realtime.gateway.ts:105-130`

```ts
for (const socket of this.server.sockets.sockets.values()) {
  console.log(`[realtime]   socket ${socket.id} modules=... allowed=...`); // LOG PER SOCKET
  if (allowed) socket.emit(event, payload);
}
```

Ogni emit con N dispositivi connessi produce **N log in produzione** e un loop O(n). Con 10 device + 6 eventi per ordine = 60 righe di log per ordine.

**Fix proposto:**
- Rimuovere i `console.log` dal gateway (o gating con `DEBUG=1`).
- Usare **rooms** (già usate per group-order) per i tenant: `socket.join('tenant:' + tenantId)` e `this.server.to(room).emit()` — O(1) con Socket.IO interno invece di loop manuale.

**Rischio:** Basso. Beneficio immediato su I/O e CPU.

---

## 🟡 WARNING — Secondo livello

### W1. View che refetchano a ogni mount senza TTL

| View | Righe | Comportamento |
|---|---|---|
| `ReservationsView.tsx` | 32 | `refreshReservations()` a ogni cambio data/filtro |
| `PurchasingView.tsx` | 62-63 | `refreshSuppliers` + `refreshPurchaseOrders` ({limit:200}) |
| `ShiftsView.tsx` | 47-48 | `refreshShifts` ({limit:300}) + `refreshTimeReport` |
| `DeliveryView.tsx` | 80 | `refreshDeliveryOrders` a ogni filtro |
| `FiscalExportsView.tsx` | 40 | `refreshFiscalExports` ({limit:200}) |

Navigazione avanti/indietro = **refetch ogni volta**, anche se i dati sono cambiati 5 secondi fa.

**Fix proposto:** Pattern stale-while-revalidate: se `lastFetchedAt` < N secondi, non rifetchare. Reintrodurre un campo `lastFetchedAt` per dominio (il pattern esiste già per `printBridgesLastFetchedAt`, `prepItemsLastFetchedAt`).

### W2. Subscriptions non selettive

- `BackofficeRouteGuard.tsx:20` — `useAppStore()` **senza selector**: si sottoscrive all'intero store e re-rendera a ogni `set()` (incluso ogni aggiornamento carrello/ordini). → `useAppStore((s) => s.currentUser)`.
- **OK:** la maggior parte usa `useAppStore((s) => s.data)` — corretto ma 12+ componenti (BackofficeEntry, BackofficeShell, 6 module-routes, 3 checkout views, KitchenView) re-renderano a ogni cambio di `data`. Da qui l'importanza di ridurre la frequenza di aggiornamento di `data` (C1/C3), più che lo split dello store.

### W3. Log di debug rimasti in produzione

- `POSView.tsx:170-178` — **4 `console.log('[POS DEBUG] data.menu …')`** a ogni render del POS (debug dimenticato).
- `socket.ts:20,24` — log connessione.
- `realtime.gateway.ts` — log per socket (vedi C5).
- `InventoryTabs.tsx:274` — `console.log('Create order for:', items)`.

**Fix:** Rimuovere (o gate con DEBUG). Gratis.

### W4. Polling client non ottimizzato

| File | Intervallo | Nota |
|---|---|---|
| `KitchenView.tsx:191` | 30s | `forceUpdate` per countdown — re-render completo ogni 30s; si può isolare il countdown in un sub-componente |
| `PrintBridgesPanel.tsx:33,53` | 30s | tick + refresh — accettabile ma da verificare se il socket `bridgeStatus` basta |
| `BridgeCard.tsx:57` | 15s | tick |
| `PrintStationWizard.tsx:96` | 1s | countdown pairing — OK (90s max) |

**Fix:** KitchenView: estrarre `<OrderCountdown>` con `useEffect` locale invece di `forceUpdate` sull'intera view.

### W5. Indici DB — verifica necessaria

Nella ricerca su `schema.ts` **non risultano `createIndex` espliciti** (solo PK). Le query filtrano quasi tutte per `tenantId` (+ status su orders/printJobs/payments). Con dati in crescita, `SELECT ... WHERE tenant_id = X AND status = Y` senza indice composto farà full scan.

**Fix proposto (verifica):** Indici compositi da aggiungere **in `schema.ts` con l'helper Drizzle `index()`** (es. `index('idx_orders_tenant_status').on(orders.tenantId, orders.status)`), poi `npm run db:generate --workspace @gustopos/api` per la migration. **Non** scrivere file SQL manuali: la convenzione del progetto (AGENTS.md) impone di modificare solo `schema.ts` e generare le migration con drizzle-kit.

```ts
// apps/api/src/db/schema.ts (esempio)
index('idx_orders_tenant_status').on(orders.tenantId, orders.status),
index('idx_order_items_tenant').on(orderItems.tenantId, orderItems.orderId),
index('idx_payments_tenant_created').on(payments.tenantId, payments.createdAt),
index('idx_print_jobs_tenant_status').on(printJobs.tenantId, printJobs.status),
index('idx_menu_items_tenant_active').on(menuItems.tenantId, menuItems.isActive),
```

---

## 🟢 OK — Cose che vanno bene

| Area | Valutazione |
|---|---|
| **persist middleware** | ✅ Già `partialize` su solo carrello/UI (`name: 'gustopos-cart'`, app-store.ts:2786) — nessun serializzazione di massa |
| **Selectors Zustand** | ✅ Pattern `useAppStore((s) => s.data)` diffuso (unica eccezione: BackofficeRouteGuard) |
| **Bootstrap parallelo** | ✅ `getBootstrapData` usa `Promise.all` — le query partono in parallelo |
| **Print bridge** | ✅ Heartbeat 30s + claim poll 3s: valori ragionevoli |
| **`fetchData` con Promise.all** | ✅ Le 18 query di `getPublicData` girano in parallelo |
| **Eventi targeted per ordini** | ✅ `orderNew`/`orderUpdate` esistono già — **vanno sfruttati al posto del `dataUpdate` full** |

---

## 📋 Matrice di priorità

| # | Intervento | Impatto | Rischio | Sforzo | Priorità |
|---|---|---|---|---|---|
| C5 | Rimuovere log + rooms nel realtime gateway | Riduce I/O e CPU lato API | Basso | 30 min | 🔴 ALTA |
| C3 | Rimuovere `fetchData()` post-mutazione (8 punti) | -50% trasferimento dati POS | Medio | 2-4 h | 🔴 ALTA |
| C1 | Eliminare `dataUpdate` full dalle mutazioni (6 punti) | -70% payload socket | Medio | 2-4 h | 🔴 ALTA |
| C2 | Limitare ordini/orderItems aperti + proiezione colonne | -60% dimensione payload core | Basso | 1-2 h | 🔴 ALTA |
| C4 | Bootstrap per-dominio (lazy per view admin) | -50% tempo primo render | Medio | 3-6 h | 🟡 MEDIA |
| W1 | TTL stale-while-revalidate nelle 5 view | -80% refetch a navigazione | Basso | 2-3 h | 🟡 MEDIA |
| W3 | Rimuovere log di debug | Gratis | Nullo | 10 min | 🟡 MEDIA |
| W2 | Fix selector BackofficeRouteGuard | Re-render ridotti | Nullo | 10 min | 🟡 MEDIA |
| W4 | Isolare countdown KitchenView | Re-render ridotti | Basso | 1 h | 🟢 BASSA |
| W5 | Indici compositi su ordini/orderItems/payments/print_jobs | Query più veloci con dati reali | Basso | 1 h | 🟢 BASSA |

---

## ⚡ Quick Wins (max 1 ora, impatto immediato)

1. **Rimuovere i 4 `console.log('[POS DEBUG]…')`** da `POSView.tsx:170-178` + `InventoryTabs.tsx:274`. (2 min)
2. **Fix `BackofficeRouteGuard.tsx:20`**: `useAppStore()` → `useAppStore((s) => s.currentUser)`. (2 min)
3. **Rimuovere i `console.log` dal `realtime.gateway.ts`** (righe 105-130, log per socket). (5 min)
4. **`orderItems` filtrati per ordini aperti** in `getPublicData()`. (30 min)
5. **Proiezione colonne** nelle query di `getPublicData()` (selezionare solo campi usati). (30 min)

---

## 🎯 Piano consigliato (2-3 sessioni)

**Sessione 1 — "Socket-first" (6-8 h):**
C5 → C3 → C1. Rendere il realtime l'unica fonte di aggiornamento per ordini/tavoli, con `fetchData` come fallback di disconnessione. Misurare: rete -60-70% nelle operazioni POS.

**Sessione 2 — "Payload leggero" (4-6 h):**
C2 → C4. Alleggerire `getPublicData` (ordini aperti, proiezione colonne) e rendere il bootstrap per-dominio con lazy load.

**Sessione 3 — "Caching & polish" (4-6 h):**
W1 (TTL) → W4 (countdown isolato) → W5 (indici) → W2/W3 (già nei quick wins).

---

## 📈 KPI da misurare dopo l'intervento

- **Richieste HTTP per ordine creato**: oggi 2 (fetchData + eventuale) → target 0-1.
- **Payload socket per mutazione**: oggi `data` completo (decine di KB) → target pochi KB (eventi targeted).
- **Query DB per mutazione**: oggi ~40 (stima: getPublicData 18+ + listInventory + client fetchData 18+, più le query di `createPrintJobsForOrder` e dell'emit `inventoryUpdate`) → target <10.
- **Tempo primo render (cold start)**: oggi bootstrap monolitico → target -50% con lazy load.
- **Log lines per ordine**: oggi ~60 (gateway per-socket) → target 0-2.

---

**Conclusione:** Il problema non è la struttura degli store ma il **doppio trasferimento dati** (socket full-payload + refetch HTTP) e il **payload sovradimensionato** (dataset completo senza filtri né proiezione). Gli interventi C1-C3 sono **collegati e vanno eseguiti insieme**: `dataUpdate` full-payload (C1) e `fetchData` post-mutazione (C3) si rispecchiano l'uno nell'altro; rimuoverne uno solo sposta il carico sull'altro. Intervenendo su C1-C3 si ottiene il 70-80% del beneficio senza toccare l'architettura. Il refactoring degli store è ortogonale: **non è necessario per la performance**.
