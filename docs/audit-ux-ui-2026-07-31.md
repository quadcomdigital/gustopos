# 🎨 Audit UX/UI — GustoPOS

**Data:** 31 Luglio 2026  
**Filosofia:** Misurare prima di intervenire. Identificare ciò che ha impatto reale sull'utente finale.

---

## 📏 Metriche Globali

| Metrica | Valore |
|---|---|
| Componenti totali | 136 file TSX |
| Righe totali UI | 27,597 |
| `className` Tailwind usati | **3,093** |
| `style={}` inline | **26** (0.8% — eccellente) |
| CSS totale (`index.css`) | **74 righe** (molto magro) |
| `<form>` elementi | **6** ❌ |
| `<button>` elementi | **474** |
| `<input> / <select> / <textarea>` | **285** |
| Modali / Dialog | **327 riferimenti** |
| Breakpoint responsive (`sm:/md:/lg:`) | **309** |
| Hover / Focus / Active states | **245** |
| Transizioni / Animazioni | **234** |
| Attributi `aria-` | **115** |
| Attributi `role` | **13** |
| `tabIndex` | **5** |
| `alt` su immagini | **3** ❌ |
| `localStorage` / `sessionStorage` | **72** |
| Loading states | **201** riferimenti |
| Error states | **457** riferimenti |
| Empty states | **96** riferimenti |

---

## 🟢 COSE CHE VANNO BENE

### 1. Libreria UI condivisa — Design System embrionale

Struttura `atoms/molecules/organisms` con 19 componenti:

| Livello | Componenti |
|---|---|
| **Atoms** | `Button`, `Field`, `EmptyState`, `Skeleton`, `StatusPill`, `SegmentedChips`, `FormField` |
| **Molecules** | `Modal`, `Drawer`, `Toast`, `SearchableSelect`, `UnitSelect`, `TabTemplate`, `SaveFooter`, `ContextToolbar`, `QuickActionBar`, `LoadingOrEmpty`, `SectionHeader`, `FormField` |
| **Organisms** | *(vuoto — opportunità per POS e Inventory)* |

**Punti di forza:**
- `Button`: 4 varianti (`primary`, `secondary`, `danger`, `ghost`) + 3 size + loading spinner integrato — **modello da seguire**
- `Modal`: focus trap, ESC handling, conferma "modifiche non salvate", animazioni spring — **eccellente**
- `Field`: render-prop pattern con `htmlFor` + `aria-describedby` automatici — **accessibilità nativa**
- `LoadingOrEmpty`: pattern riutilizzabile (skeleton → empty state) usato in 5+ componenti

### 2. Styling — Approccio consistente

- **Tailwind v4** con `@theme` custom: 10 variabili CSS (`--color-primary`, `--color-accent`, etc.)
- Solo **26 `style={}` inline** su 3,093 className — rapporto 0.8%, praticamente perfetto
- **74 righe di CSS totale**: solo utility essenziali (`no-scrollbar`, `panel-card`, `badge`, `animate-fadeIn`, scrollbar custom)
- **Zero CSS modules**, zero CSS-in-JS — unico sistema di styling
- **Codice-splitting**: `vendor-react`, `vendor-motion`, `vendor-charts`, `vendor-utils`
- **Nessun `useMediaQuery` o `useWindowSize`**: responsive design puramente CSS-driven (309 breakpoint usages)

### 3. Feedback utente — Buona copertura

- **201** riferimenti a loading states (skeleton, spinner, `LoadingOrEmpty`)
- **457** riferimenti a gestione errori (try/catch, `.error`, messaggi)
- **96** riferimenti a empty states (`EmptyState`, "nessun risultato")
- **Toast system** dual-mode: hook-based (`useToast`) + event-based (`pushToast`) per notifiche cross-component

### 4. Animazioni e micro-interazioni

- **234** transizioni/animazioni (`transition`, `animate`, `duration-`)
- **245** hover/focus/active states — ogni elemento interattivo ha feedback visivo
- `motion` (Framer Motion) per modali e drawer: spring animations, backdrop blur
- `active:scale-[0.98]` su tutti i pulsanti per feedback tattile

### 5. PWA e Offline

- `PwaInstallPrompt` con evento `beforeinstallprompt`
- `useWakeLock` per impedire lo spegnimento schermo durante la cassa
- `keepalive.worker.js` per mantenere la connessione Socket.IO
- `localStorage` usato per cache (`pwa-install-dismissed`, preferenze UI)

---

## 🟡 WARNING — Debito UX Moderato

### 1. Form non semantici — 6 `<form>` su 285 input

**Il problema:** Solo 6 elementi `<form>` in tutta l'app. Il resto sono `<div>` con `onClick` sui bottoni. Questo causa:
- **Nessun submit via Enter** — l'utente deve sempre cliccare
- **Nessuna validazione HTML5 nativa** (`required`, `pattern`, `type="number"`)
- **Nessun `form.reset()`** — i form non si puliscono automaticamente
- **Accessibilità limitata** — screen reader non riconoscono i form

**Raccomandazione:** Non serve rifare tutto. Priorità ai form più usati:
1. `POSView`: form aggiunta prodotto, quantità, note
2. Modali prodotto (`FoodProductModal`, `VariableProductModal`): form creazione/modifica
3. `SettingsView`: form impostazioni

**Costo:** ~2 ore per i 10 form più critici. **Impatto:** UX tangibile (Enter per submit, validazione nativa).

---

### 2. Immagini senza `alt` text — solo 3 `alt` su tutta l'app

**Il problema:** 3 attributi `alt` in 136 componenti è pochissimo. Le icone Lucide non hanno bisogno di `alt` (sono decorative), ma le immagini di prodotto, i QR code, e le icone in `EmptyState` dovrebbero averlo.

**Raccomandazione:** Aggiungere `alt` significativi su:
- QR code nella configurazione print station
- Icone negli `EmptyState` (nascoste con `aria-hidden="true"`)

**Costo:** 15 minuti. **Impatto:** Accessibilità base.

---

### 3. Nessuna Dark Mode

**Il problema:** Un POS acceso 12 ore al giorno con tema chiaro affatica la vista. Zero supporto dark mode.

**Raccomandazione:** Con Tailwind v4 e CSS custom properties, aggiungere dark mode è quasi gratis:
```css
@theme {
  --color-bg: #f7fafc;
  --color-text-main: #2d3748;
  /* ... */
}
@media (prefers-color-scheme: dark) {
  :root { --color-bg: #1a202c; --color-text-main: #e2e8f0; /* ... */ }
}
```
Poi aggiungere un toggle manuale in `SettingsView`.

**Costo:** ~3 ore. **Impatto:** Alto per ristoranti con luce bassa (sera).

---

### 4. Liste lunghe senza virtualizzazione

**Il problema:** `IngredientsTab` (1,190 linee) e `POSView` (1,096 linee) renderizzano liste potenzialmente lunghe (>100 ingredienti, >200 prodotti) senza virtualizzazione. Su dispositivi economici (tablet Android da cassa) può causare lag.

**Raccomandazione:** Se ci sono lamentele di performance:
- `react-window` per liste inventory
- Paginazione lato server per ordini storici

**Non implementare preventivamente.** Solo se misurato.

---

## 🟢 OK Confermato

| Cosa | Stato |
|---|---|
| **Consistenza tipografica** | `text-[10px] sm:text-xs font-bold uppercase tracking-widest` standardizzato |
| **Touch target** | `min-h-[44px]` su tutti i pulsanti (standard Apple HIG) |
| **Feedback tattile** | `active:scale-[0.98]` su bottoni, `active:scale-[0.97]` su card prodotto |
| **Scrollbar custom** | via `::-webkit-scrollbar` — raffinato |
| **Skeleton loading** | Componente `Skeleton` + `LoadingOrEmpty` riutilizzabile |
| **Toast** | Sistema dual-mode (hook + eventi), con action button, auto-dismiss |
| **Confirm dialogs** | `useConfirm` hook usato in 5 componenti inventory per eliminazioni |
| **Dirty state detection** | `useDirtyState` + badge "Modificato" nel Modal |
| **Focus trap** | Implementato in `Modal` e `Drawer` con tab cycling |
| **PWA** | Install prompt, wake lock, keepalive worker, QZ Tray integration |
| **Charts** | `recharts` disponibile, ma non ancora usato per grafici reali |
| **Motion** | Animazioni fluide via `motion` (Framer Motion) |

---

## 📊 Componenti più grossi — Analisi

| Componente | Linee | Dominio | Complessità |
|---|---|---|---|
| `IngredientsTab.tsx` | 1,190 | Inventory | Form + tabella + filtri + modalità bulk |
| `POSView.tsx` | 1,096 | POS | Griglia prodotti + carrello + checkout |
| `SettingsView.tsx` | 889 | Impostazioni | Multi-tab settings form |
| `MenuItemsTab.tsx` | 747 | Inventory | Menu item CRUD |
| `RecipeBuilder.tsx` | 700 | Inventory | Drag-drop costruttore ricette |
| `PurchasingView.tsx` | 688 | Acquisti | Ordini fornitori |
| `FoodProductModal.tsx` | 681 | Inventory | Modale prodotto complesso |
| `BomTab.tsx` | 657 | Inventory | Bill of materials |

**Nota:** Questi componenti sono grandi perché il dominio inventory/POS è intrinsecamente complesso. Non è "bloat" gratuito — c'è logica di business legittima. L'estrazione di sotto-componenti è possibile ma a basso impatto utente.

---

## 📋 Riepilogo Priorità

| # | Intervento | Impatto UX | Rischio | Costo |
|---|---|---|---|---|
| 1 | **Form semantici** (Enter per submit) | 🔴 ALTO | Basso | 2h |
| 2 | **Dark mode** (toggle in Settings) | 🔴 ALTO | Basso | 3h |
| 3 | **`alt` text su immagini** | 🟡 MEDIO | Nullo | 15min |
| 4 | **Virtual list** (solo se misurato lag) | 🟡 MEDIO | Medio | 4h |
| 5 | **`<fieldset>` + `<legend>`** nei form group | 🟢 BASSO | Nullo | 1h |
| 6 | **Keyboard shortcuts globali** (Ctrl+S, Esc, etc.) | 🟢 BASSO | Basso | 2h |

---

## 🎯 Quick Wins (30 minuti)

1. **`alt` text** su QR code + icone EmptyState: 15 minuti, accessibilità immediata
2. **Aggiungere `<form>` sul POSView checkout** per submit via Enter: 10 minuti
3. **Tema dark base** via `prefers-color-scheme`: 5 minuti (solo CSS, no toggle)

---

## 🧠 La Verità Onesta

La UI di GustoPOS è **sorprendentemente curata** per un progetto di questa scala:

- **Design system embrionale funzionante** (Button, Modal, Field, Toast, Skeleton)
- **Tailwind usato con disciplina** (3.093 className, 26 style inline)
- **Animazioni e micro-interazioni presenti** (234 transizioni, feedback tattile)
- **Loading/error/empty states coperti** (201+457+96 riferimenti)
- **PWA-ready** con wake lock e install prompt

Le criticità vere sono **poche e mirate**:
1. **Form non semantici** — l'unica cosa che peggiora l'esperienza quotidiana (niente Enter per submit)
2. **Dark mode assente** — importante per uso serale in ristorante

Il resto è **nice-to-have**. La UI non è "sloppy" — è pragmatica e funzionale.

---

**Conclusione:** A differenza del lato backend (dove l'estrazione dei repository era necessaria), il frontend è già in buono stato. Due interventi mirati (form semantici + dark mode) portano più valore di qualsiasi grande refactoring.
