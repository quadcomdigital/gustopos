# 📊 Audit Codice — GustoPOS

**Data:** 31 Luglio 2026  
**Filosofia:** "Povera e pulita" — semplificare senza introdurre astrazioni

---

## 📏 Metriche Globali

| Workspace | File | Linee | % Totale |
|---|---|---|---|
| **API** (`apps/api`) | 75 | 20,426 | 40% |
| **Web** (`apps/web`) | 136 | 27,597 | 53% |
| **Shared** (`packages/shared`) | 24 | 2,729 | 5% |
| **Print-Bridge** (`apps/print-bridge`) | 3 | 916 | 2% |
| **Totale** | **238** | **51,668** | 100% |

---

## 🔴 CRITICAL — I 3 Monoliti Superstiti

### 1. `app.controller.ts` — 2.821 linee, 149 endpoint (76% di tutti gli endpoint)

**Il problema:** Un singolo controller gestisce print-bridge, ordini, menu pubblico, takeaway, group-order, self-order, settings, dashboard, inventory, purchasing, customers, loyalty, reservations, delivery, shifts, fiscal exports. È una `god class` da 149 endpoint.

**Endpoint per dominio (stimato):**
- PrintBridge: ~22 endpoint
- Ordini + Tabelle: ~30 endpoint  
- Public endpoints (menu, takeaway, self-order, group-order): ~25 endpoint
- Inventory / BoM / Prep: ~18 endpoint
- Customers / Loyalty: ~14 endpoint
- Settings / Dashboard / Bootstrap: ~12 endpoint
- Purchasing / Suppliers: ~12 endpoint
- Reservations / Delivery: ~12 endpoint
- Shifts / Fiscal: ~4 endpoint

**Raccomandazione:** Splittare in controller dedicati (basso rischio, già fatto per Bom/Staff/Tables):
```
apps/api/src/
  controllers/
    print.controller.ts        (~400 righe, 22 endpoint)
    orders.controller.ts       (~500 righe, 30 endpoint)  
    public.controller.ts       (~400 righe, 25 endpoint)
    inventory.controller.ts    (~350 righe, 18 endpoint)
    customers.controller.ts    (~250 righe, 14 endpoint)
    settings.controller.ts     (~200 righe, 12 endpoint)
    purchasing.controller.ts   (~250 righe, 12 endpoint)
    reservations.controller.ts (~250 righe, 12 endpoint)
    shifts-fiscal.controller.ts (~150 righe, 4 endpoint)
```
**Impatto:** `app.controller.ts` passerebbe da 2.821 → ~300 righe (solo bootstrap). **Priorità ALTA.**

---

### 2. `app-store.ts` — 2.795 linee, 300 metodi

**Il problema:** Zustand store monolitico. Ogni componente che usa `useAppStore()` si porta dietro tutto. Non c'è separazione per dominio.

**Metodi stimati per area:**
- POS / Ordini / Tabelle: ~60 metodi
- Inventory / BoM / Prep / FoodCost: ~70 metodi
- Customers / Loyalty: ~25 metodi
- Print / Bridge: ~20 metodi
- Settings / UI: ~15 metodi
- Purchasing / Suppliers: ~25 metodi
- Reservations / Delivery: ~25 metodi
- Shifts / Fiscal: ~15 metodi
- Dashboard / Operational: ~15 metodi
- Auth / Session: ~10 metodi
- PWA / WakeLock / Varie: ~20 metodi

**Raccomandazione:** Splittare in store slice. Zustand supporta nativamente `create` con slices:
```ts
// store/inventory-slice.ts
export const useInventoryStore = create<InventorySlice>((set, get) => ({...}))

// Oppure slices combinati in un unico store:
const useAppStore = create((...a) => ({
  ...createInventorySlice(...a),
  ...createPosSlice(...a),
  // ...
}))
```
**Impatto:** Migliore manutenibilità, tree-shaking automatico, riduzione re-render. **Priorità ALTA.**

---

### 3. `api/client.ts` — 2.558 linee, 172 metodi async

**Il problema:** Un unico file con 172 funzioni API. Ogni chiamata è `fetch()` con URL hardcoded, gestione errori ripetuta.

```typescript
// Pattern ripetuto 172 volte:
async listSomething(): Promise<Something[]> {
  const res = await fetch(`${BASE}/api/something`, { headers: this.headers() });
  if (!res.ok) throw new Error(`Failed to list something: ${res.status}`);
  return res.json();
}
```

**Raccomandazione:** Refactor con un wrapper fetch condiviso + organizzazione per dominio:
```ts
// shared/api/base.ts — wrapper comune con error handling, retry, timeout
// shared/api/inventory.ts — metodi inventory (20+)
// shared/api/orders.ts — metodi ordini (15+)
// shared/api/print.ts — metodi print (15+)
// ...
```
**Impatto:** -500 linee di boilerplate, error handling uniforme. **Priorità MEDIA.**

---

## 🟡 WARNING — Debito Tecnico Moderato

### 4. `app.repository.ts` — 4.063 linee (già ridotto da 10.400, -61%)

**Stato attuale:** 42 metodi rimanenti dopo l'estrazione di 13 domini. Blocco coeso:
- **Orders** (7 metodi): `createOrder`, `updateOrder`, `voidOrder`, etc. 
- **Public endpoints** (12 metodi): menu, takeaway, self-order, group-order
- **Settings/UI** (4 metodi): `getUiSettings`, `updateUiSettings`, `getBootstrapData`, `getPublicData`
- **Inventory leftovers** (6 metodi): BoM, Prep, conversions, audit
- **ESC/POS helpers** (4 metodi privati): `buildEscPosPayload`, etc.
- **Altro** (9 metodi): `getReorderSuggestions`, `getCategoryById`, `testPrintFromBridge`

**Valutazione:** Le dipendenze incrociate (Orders→Settings→ESC/POS→BoM) rendono un'ulteriore estrazione ad alto rischio/beneficio. **Mantenere unito è la scelta giusta.**

**Raccomandazione:** Pulizia interna solamente:
- Aggiungere `// ── SEZIONE: Orders ──` comment header per navigabilità
- Standardizzare i nomi dei metodi privati (alcuni hanno `private`, altri no)
- Valutare se `testPrintFromBridge` può finire in `print-bridge.repository.ts` (richiede `EscPosBuilder`)

**Priorità BASSA.**

---

### 5. `schema.ts` — 959 linee, 68 tabelle, 58 migration

**Il problema:** Singolo file con tutte le definizioni Drizzle. Ogni modifica crea una migration anche per tabelle non toccate.

**Raccomandazione:** Splittare per dominio (NON urgente — richiederebbe rigenerare TUTTE le migration):
```
db/schema/
  auth.ts
  orders.ts
  inventory.ts
  print.ts
  customers.ts
  ...
  index.ts  // re-exporta tutto
```
**Priorità BASSA** (richiede rebuild migration, grosso lavoro).

---

### 6. `contracts.ts` — 76 linee (hub) + 21 sub-file (2.511 linee)

**Stato:** ✅ Già ben organizzato. Il file `contracts.ts` è solo un barrel che re-esporta dai 21 sub-file. **Nessun intervento necessario.**

---

## 🟢 OK — Cose che vanno bene

| Area | Valutazione |
|---|---|
| **Repository pattern** | 16 repository file, ognuno < 2.500 righe. Ben separati. |
| **Contract sharing** | Zod schemas condivisi API ↔ Web via `@gustopos/shared`. Pattern solido. |
| **Test API** | 5 test file. Copertura su BoM explosion, ESC/POS, receipt labels, order-status, role-permissions. |
| **Console.log** | Solo 16 occorrenze. Molto pulito. |
| **TODO/FIXME** | Solo 1 TODO trovato. Debito tecnico esplicito quasi inesistente. |
| **`as any` casts** | Pochissimi, concentrati solo in `app.controller.ts` (type narrowing su `req`). |
| **Deep clone** | Solo 1 `JSON.parse(JSON.stringify(...))` in `FoodProductModal.tsx`. |
| **Print-bridge** | 3 file, 916 linee. Piccolo e ben isolato. |

---

## 🔵 Web Components — Analisi

### Componenti più grossi (>500 linee)

| Componente | Linee | Note |
|---|---|---|
| `IngredientsTab.tsx` | 1,190 | Inventory — il più grosso |
| `POSView.tsx` | 1,096 | POS principale |
| `SettingsView.tsx` | 889 | Impostazioni |
| `MenuItemsTab.tsx` | 747 | Menu inventory |
| `RecipeBuilder.tsx` | 700 | Costruttore ricette |
| `PurchasingView.tsx` | 688 | Acquisti/fornitori |
| `FoodProductModal.tsx` | 681 | Modale prodotto food |
| `BomTab.tsx` | 657 | Bill of Materials |
| `PrepView.tsx` | 557 | Preparazioni |
| `ModifierModal.tsx` | 556 | Modificatori |
| `KitchenView.tsx` | 521 | Vista cucina |
| `FoodCostMatrixTab.tsx` | 448 | Matrice food cost |
| `DashboardView.tsx` | 443 | Dashboard |

**Pattern:** Tutti i componenti sopra 400 righe sono nel dominio **inventory** o **POS**. Sono complessi per natura (form, tabelle, drag-drop).

**Raccomandazione:** Estrarre sotto-componenti per i form ripetitivi e per le tabelle. Esempio:
- `IngredientsTab` → `IngredientForm` + `IngredientTable` + `IngredientFilters`
- `POSView` → `POSCategoryBar` + `POSProductGrid` + `POSOrderPanel` + `POSCheckoutBar`

**Priorità MEDIA** (migliora manutenibilità ma richiede testing manuale sui componenti UI).

---

## 📋 Riepilogo Priorità

| # | Intervento | Impatto | Rischio | Priorità |
|---|---|---|---|---|
| 1 | Splittare `app.controller.ts` in 9 controller | **-2.500 linee nel file principale** | Basso (già fatto per Bom/Staff/Tables) | 🔴 ALTA |
| 2 | Splittare `app-store.ts` in Zustand slices | Migliore performance, manutenibilità | Medio (refactor store) | 🔴 ALTA |
| 3 | Refactor `api/client.ts` con wrapper condiviso | -500 linee boilerplate | Basso (nessuna logica) | 🟡 MEDIA |
| 4 | Estrarre sotto-componenti React (>400 righe) | Manutenibilità UI | Medio (richiede test UI) | 🟡 MEDIA |
| 5 | Pulizia interna `app.repository.ts` | Navigabilità | Basso | 🟢 BASSA |
| 6 | Splittare `schema.ts` in multi-file | Manutenibilità DB | Alto (richiede rebuild migration) | 🟢 BASSA |

---

## 🎯 Quick Wins (30 minuti, impatto immediato)

1. **Controller split:** `app.controller.ts` → estrarre subito `PrintController` (22 endpoint, già isolati)  
2. **API client wrapper:** Creare `shared/api/base.ts` con `apiGet<T>()`, `apiPost<T>()`, `apiPatch<T>()`, `apiDelete<T>()` e usarli nei primi 10 metodi
3. **Dead code cleanup:** Rimuovere `ts-morph` da devDependencies di API (aggiunto ma mai usato)

---

## 📈 Trend

| Data | AppRepository | AppController | AppStore | ApiClient |
|---|---|---|---|---|
| Pre-refactor | 10,400 | ~2,800 | 2,795 | 2,558 |
| 31 Lug 2026 | **4,063** (-61%) | 2,821 | 2,795 | 2,558 |
| Target | ~4,000 | **~300** | **~300*** | **~800*** |

*\*Target con split in file multipli (hub file ridotto, logica in file dedicati)*

---

**Conclusione:** Il refactoring dei repository è stato un successo (-61% del monolite principale). Ora il collo di bottiglia si è spostato su **controller** e **store**. Con la stessa disciplina applicata ai repository, si possono ridurre anche questi in 2-3 sessioni di lavoro.
