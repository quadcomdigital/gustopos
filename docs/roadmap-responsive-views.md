# Roadmap — Ottimizzazione responsive di tutte le viste (mobile / tablet / desktop)

> Stato: **bozza iniziale** — basata sull'analisi del codice al commit `8e2986b`.
> Obiettivo: ogni azione disponibile su desktop deve essere disponibile (o avere un equivalente esplicito)
> su mobile e tablet, con touch target ≥ 44px, niente scroll orizzontale del layout, e gerarchia chiara.
> Priorità: **P0** = azioni impossibili su mobile, **P1** = UX degradata / scroll orizzontale pesante, **P2** = rifiniture.

---

## 1. Principi guida (pattern comuni da adottare)

1. **Una vista = un'azione primaria per schermata su mobile** (già iniziato con UX-001..005: tabs mobile in Shifts/Purchasing/Fiscal).
2. **Tabella desktop → card mobile** (già fatto in Ingredients/Bom/Menu/Dashboard/Customers). Estendere ovunque manchi.
3. **Bottom sheet per modali di azione** su mobile (`items-end`, come già in BackofficeShell), mai dialog centrato piccolo.
4. **FAB / barra azioni sticky** per le azioni principali quando la lista scorre.
5. **Touch target ≥ 44×44px** su tutti i controlli interattivi mobile (già applicato in POS/checkout).
6. **Mai nascondere un'azione con `hidden md:block` senza un equivalente `md:hidden`** — è il bug P0 ricorrente.
7. **Tablet (md–lg, 768–1024)**: layout a 2 colonne o tabella con colonne collassabili via `hidden md:table-cell`; mai riutilizzare il layout phone.
8. **Test visivo** su 3 breakpoint: 375px (iPhone), 768px (iPad portrait), 1024px (iPad landscape/small desktop).

---

## 2. Stato attuale — vista per vista

### Shell & navigazione

| Vista | File | Stato | Priorità |
|---|---|---|---|
| Shell | `apps/web/src/app/backoffice/BackofficeShell.tsx` | **Buono**. Header responsive (brand desktop / pills POS mobile), sidebar desktop `md+`, bottom nav mobile 4+Altro, sheet "Altri moduli" per dominio. Modal mode/table picker già bottom-sheet. | ✅ |
| Router | `apps/web/src/app/router.tsx` | 14 rotte `/app/*` + variante `/:tenantSlug/app/*`. Nessun problema layout. | ✅ |

**Micro-gap shell**: in `BackofficeShell.tsx` il mode picker e il table picker usano `grid-cols-4` per i tavoli — su 375px i bottoni tavolo risultano ~80px, accettabili ma da controllare con 40+ tavoli (usare `grid-cols-3 sm:grid-cols-4`).

---

### Operazioni (sala)

| Vista | File | Stato | Priorità |
|---|---|---|---|
| POS | `apps/web/src/components/POSView.tsx` | **Buono**. `lg:hidden` mobile con search in header, FAB carrello `fixed bottom-24 right-4`, tab prodotti `grid-cols-2 sm:3 xl:4`, modali product `min-h-[44px]`. Da verificare: carrello mobile raggiungibile e checkout flow completo. | ✅/P1 |
| Tavoli | `apps/web/src/components/TablesView.tsx` | **Buono**. Griglia `grid-cols-2 sm:3 md:4 lg:6`, QR sheet dedicato, azioni via click sul tavolo. Da verificare che "ruota QR" e altre azioni per-tavolo abbiano equivalente mobile (no `hidden md:block` trovati). | ✅/P1 |
| Cucina | `apps/web/src/components/KitchenView.tsx` | **Buono**. Card ordini `grid-cols-1 sm:2 xl:3 2xl:4`, filtro zona/status in header, pulsanti azione full-width nelle card. | ✅ |
| Checkout | `apps/web/src/components/checkout/CheckoutMainView.tsx`, `CheckoutModal.tsx`, `CloseTableView.tsx` | **Buono**. Modal `max-w-3xl max-h-[95vh] flex flex-col`, griglie `grid-cols-2`, toggle fiscal nuovo. Verificare touch target dei pulsanti modal su mobile. | ✅/P1 |

---

### Magazzino (Inventory) — **il punto più critico segnalato**

| Vista | File | Stato | Priorità |
|---|---|---|---|
| Tabs | `apps/web/src/components/inventory/InventoryTabs.tsx` | **Buono**. Tabs desktop + **mobile scrollable sticky** (`md:hidden sticky top-0 z-30 ... overflow-x-auto`), summary cards responsive, chart. | ✅ |
| Ingredienti | `apps/web/src/components/inventory/IngredientsTab.tsx` | **Parziale — P0**. Desktop: tabella completa con azioni *Regola scorta / Variante / Modifica / Elimina / Movimenti / toggle attivo*. Mobile: card `divide-y` con **solo** Movimenti / Regola scorta / Modifica / toggle attivo. **Mancano su mobile: "Variante" (crea prep), "Elimina", bulk select, filtro low-stock è solo banner (ok)**. Aggiungere pulsante "Variante" e menu overflow "⋯" (Elimina/Dettagli) sulle card mobile. | 🔴 P0 |
| BoM | `apps/web/src/components/inventory/BomTab.tsx` | **Parziale — P1**. Card mobile con Modifica/Disattiva/Elimina (ok), ma **l'editor BoM (RecipeBuilder/ComponentPicker/ComponentTree) usa `grid-cols-1 md:grid-cols-5` e modali a 2/4 colonne**: su mobile l'aggiunta componenti e la gestione componenti richiede scroll e tocco su campi piccoli. Verificare con test manuale. | P1 |
| Menu | `apps/web/src/components/inventory/MenuItemsTab.tsx` | **Buono**. Card mobile `MenuCards` con Modifica Ricetta / Disattiva / Elimina a 44px. Editor ricetta (FoodProductModal, grid 3 colonne md) da verificare su mobile. | ✅/P1 |
| Preparazioni | `apps/web/src/components/inventory/PrepView.tsx` | **Buono (dopo refactoring)**. Righe variante `grid-cols-1 md:grid-cols-3`, input + bottone Prepara, errori inline. | ✅ |
| Categorie | `apps/web/src/components/inventory/CategoriesTab.tsx` | **Parziale — P1**. Filtri `grid-cols-1 md:grid-cols-4`, sezioni per scope con chip aree stampa. **Nessuna card mobile dedicata** ma la struttura a sezioni con griglia `grid-cols-1` in edit modal è probabilmente ok. Verificare: chip aree stampa su 375px. | P1 |
| Mod. Categoria | `apps/web/src/components/inventory/CategoryPoolEditor.tsx` | **Rischio P0/P1**. Editor complesso (pool + ingredienti + opzioni con righe flex, pulsanti `Aggiungi ingrediente/opzione`). **Nessun pattern mobile esplicito**: su mobile le righe opzione/ingrediente quasi certamente overflow o risultano illeggibili. Va rifatto a card/accordion mobile. | 🔴 P0 |
| Food Cost | `apps/web/src/components/inventory/FoodCostMatrixTab.tsx` | **P1 — scroll orizzontale**. Matrice `overflow-x-auto` con 9 colonne (Piatto, Categoria, Costo, Prezzo, Margine, %, Prezzo Cons., Stato, Dettaglio): su mobile scroll orizzontale pesante. Soluzione: card per piatto su mobile con riepilogo margini, o tabella con colonne collassabili (`hidden md:table-cell`) + dettaglio in drawer. | P1 |
| Product builder | `inventory/product-builder/*.tsx` (FoodProductModal, SimpleProductModal, VariableProductModal, EditComponentModal) | **Parziale — P1**. Griglie `grid-cols-1 md:grid-cols-3`, righe variabili `grid-cols-4`. Verificare modal su 375px; preferire bottom-sheet su mobile. | P1 |

---

### Finanza

| Vista | File | Stato | Priorità |
|---|---|---|---|
| Dashboard | `apps/web/src/components/DashboardView.tsx` | **Buono**. Card mobile `md:hidden` + tabella desktop; KPI `grid-cols-2 sm:3 lg:6`. | ✅ |
| Pagamenti | `apps/web/src/components/PaymentsView.tsx` | **Parziale — P1**. Tabella con colonne collassabili (`hidden md:table-cell` per Tavolo/Subtotale/Sconto/Maggiorazione). Il flusso Rimborso (modal dedicato) è wired e condiviso; **verificare che il trigger del rimborso resti raggiungibile su mobile** (colonna azioni sempre visibile, non collassata) e che il modal rimborso sia usabile a 375px. | P1 |
| Clienti | `apps/web/src/components/CustomersView.tsx` | **Buono**. Card mobile `md:hidden` con azioni + tabella desktop; dettaglio cliente è pagina dedicata `CustomerDetailPage`. | ✅ |
| Loyalty | `apps/web/src/components/LoyaltyView.tsx` / `LoyaltyWidget.tsx` | **Parziale — P2**. Nessun pattern mobile esplicito ma struttura card-based; `grid-cols-3` per punti. Verificare i form. | P2 |

---

### Amministrazione

| Vista | File | Stato | Priorità |
|---|---|---|---|
| Dipendenti | `apps/web/src/components/StaffView.tsx` | **Buono (card-based)**. La lista staff usa già card/righe (non tabella): ogni membro è una riga con ruolo/attivo e azioni inline (ruolo select, reset PIN). Griglie `md:grid-cols-5` solo per il form di creazione (grid-cols-1 su mobile). Verifica visiva 375px come rifinitura. | ✅/P2 |
| Prenotazioni | `apps/web/src/components/ReservationsView.tsx` | **Buono**. `renderReservationRow` riutilizzata in entrambi i layout; la sezione `hidden md:block` (riga 312) è solo l'"Elenco Completo Giorno" extra desktop. Azioni per-prenotazione condivise e raggiungibili. Rifinitura: verifica touch target su 375px. | ✅/P2 |
| Delivery | `apps/web/src/components/DeliveryView.tsx` | **Parziale — P1**. Filtri `overflow-x-auto no-scrollbar`, input `w-full`, card ordini. **Nessun pattern mobile esplicito** (0 match md:hidden/hidden md:block): struttura flex-col probabilmente ok, ma azioni per ordine (stato/dispatch) da verificare su 375px. | P1 |
| Acquisti | `apps/web/src/components/PurchasingView.tsx` | **Buono** (UX pass). Tabs mobile `md:hidden` con `mobileStep`, tabelle `overflow-x-auto` nei passi, pulsanti full-width mobile. | ✅ |
| Turni | `apps/web/src/components/ShiftsView.tsx` | **Buono** (UX pass). Tabs mobile clock/plan, griglie `sm:grid-cols-2/3`. | ✅ |
| Fiscale | `apps/web/src/components/FiscalExportsView.tsx` | **Buono** (UX pass). Tabs mobile Genera/Chiudi/Storico, pulsanti full-width mobile, nuova sezione printer. | ✅ |
| Impostazioni | `apps/web/src/components/SettingsView.tsx` + `print/PrintSettingsSection.tsx` | **Parziale — P1**. `SettingsView`: tabs tema/staff/stampa/tavoli con pulsanti in griglia (nessun pattern mobile esplicito — verificare che i 4 tab siano raggiungibili su mobile). `PrintSettingsSection`: griglie `md:grid-cols-2` ok, sezione logo/raster da verificare su mobile. Tabella tavoli (inline in Settings) → card su mobile? | P1 |
| Stampa | `apps/web/src/components/print/*` (PrintBridgesPanel, BridgeCard, wizard) | **Parziale — P2**. Grid `md:grid-cols-2 xl:3` per bridge; modali wizard da verificare su mobile. | P2 |
| Superadmin | `apps/web/src/pages/SuperadminPage.tsx` | Non analizzato in dettaglio — vista admin di sistema, usata da desktop; verificare solo che non sia rotto su tablet. | P2 |

---

## 3. Piano di esecuzione a fasi

### Fase 1 — P0: azioni impossibili su mobile (bloccanti)
1. **IngredientsTab**: aggiungere "Variante" (→ apre PrepView da ingrediente) e menu overflow "⋯" con Elimina/Dettagli sulle **card mobile** (`md:hidden` a riga ~825). Bulk select mobile resta escluso (documentare).
2. **CategoryPoolEditor**: refactoring mobile — pool come card/accordion, opzioni/ingredienti in lista verticale, pulsanti full-width, niente righe flex overflow.
3. **Audit automatable**: script/CI che vieta `hidden md:block` senza `md:hidden` gemello nelle stesse sezioni (o checklist manuale per ora).

### Fase 2 — P1: UX degradata su mobile/tablet
4. **FoodCostMatrixTab**: card mobile per piatto (margine/costo/prezzo/stato) + drawer dettaglio; desktop invariato.
5. **PaymentsView**: verificare colonna azioni su mobile; rendere rimborso esplicito su mobile (bottone in riga/card).
6. **StaffView / ReservationsView / DeliveryView**: card mobile per lista item + azioni a 44px.
7. **SettingsView**: tabs raggiungibili su mobile (scroll orizzontale o bottom tabs); tabella tavoli → card.
8. **BomTab editor / Product builder**: modali → bottom-sheet su mobile; campi a larghezza piena.
9. **POS/Tables/Checkout**: test manuale dei 3 breakpoint; sistemare touch target e `grid-cols-4` tavoli.

### Fase 3 — P2: rifiniture
10. **LoyaltyView**, print wizard, superadmin: allineamento ai pattern (card, touch target).
11. **Test di regressione**: tabella di conformità per-vista (azione ↔ breakpoint) da tenere aggiornata.
12. **Accessibilità**: focus ring, aria-expanded su accordion/bottom-sheet, contrasto.

---

## 4. Matrice di conformità (da aggiornare durante l'esecuzione)

| Vista | 375px | 768px | 1024px | Azioni complete su mobile? |
|---|---|---|---|---|
| POS | ✅ | ✅ | ✅ | ✅ |
| Tables | ⚠ test | ✅ | ✅ | ⚠ QR |
| Kitchen | ✅ | ✅ | ✅ | ✅ |
| Checkout | ⚠ test | ✅ | ✅ | ✅ |
| Ingredienti | 🔴 | ⚠ | ✅ | 🔴 manca Variante/Elimina |
| BoM | ⚠ | ⚠ | ✅ | ⚠ editor |
| Menu | ✅ | ✅ | ✅ | ✅ |
| Prep | ✅ | ✅ | ✅ | ✅ |
| Categorie | ⚠ | ✅ | ✅ | ✅ |
| Mod. Categoria | 🔴 | ⚠ | ✅ | 🔴 |
| Food Cost | ⚠ | ⚠ | ✅ | ⚠ scroll orizzontale |
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Pagamenti | ⚠ | ⚠ | ✅ | ⚠ rimborso |
| Clienti | ✅ | ✅ | ✅ | ✅ |
| Staff | ✅ | ✅ | ✅ | ✅ |
| Prenotazioni | ✅ | ✅ | ✅ | ✅ |
| Delivery | ⚠ | ⚠ | ✅ | ⚠ |
| Acquisti | ✅ | ✅ | ✅ | ✅ |
| Turni | ✅ | ✅ | ✅ | ✅ |
| Fiscale | ✅ | ✅ | ✅ | ✅ |
| Impostazioni | ⚠ | ⚠ | ✅ | ⚠ tab tavoli |
| Stampa | ⚠ | ⚠ | ✅ | ⚠ wizard |

Legenda: ✅ fatto/ok · ⚠ da verificare o parziale · 🔴 bloccante.

---

## 5. Note tecniche

- Breakpoint attuali del progetto: Tailwind default (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536). Lo shell usa `h-[100dvh]`, utile per evitare jump della URL bar mobile.
- Il refactoring è **puramente front-end** (`apps/web/src/components/*`) — nessuna modifica API/schema prevista.
- Il commit `8e2986b` contiene già il pass "mobile UX task-first (UX-001..005)" per Shifts/Purchasing/Fiscal/Dashboard/Customers: seguire lo **stesso stile** (tabs mobile sticky + pulsanti full-width) per coerenza.
- Prima di ogni fase: run `npm run lint` (typecheck) + verifica visiva sui 3 breakpoint.
