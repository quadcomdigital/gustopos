# Inventory Enterprise Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform inventory from a passive data list into an actionable decision-making tool, grounded in UX audit findings.

**Architecture:** 5 phases. Phase 0 (foundation) extracts shared components + fixes schema so subsequent phases can build on a clean base. Phases 1-4 are user-perceivable UX improvements ranked by impact.

**Tech Stack:** Drizzle ORM (PostgreSQL 16), NestJS, React 19, Tailwind CSS v4, motion/react, Zod, TypeScript.

## Global Constraints

- All DB migrations via `npm run db:generate` then `npm run db:migrate` in `apps/api`
- Never edit migration files directly — edit `schema.ts` then regenerate
- Italian locale for all user-facing strings
- All touch targets ≥44px (`min-h-[44px]`)
- API is CommonJS, web is ESM
- Shared contracts in `packages/shared/src/contracts.ts` are source of truth
- No new npm dependencies unless justified
- All changes must pass `npm run lint` and `npm test --workspace @gustopos/api`

---

## Audit Findings Reference

This plan is grounded in a UX audit of the inventory system. Each task references the audit finding it addresses. The audit identified these critical issues:

| ID | Finding | Severity |
|----|---------|----------|
| F1 | Summary cards show raw counts, no actionable insight | HIGH |
| F2 | "Valore" card shows selling prices, not inventory value | HIGH |
| F3 | "Sotto Soglia" card is a dead-end (not clickable) | HIGH |
| F4 | 6 tabs exceeds cognitive load (Miller's Law) | HIGH |
| F5 | BomTab and MenuItemsTab have no mobile layout (unusable on tablets) | HIGH |
| F6 | All action buttons look the same (no visual hierarchy) | HIGH |
| F7 | Delete is as prominent as edit | HIGH |
| F8 | No loading states anywhere | HIGH |
| F9 | Refresh button placement varies across tabs | MEDIUM |
| F10 | Category filtering only on IngredientsTab | MEDIUM |
| F11 | Empty states are plain text only | MEDIUM |
| F12 | Edit modal requires separate save per tab section | MEDIUM |
| F13 | No inline editing for simple fields | MEDIUM |
| F14 | Adjust stock modal lacks current quantity context | LOW |
| F15 | Print area labels use English ("kitchen", "bar") | LOW |
| F16 | Button colors inconsistent (bg-primary vs bg-accent) | LOW |
| F17 | Toggle patterns vary across tabs | LOW |
| F18 | No ARIA labels on interactive elements | MEDIUM |
| F19 | Color-only status indicators | MEDIUM |
| F20 | "Pool Mod" tab label is developer jargon | MEDIUM |
| F21 | Food Cost is not inventory (wrong section) | MEDIUM |

---

## Phase 0: Foundation — Design System + Schema

Prerequisite for all subsequent phases. Extracts shared components so Phases 1-4 can use them instead of inline code.

### Task 0.1: Extract FormField Atom

**Audit ref:** F6, F11, F17 — form field pattern repeated 50+ times with inconsistent label sizes (text-[9px] vs text-[10px]), error spacing, and toggle patterns.

**Files:**
- Verify/update: `apps/web/src/shared/ui/atoms/FormField.tsx`

- [ ] **Step 1: Read current FormField.tsx, ensure it exports correctly**
- [ ] **Step 2: Build, verify import**
- [ ] **Step 3: Commit**

---

### Task 0.2: Extract EmptyState Atom

**Audit ref:** F11 — all tabs use plain text for empty states. No icons, no CTAs. Enterprise empty states use icon + title + description + CTA.

**Files:**
- Create: `apps/web/src/shared/ui/atoms/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}
```

- [ ] **Step 1: Create EmptyState.tsx**
- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 0.3: Extract Button Atom

**Audit ref:** F6, F7, F16 — all action buttons look the same (same border, same size). Delete is as prominent as edit. CategoriesTab uses bg-primary while others use bg-accent.

**Files:**
- Create: `apps/web/src/shared/ui/atoms/Button.tsx`

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
// primary = bg-accent text-white (THE standard CTA)
// secondary = bg-white text-secondary border-border
// danger = bg-danger text-white (visually distinct from primary)
// ghost = transparent (for inline actions)
// All: min-h-[44px], font-bold uppercase tracking-wider, active:scale-[0.98]
```

- [ ] **Step 1: Create Button.tsx**
- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 0.4: Extract Skeleton Atom

**Audit ref:** F8 — no loading states. User sees "Nessun ingrediente configurato." while data loads — looks broken.

**Files:**
- Create: `apps/web/src/shared/ui/atoms/Skeleton.tsx`

- [ ] **Step 1: Create Skeleton.tsx with animated pulse rows**
- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 0.5: Extract SectionHeader Molecule

**Audit ref:** F9 — refresh button placement varies (header bar vs inside create form vs missing entirely).

**Files:**
- Create: `apps/web/src/shared/ui/molecules/SectionHeader.tsx`

```tsx
interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode; // Refresh button goes here
}
// Consistent: px-4 py-3 border-b border-border bg-bg/40
```

- [ ] **Step 1: Create SectionHeader.tsx**
- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 0.6: Fix Schema — FK Constraints + Unique Constraints

**Audit ref:** Data integrity (no orphan category references, no duplicate ingredient names).

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Add FK on inventory.category_id**

```typescript
category_id: text("category_id").references(() => categories.id, { onDelete: "set null" }),
```

- [ ] **Step 2: Add FK on bom_items.category_id**

```typescript
category_id: text("category_id").references(() => categories.id, { onDelete: "set null" }),
```

- [ ] **Step 3: Add FK on stock_movements.staff_id**

```typescript
staff_id: text("staff_id").references(() => staff.id, { onDelete: "set null" }),
```

- [ ] **Step 4: Add unique constraint on ingredient names per tenant**

```typescript
}, (t) => [
  index("inventory_tenant_idx").on(t.tenantId),
  index("inventory_category_idx").on(t.categoryId),
  uniqueIndex("inventory_tenant_name_idx").on(t.tenantId, t.name),
]);
```

- [ ] **Step 5: Generate migration + apply**

```bash
npm run db:generate --workspace @gustopos/api
npm run db:migrate --workspace @gustopos/api
```

- [ ] **Step 6: Run tests**

```bash
npm test --workspace @gustopos/api
```

- [ ] **Step 7: Commit**

---

### Task 0.7: Fix Schema — Add SKU Field

**Audit ref:** No unique identifier for ingredients beyond name.

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `packages/shared/src/contracts.ts`
- Modify: `apps/api/src/repository/app.repository.ts`

- [ ] **Step 1: Add sku column to inventory table**

```typescript
sku: text("sku"),
```

- [ ] **Step 2: Add to Zod schemas**

```typescript
// ingredientSchema: sku: z.string().nullable().optional()
// ingredientCreateRequestSchema: sku: z.string().min(1).optional()
// ingredientUpdateRequestSchema: sku: z.string().min(1).nullable().optional()
```

- [ ] **Step 3: Update repository CRUD to include sku**
- [ ] **Step 4: Generate migration, build, test**
- [ ] **Step 5: Commit**

---

### Task 0.8: Fix Schema — Unify Quantity Precision

**Audit ref:** inventory.quantity uses numeric(12,2) but BOM uses numeric(12,3). Rounding drift.

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Change inventory quantity fields to numeric(12,3)**

```typescript
quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
min_threshold: numeric("min_threshold", { precision: 12, scale: 3 }).notNull(),
unit_cost: numeric("unit_cost", { precision: 12, scale: 3 }).notNull().default("0"),
sale_price: numeric("sale_price", { precision: 12, scale: 3 }),
```

- [ ] **Step 2: Generate migration, build, test**
- [ ] **Step 3: Commit**

---

### Task 0.9: Fix Schema — Add Audit Trail for Inventory Edits

**Audit ref:** Stock adjustments have audit trail but editing name/cost/threshold has no record.

**Files:**
- Modify: `apps/api/src/db/schema.ts` (new `inventory_audit` table)
- Modify: `apps/api/src/repository/app.repository.ts` (updateInventoryItem)

- [ ] **Step 1: Create inventory_audit table**

```typescript
export const inventoryAudit = pgTable("inventory_audit", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  inventoryId: text("inventory_id").notNull().references(() => inventory.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("inventory_audit_tenant_idx").on(t.tenantId),
  index("inventory_audit_item_idx").on(t.inventoryId),
]);
```

- [ ] **Step 2: Add audit logging to updateInventoryItem method**
- [ ] **Step 3: Add GET /api/inventory/:id/audit endpoint**
- [ ] **Step 4: Generate migration, build, test**
- [ ] **Step 5: Commit**

---

### Task 0.10: Batch Stock Deduction Queries

**Audit ref:** Performance — createOrder runs N individual UPDATE + N individual INSERT.

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (createOrder, lines ~4359-4382)

- [ ] **Step 1: Replace individual UPDATE+INSERT loop with Promise.all batch**

```typescript
// Batch UPDATE
await Promise.all(inventoryUpdates.map((u) =>
  tx.update(inventory)
    .set({ quantity: String(u.newQty) })
    .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, u.ingredientId)))
));

// Batch INSERT movements
await tx.insert(stockMovements).values(inventoryUpdates.map((u) => ({
  id: crypto.randomUUID(),
  tenantId,
  ingredientId: u.ingredientId,
  orderId: order.id,
  movementType: "order_deduction" as const,
  quantity: String(-u.consumed),
  previousQuantity: String(u.currentQty),
  newQuantity: String(u.newQty),
  notes: `Order ${order.id}`,
  staffId: order.staffId ?? null,
})));
```

- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

---

## Phase 1: Dashboard — From Data List to Decision Tool

The single highest-impact change. Replaces the 4 static count cards with an actionable dashboard.

### Task 1.1: Fix "Valore" Card — Show Real Inventory Value

**Audit ref:** F2 — "Valore" card shows sum of menu item SELLING PRICES, not inventory value. A restaurant owner seeing "€1,250" thinks that's their stock cost. It's actually their menu revenue potential. Misleading.

**Files:**
- Modify: `apps/web/src/components/inventory/InventoryTabs.tsx` (lines 230-243)

- [ ] **Step 1: Fix the Valore card calculation**

```tsx
// BEFORE (misleading):
`€${menuItems.filter((item) => item.isActive).reduce((sum, item) => sum + item.price, 0).toFixed(2)}`

// AFTER (real inventory value):
`€${inventory.reduce((sum, item) => sum + (item.quantity * (item.unitCost ?? 0)), 0).toFixed(2)}`

// Also rename label from "Valore" to "Valore Magazzino"
```

- [ ] **Step 2: Build, verify the number makes sense**
- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/inventory/InventoryTabs.tsx
git commit -m "fix(inventory): show real inventory value (qty × unit_cost) instead of selling prices"
```

---

### Task 1.2: Add Reorder Suggestions Backend

**Audit ref:** F3 — "Sotto Soglia" card is a dead-end. No system suggests what to reorder or from which supplier.

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`
- Modify: `apps/api/src/app.controller.ts`
- Modify: `packages/shared/src/contracts.ts`

- [ ] **Step 1: Add getReorderSuggestions method**

```typescript
async getReorderSuggestions(): Promise<Array<{
  ingredientId: string;
  name: string;
  sku: string | null;
  currentQty: number;
  minThreshold: number;
  unit: string;
  deficit: number;
  preferredSupplierName?: string;
  lastUnitCost?: number;
}>> {
  const tenantId = getTenantIdOrDefault();
  return db.select({
    id: inventory.id,
    name: inventory.name,
    sku: inventory.sku,
    quantity: inventory.quantity,
    minThreshold: inventory.minThreshold,
    unit: inventory.unit,
    unitCost: inventory.unitCost,
    supplierName: suppliers.name,
  })
  .from(inventory)
  .leftJoin(supplierIngredients, and(
    eq(supplierIngredients.ingredientId, inventory.id),
    eq(supplierIngredients.isPreferred, 1),
  ))
  .leftJoin(suppliers, eq(suppliers.id, supplierIngredients.supplierId))
  .where(and(
    eq(inventory.tenantId, tenantId),
    eq(inventory.isActive, 1),
    lte(inventory.quantity, inventory.minThreshold),
  ))
  .then((rows) => rows.map((r) => ({
    ingredientId: r.id,
    name: r.name,
    sku: r.sku,
    currentQty: Number(r.quantity),
    minThreshold: Number(r.minThreshold),
    unit: r.unit,
    deficit: Number(r.minThreshold) - Number(r.quantity),
    preferredSupplierName: r.supplierName ?? undefined,
    lastUnitCost: r.unitCost != null ? Number(r.unitCost) : undefined,
  })));
}
```

- [ ] **Step 2: Add GET /api/inventory/reorder-suggestions endpoint**
- [ ] **Step 3: Add Zod schema for response**
- [ ] **Step 4: Build, test**
- [ ] **Step 5: Commit**

---

### Task 1.3: Build Low-Stock Alert Dashboard Card

**Audit ref:** F1, F3 — Summary cards show raw counts with no actionable insight. "Sotto Soglia: 3" should become an expandable alert showing item names, deficits, preferred suppliers, and a one-click "Crea Ordine" button.

**Files:**
- Create: `apps/web/src/components/inventory/LowStockAlert.tsx`
- Modify: `apps/web/src/components/inventory/InventoryTabs.tsx`

**Design:**
```
┌─────────────────────────────────────────┐
│ ⚠ 3 articoli sotto soglia              │
│                                         │
│ Farina 00    2 kg / 10 kg   -8 kg  €2.50│
│ Mozzarella   1 kg / 5 kg    -4 kg  €8.00│
│ Pomodoro     3 kg / 8 kg    -5 kg  €1.20│
│                                         │
│ Totale stimato: €38.40                  │
│                                         │
│ [Crea Ordine Acquisto →]                │
└─────────────────────────────────────────┘
```

- [ ] **Step 1: Create LowStockAlert.tsx component**
- [ ] **Step 2: Replace the static "Sotto Soglia" count card with the alert component**
- [ ] **Step 3: Wire "Crea Ordine" to navigate to PurchasingView with pre-filled data**
- [ ] **Step 4: Build, verify full flow**
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/LowStockAlert.tsx apps/web/src/components/inventory/InventoryTabs.tsx
git commit -m "feat(inventory): add low-stock alert dashboard with deficit details and reorder CTA"
```

---

### Task 1.4: Add Stock Level Bar Chart

**Audit ref:** F1 — no visual overview of stock health. Users must read every row to find problems.

**Files:**
- Create: `apps/web/src/components/inventory/StockLevelChart.tsx`
- Modify: `apps/web/src/components/inventory/InventoryTabs.tsx`

**Design:** Horizontal bar chart showing each ingredient's stock as a percentage of its threshold. Green = above threshold, amber = near threshold, red = below threshold. Pure SVG, no library.

```
Farina 00    ████████████░░░░  12/10 kg (120%)
Mozzarella   ██████░░░░░░░░░░   3/5 kg  (60%) ⚠
Pomodoro     ███░░░░░░░░░░░░░   2/8 kg  (25%) 🔴
Olio         ████████████████  20/5 kg (400%)
```

- [ ] **Step 1: Create StockLevelChart.tsx with SVG bars**
- [ ] **Step 2: Add to InventoryTabs above the tab content (collapsible)**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/inventory/StockLevelChart.tsx apps/web/src/components/inventory/InventoryTabs.tsx
git commit -m "feat(inventory): add stock level bar chart for visual inventory overview"
```

---

## Phase 2: Mobile/Tablet Parity

BomTab and MenuItemsTab are unusable on 768px tablets — the primary POS device form factor.

### Task 2.1: Add Mobile Card Layout to BomTab

**Audit ref:** F5 — BomTab renders `<table>` for ALL viewports. On tablets, table overflows horizontally. Users cannot use BomTab on the device they actually have.

**Files:**
- Create: `apps/web/src/components/inventory/BomCards.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

**Mobile card design:**
```
┌─────────────────────────────┐
│ ▸ Impasto Pizza             │
│   Resa: 5 kg · Costo: €2.30│
│   [Attivo] [Modifica] [−]  │
└─────────────────────────────┘
Expanded:
│ Componenti:                 │
│  INGRED Farina · 2 kg      │
│  INGRED Acqua · 3 L        │
│ [Modifica] [Elimina]        │
```

- [ ] **Step 1: Create BomCards.tsx with expand/collapse**
- [ ] **Step 2: Add `md:hidden` wrapper in BomTab**
- [ ] **Step 3: Wrap existing table in `hidden md:block`**
- [ ] **Step 4: Build, verify tablet layout**
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/BomCards.tsx apps/web/src/components/inventory/BomTab.tsx
git commit -m "feat(inventory): add mobile card layout to BomTab for tablet usability"
```

---

### Task 2.2: Add Mobile Card Layout to MenuItemsTab

**Audit ref:** F5 — Same issue. MenuItemsTab table overflows on tablets.

**Files:**
- Create: `apps/web/src/components/inventory/MenuCards.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`

**Mobile card design:**
```
┌─────────────────────────────┐
│ Margherita                  │
│ Pizza · €8.00               │
│ [Attivo] [kitchen] [bar]    │
│ [Modifica Ricetta] [Elimina]│
└─────────────────────────────┘
```

- [ ] **Step 1: Create MenuCards.tsx**
- [ ] **Step 2: Add mobile wrapper to MenuItemsTab**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

### Task 2.3: Fix Refresh Button — All Tabs, Header Bar

**Audit ref:** F9 — IngredientsTab has refresh in header. BomTab has it hidden inside create form. MenuItemsTab has none. CategoriesTab has it inside create form. Users can't reliably find refresh.

**Files:**
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Add SectionHeader with Refresh to BomTab**
- [ ] **Step 2: Add SectionHeader with Refresh to MenuItemsTab**
- [ ] **Step 3: Add SectionHeader with Refresh to CategoriesTab**
- [ ] **Step 4: Remove old refresh buttons from create form areas**
- [ ] **Step 5: Build, verify all tabs have consistent refresh**
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/inventory/BomTab.tsx apps/web/src/components/inventory/MenuItemsTab.tsx apps/web/src/components/inventory/CategoriesTab.tsx
git commit -m "feat(inventory): add consistent refresh button to all inventory tabs via SectionHeader"
```

---

### Task 2.4: Add Category Filtering to BomTab and MenuItemsTab

**Audit ref:** F10 — SegmentedChips for category filtering exists on IngredientsTab but not on BomTab (50+ items, text search only) or MenuItemsTab (50+ items, text search only).

**Files:**
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`

- [ ] **Step 1: Add SegmentedChips + category filtering to BomTab**

```typescript
const bomCategories = useScopedCategories(categories, 'bom');
const [filterCategoryId, setFilterCategoryId] = useState('');

const chipOptions = useMemo(() => {
  const counts = new Map<string, number>();
  for (const item of bomItems) {
    const catId = item.categoryId ?? '__none__';
    counts.set(catId, (counts.get(catId) ?? 0) + 1);
  }
  return [
    { value: '', label: 'Tutte', badge: bomItems.length },
    ...bomCategories.map((c) => ({ value: c.id, label: c.name, badge: counts.get(c.id) ?? 0 })),
  ];
}, [bomItems, bomCategories]);
```

- [ ] **Step 2: Add SegmentedChips between search and table in BomTab**
- [ ] **Step 3: Same pattern for MenuItemsTab (menu categories)**
- [ ] **Step 4: Build, verify**
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/BomTab.tsx apps/web/src/components/inventory/MenuItemsTab.tsx
git commit -m "feat(inventory): add category chip filtering to BomTab and MenuItemsTab"
```

---

## Phase 3: Interaction Improvements

### Task 3.1: Add Loading Skeletons to All Tabs

**Audit ref:** F8 — no loading states. User sees "Nessun ingrediente configurato." while data loads — looks broken.

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Add `loading?: boolean` prop to each tab component**
- [ ] **Step 2: When loading && data.length === 0, show 5 Skeleton rows instead of empty text**
- [ ] **Step 3: Pass loading state from parent (InventoryTabs)**
- [ ] **Step 4: Build, verify**
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/inventory/
git commit -m "feat(inventory): add loading skeletons to all inventory tabs"
```

---

### Task 3.2: Fix CategoriesTab Create Button Color

**Audit ref:** F16 — CategoriesTab uses `bg-primary` for create button, all others use `bg-accent`.

**Files:**
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Change `bg-primary` to `bg-accent` on create button**
- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 3.3: Add Search to CategoriesTab

**Audit ref:** F10 — CategoriesTab is the only data tab with no search input. With 20+ categories, there's no way to filter.

**Files:**
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Add search state + filtering logic**
- [ ] **Step 2: Add search input between header and create form**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

### Task 3.4: Fix InlineCategoryPicker to Use Shared Modal

**Audit ref:** Consistency — InlineCategoryPicker builds its own custom modal (z-[1300], no animation, no focus trap) instead of using the shared Modal.

**Files:**
- Modify: `apps/web/src/components/inventory/InlineCategoryPicker.tsx`

- [ ] **Step 1: Replace custom modal with shared Modal component**
- [ ] **Step 2: Build, verify animations work**
- [ ] **Step 3: Commit**

---

### Task 3.5: Fix CustomerPreview Modifier Groups

**Audit ref:** Incomplete preview — CustomerPreview only shows simple modifiers, not modifier groups.

**Files:**
- Modify: `apps/web/src/components/inventory/CustomerPreview.tsx`

- [ ] **Step 1: Add modifier groups rendering**
- [ ] **Step 2: Remove or label the non-functional "Aggiungi al carrello" button**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

### Task 3.6: Fix BomTab Edit Modal Dirty Check for Recipe Changes

**Audit ref:** Data loss — BomTab's dirty check only tracks metadata. Recipe changes silently discarded on close.

**Files:**
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

- [ ] **Step 1: Add recipe snapshot to dirty check**

```typescript
const editModalDirty = useMemo(() => {
  if (!selectedBom) return false;
  const recipeChanged = JSON.stringify(bomEditComponents) !== JSON.stringify(selectedBom.components);
  return (
    bomEditName.trim() !== selectedBom.name
    || bomEditCategoryId !== (selectedBom.categoryId ?? '')
    || bomEditUnit !== selectedBom.unit
    || bomEditYield !== String(selectedBom.yieldQuantity)
    || recipeChanged
  );
}, [selectedBom, bomEditName, bomEditCategoryId, bomEditUnit, bomEditYield, bomEditComponents]);
```

- [ ] **Step 2: Build, verify discard warning triggers on recipe changes**
- [ ] **Step 3: Commit**

---

### Task 3.7: Fix MenuItemsTab Tab Labels and Dirty Check

**Audit ref:** F12, F20 — Tab "Extra" is ambiguous (contains both simple modifiers and structured groups). Separate save buttons per tab. Dirty check doesn't distinguish tabs.

**Files:**
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`

- [ ] **Step 1: Rename tab "Extra" to "Modificatori"**
- [ ] **Step 2: Add dirty indicator dot on tabs with unsaved changes**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

## Phase 4: Polish & Consistency

### Task 4.1: Apply EmptyState Component to All Tabs

**Audit ref:** F11 — all tabs use plain text for empty states.

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Replace inline empty text with EmptyState component in each tab**
- [ ] **Step 2: Add context-dependent icons (Package for ingredients, Layers for BOM, etc.)**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

### Task 4.2: Apply Button Component Across All Tabs

**Audit ref:** F6, F7, F16 — all action buttons look the same. Delete is as prominent as edit. Button colors inconsistent.

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Replace inline button patterns with Button component**
- [ ] **Step 2: Use `variant="danger"` for delete buttons (visually distinct)**
- [ ] **Step 3: Use `variant="ghost"` for inline actions (toggle, expand)**
- [ ] **Step 4: Build, verify identical visual output**
- [ ] **Step 5: Commit**

---

### Task 4.3: Fix Print Area Labels to Italian

**Audit ref:** F15 — "kitchen", "bar", "cashier" as English labels in an Italian UI.

**Files:**
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

- [ ] **Step 1: Change print area labels**

```typescript
const PRINT_AREA_LABELS: Record<string, string> = {
  kitchen: 'Cucina',
  bar: 'Bar',
  cashier: 'Cassa',
};
```

- [ ] **Step 2: Apply to all print area displays (badges, pills, toggles)**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

### Task 4.4: Fix Adjust Stock Modal Context

**Audit ref:** F14 — adjust stock modal lacks current quantity context.

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx` (adjust modal)

- [ ] **Step 1: Add current stock display + live preview calculation**

Already partially done in recent session. Verify the adjust modal shows:
- Current stock in a summary card
- Live "50 kg - 10 = 40 kg" preview when delta is entered

- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 4.5: Rename "Pool Mod" Tab

**Audit ref:** F20 — "Pool Mod" is developer jargon. Restaurant managers don't know what this means.

**Files:**
- Modify: `apps/web/src/components/inventory/InventoryTabs.tsx`

- [ ] **Step 1: Rename tab from "Pool Mod" to "Modificatori Categoria"**

```typescript
// In TABS array:
{ key: 'pools', label: 'Mod. Categoria' }  // Short enough for mobile tabs
```

- [ ] **Step 2: Build, verify**
- [ ] **Step 3: Commit**

---

### Task 4.6: Move Food Cost to Separate Section

**Audit ref:** F21 — Food Cost analysis is a financial feature, not inventory management. Having it as a tab in "Magazzino" confuses the mental model.

**Files:**
- Modify: `apps/web/src/components/inventory/InventoryTabs.tsx`

Note: This is a structural change. The Food Cost tab should be moved to its own top-level navigation item or grouped under "Analisi" rather than "Magazzino". This is a lower priority — flag for future if the user agrees.

- [ ] **Step 1: Discuss with user whether to move Food Cost tab now or later**
- [ ] **Step 2: If moving, create route and move component**
- [ ] **Step 3: Build, verify**
- [ ] **Step 4: Commit**

---

## Execution Order

```
Phase 0 (Foundation) ──→ Phase 1 (Dashboard) ──→ Phase 2 (Mobile) ──→ Phase 3 (Interactions) ──→ Phase 4 (Polish)
```

**Phase 0 must complete first** (atoms + schema enable everything else).
**Phases 1-4 are sequential** (each builds on the previous).
**Within each phase, tasks are independent** and can be parallelized.

## User-Perceivable Impact Summary

| Change | Audit Ref | Before | After |
|--------|-----------|--------|-------|
| Inventory value card | F2 | Shows selling prices (misleading) | Shows real stock value (qty × unit_cost) |
| Low-stock alert | F1, F3 | Static count "3" | Shows item names, deficits, supplier, reorder CTA |
| Stock visualization | F1 | None | Horizontal bar chart with color-coded health |
| BomTab on tablet | F5 | Table overflows, unusable | Mobile card layout, fully functional |
| MenuItemsTab on tablet | F5 | Table overflows, unusable | Mobile card layout, fully functional |
| Refresh availability | F9 | 1/4 tabs have visible refresh | 4/4 tabs, consistent header placement |
| Category filtering | F10 | 1/4 tabs (Ingredients only) | 3/4 tabs (Ingredients, Bom, Menu) |
| Loading states | F8 | Empty table during load | Skeleton rows while loading |
| Empty states | F11 | Plain text | Icon + title + optional CTA |
| Button hierarchy | F6, F7 | All buttons same style | Primary (filled), secondary (outlined), danger (red) |
| Print area labels | F15 | English ("kitchen") | Italian ("Cucina") |
| Tab jargon | F20 | "Pool Mod" | "Mod. Categoria" |
| Category search | F10 | No search on CategoriesTab | Search input |
