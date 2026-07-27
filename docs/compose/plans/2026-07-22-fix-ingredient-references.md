# Fix Ingredient References in Kitchen Receipts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the REFERENZE section in kitchen receipts to only count "container" items (Panino, Bun, Piadina, Piatto) instead of every individual ingredient.

**Architecture:** Add `is_container` flag to both `inventory` and `bom_items` tables. Create missing inventory items with correct XLSX costs. Update `createPrintJobsForOrder()` to filter counts by container items only.

**Tech Stack:** Drizzle ORM, PostgreSQL, Zod schemas, ESC/POS receipt generation

## Global Constraints

- Build order: shared → api → web → print-bridge
- API is CommonJS, web is ESM
- All DB changes require Drizzle migrations via `npm run db:generate --workspace @gustopos/api`
- Zod schemas in `packages/shared/src/contracts.ts` are source of truth for API contracts
- Multi-tenant: every table has `tenant_id`

---

## Task 1: Add `is_container` flag to inventory table

**Covers:** Schema change for container identification

**Files:**
- Modify: `apps/api/src/db/schema.ts:40-51` (inventory table)
- Create: `apps/api/drizzle/0036_<migration_name>.sql` (auto-generated)

**Interfaces:**
- Produces: `inventory.isContainer` field (integer, default 0)

- [ ] **Step 1: Add field to schema**

In `apps/api/src/db/schema.ts`, add `isContainer` field to `inventory` table:

```typescript
export const inventory = pgTable("inventory", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  minThreshold: numeric("min_threshold", { precision: 12, scale: 2 }).notNull(),
  categoryId: text("category_id"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
  isActive: integer("is_active").notNull().default(1),
  isContainer: integer("is_container").notNull().default(0),  // NEW: 1 = container item
});
```

- [ ] **Step 2: Generate migration**

Run: `npm run db:generate --workspace @gustopos/api`
Expected: New migration file created in `apps/api/drizzle/`

- [ ] **Step 3: Apply migration**

Run: `npm run db:migrate --workspace @gustopos/api`
Expected: Migration applied successfully

- [ ] **Step 4: Verify schema compiles**

Run: `npm run lint`
Expected: No TypeScript errors

---

## Task 2: Add `is_container` flag to bom_items table

**Covers:** Schema change for BOM container identification

**Files:**
- Modify: `apps/api/src/db/schema.ts:192-200` (bom_items table)
- Create: `apps/api/drizzle/0037_<migration_name>.sql` (auto-generated)

**Interfaces:**
- Produces: `bom_items.isContainer` field (integer, default 0)

- [ ] **Step 1: Add field to schema**

In `apps/api/src/db/schema.ts`, add `isContainer` field to `bom_items` table:

```typescript
export const bomItems = pgTable("bom_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  yieldQuantity: numeric("yield_quantity", { precision: 12, scale: 3 }).notNull(),
  categoryId: text("category_id"),
  isActive: integer("is_active").notNull().default(1),
  isContainer: integer("is_container").notNull().default(0),  // NEW: 1 = container BOM
});
```

- [ ] **Step 2: Generate migration**

Run: `npm run db:generate --workspace @gustopos/api`
Expected: New migration file created

- [ ] **Step 3: Apply migration**

Run: `npm run db:migrate --workspace @gustopos/api`
Expected: Migration applied successfully

- [ ] **Step 4: Verify schema compiles**

Run: `npm run lint`
Expected: No TypeScript errors

---

## Task 3: Update Zod schemas for container fields

**Covers:** Shared contracts for API

**Files:**
- Modify: `packages/shared/src/contracts.ts` (ingredient and bomItem schemas)

**Interfaces:**
- Consumes: `inventory.isContainer`, `bom_items.isContainer` from DB
- Produces: Updated Zod schemas with `isContainer` field

- [ ] **Step 1: Update ingredient schema**

In `packages/shared/src/contracts.ts`, find the `ingredientSchema` and add:

```typescript
isContainer: z.number().default(0),
```

- [ ] **Step 2: Update bomItem schema**

Find the `bomItemSchema` and add:

```typescript
isContainer: z.number().default(0),
```

- [ ] **Step 3: Update create/update schemas**

Find `ingredientCreateRequestSchema` and `bomItemCreateRequestSchema` and add:

```typescript
isContainer: z.number().optional().default(0),
```

- [ ] **Step 4: Build shared package**

Run: `npm run build --workspace @gustopos/shared`
Expected: Build succeeds

---

## Task 4: Update repository to handle container fields

**Covers:** Data access layer for container fields

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (multiple methods)

**Interfaces:**
- Consumes: Updated Zod schemas from Task 3
- Produces: Container-aware data access

- [ ] **Step 1: Update mapInventoryRows**

Find `mapInventoryRows` method (around line 1412) and add `isContainer` to the return:

```typescript
private mapInventoryRows(rows: { id: string; name: string; quantity: unknown; unit: string; minThreshold: unknown; categoryId: string | null; unitCost: unknown; salePrice: string | null; isActive: number; isContainer?: number; supplierName?: string | null; brandName?: string | null }[]): Ingredient[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    minThreshold: Number(row.minThreshold),
    categoryId: row.categoryId ?? undefined,
    unitCost: Number(row.unitCost ?? 0),
    salePrice: row.salePrice != null ? Number(row.salePrice) : null,
    isActive: row.isActive === 1,
    isContainer: row.isContainer ?? 0,  // NEW
    supplierName: row.supplierName ?? null,
    brandName: row.brandName ?? null,
  }));
}
```

- [ ] **Step 2: Update createInventoryItem**

Find `createInventoryItem` method and add `isContainer` to the insert:

```typescript
await tx.insert(inventory).values({
  id: parsed.id ?? crypto.randomUUID(),
  tenantId,
  name: parsed.name,
  quantity: String(parsed.quantity),
  unit: parsed.unit,
  minThreshold: String(parsed.minThreshold),
  categoryId: parsed.categoryId ?? null,
  unitCost: String(parsed.unitCost),
  salePrice: parsed.salePrice != null ? String(parsed.salePrice) : null,
  isContainer: parsed.isContainer ?? 0,  // NEW
});
```

- [ ] **Step 3: Update updateInventoryItem**

Find `updateInventoryItem` method and add `isContainer` to the update:

```typescript
await tx
  .update(inventory)
  .set({
    name: parsed.name,
    quantity: String(parsed.quantity),
    unit: parsed.unit,
    minThreshold: String(parsed.minThreshold),
    categoryId: parsed.categoryId ?? null,
    unitCost: String(parsed.unitCost),
    salePrice: parsed.salePrice != null ? String(parsed.salePrice) : null,
    isContainer: parsed.isContainer ?? 0,  // NEW
  })
  .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)));
```

- [ ] **Step 4: Update BOM methods**

Find `mapBomItems` method (around line 1379) and add `isContainer` to the return:

```typescript
return bomRows.map((row) =>
  bomItemSchema.parse({
    id: row.id,
    name: row.name,
    unit: row.unit,
    yieldQuantity: Number(row.yieldQuantity),
    isActive: row.isActive === 1,
    isContainer: row.isContainer ?? 0,  // NEW
    categoryId: row.categoryId ?? undefined,
    components: (componentsByBomId.get(row.id) ?? []).map((component) => ({
      id: String(component.id),
      componentType: component.componentType,
      componentId: component.componentId,
      quantity: Number(component.quantity),
      unit: component.unit,
    })),
  }),
);
```

- [ ] **Step 5: Update BOM create/update methods**

Find `createBomItem` and `updateBomItem` methods and add `isContainer` to the insert/update operations.

- [ ] **Step 6: Verify compilation**

Run: `npm run lint`
Expected: No TypeScript errors

---

## Task 5: Create missing inventory items for Franks tenant

**Covers:** Missing container items from XLSX

**Files:**
- None (SQL script only)

**Interfaces:**
- Produces: 4 new inventory items in database

- [ ] **Step 1: Create Bun inventory item**

Run SQL:
```sql
INSERT INTO inventory (id, tenant_id, name, quantity, unit, min_threshold, unit_cost, is_container)
VALUES (
  'inv_bun_001',
  'franks',
  'Bun',
  0,
  'pz',
  10,
  0.91,
  1
);
```

- [ ] **Step 2: Create Panino inventory item**

Run SQL:
```sql
INSERT INTO inventory (id, tenant_id, name, quantity, unit, min_threshold, unit_cost, is_container)
VALUES (
  'inv_panino_001',
  'franks',
  'Panino',
  0,
  'pz',
  10,
  0.25,
  1
);
```

- [ ] **Step 3: Create Piadina inventory item**

Run SQL:
```sql
INSERT INTO inventory (id, tenant_id, name, quantity, unit, min_threshold, unit_cost, is_container)
VALUES (
  'inv_piadina_001',
  'franks',
  'Piadina',
  0,
  'pz',
  10,
  0.25,
  1
);
```

- [ ] **Step 4: Create Piatto inventory item**

Run SQL:
```sql
INSERT INTO inventory (id, tenant_id, name, quantity, unit, min_threshold, unit_cost, is_container)
VALUES (
  'inv_piatto_001',
  'franks',
  'Piatto',
  0,
  'pz',
  10,
  0,
  1
);
```

- [ ] **Step 5: Verify items exist**

Run SQL:
```sql
SELECT id, name, unit_cost, is_container 
FROM inventory 
WHERE tenant_id = 'franks' 
AND is_container = 1;
```

Expected: 4 rows (Bun, Panino, Piadina, Piatto)

---

## Task 6: Update REFERENZE logic in createPrintJobsForOrder

**Covers:** Fix kitchen receipt to only count container items

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts:1082-1098` (inventoryCountByArea logic)
- Modify: `apps/api/src/repository/app.repository.ts:904-914` (REFERENZE display)

**Interfaces:**
- Consumes: `inventory.isContainer` flag
- Produces: Filtered REFERENZE section showing only container items

- [ ] **Step 1: Fetch inventory with isContainer flag**

In `createPrintJobsForOrder`, after fetching `inventoryRows`, build a map of container items:

```typescript
// After line 982 (inventoryNameById)
const inventoryNameById = new Map(ingredientRows.map((row) => [row.id, row.name]));
const inventoryIsContainerById = new Map(ingredientRows.map((row) => [row.id, row.isContainer ?? 0]));
```

- [ ] **Step 2: Filter inventoryCountByArea to only containers**

Replace the current counting logic (lines 1084-1098) with:

```typescript
for (const mod of item.selectedModifiers ?? []) {
  const invId = inventoryItemIdByOptionId.get(mod.optionId);
  if (!invId) continue;
  
  // Only count container items
  const isContainer = inventoryIsContainerById.get(invId) ?? 0;
  if (!isContainer) continue;
  
  const invName = inventoryNameById.get(invId) ?? invId;
  const counts = inventoryCountByArea.get(area) ?? {};
  counts[invName] = (counts[invName] ?? 0) + item.quantity;
  inventoryCountByArea.set(area, counts);
}

for (const entry of item.ingredientOverrides ?? []) {
  if (entry.action !== "add") continue;
  
  // Only count container items
  const isContainer = inventoryIsContainerById.get(entry.ingredientId) ?? 0;
  if (!isContainer) continue;
  
  const invName = inventoryNameById.get(entry.ingredientId) ?? entry.ingredientId;
  const counts = inventoryCountByArea.get(area) ?? {};
  counts[invName] = (counts[invName] ?? 0) + item.quantity;
  inventoryCountByArea.set(area, counts);
}
```

- [ ] **Step 3: Also check BOM recipes for container items**

After the pool option and override counting, add BOM-based container counting:

```typescript
// Check BOM recipes for container items
const menuBomLinks = await db
  .select({ menuItemId: menuItemBomRequirements.menuItemId, bomId: menuItemBomRequirements.bomId, quantity: menuItemBomRequirements.quantity })
  .from(menuItemBomRequirements)
  .where(and(eq(menuItemBomRequirements.tenantId, tenantId), inArray(menuItemBomRequirements.menuItemId, menuIds)));

// Get all BOM components to find container items
const bomIds = [...new Set(menuBomLinks.map(l => l.bomId))];
const bomComponentsRows = bomIds.length > 0
  ? await db.select().from(bomComponents).where(and(eq(bomComponents.tenantId, tenantId), inArray(bomComponents.bomId, bomIds)))
  : [];

// Build component lookup
const componentsByBomId = new Map<string, typeof bomComponentsRows>();
for (const comp of bomComponentsRows) {
  const existing = componentsByBomId.get(comp.bomId) ?? [];
  existing.push(comp);
  componentsByBomId.set(comp.bomId, existing);
}

// For each order item, check if its BOM contains container ingredients
for (const item of order.items) {
  const areas = areaByMenuId.get(item.id) ?? ["kitchen"];
  
  for (const bomLink of menuBomLinks.filter(l => l.menuItemId === item.id)) {
    const components = componentsByBomId.get(bomLink.bomId) ?? [];
    
    for (const comp of components) {
      if (comp.componentType !== "ingredient") continue;
      
      // Check if this component is a container
      const isContainer = inventoryIsContainerById.get(comp.componentId) ?? 0;
      if (!isContainer) continue;
      
      const invName = inventoryNameById.get(comp.componentId) ?? comp.componentId;
      const qty = Number(comp.quantity) * item.quantity;
      
      for (const area of areas) {
        if (!activeAreas.includes(area)) continue;
        const counts = inventoryCountByArea.get(area) ?? {};
        counts[invName] = (counts[invName] ?? 0) + qty;
        inventoryCountByArea.set(area, counts);
      }
    }
  }
}
```

- [ ] **Step 4: Update REFERENZE header**

In `buildEscPosPayload`, update the REFERENZE section header (around line 904) to say "CONTENITORI" instead of "REFERENZE":

```typescript
if (kitchenSummary && area === "kitchen" && Object.keys(kitchenSummary).length > 0) {
  const sep = "-".repeat(RECEIPT_WIDTH);
  ep.bold(true).line(sep);
  ep.align("center").line("*** CONTENITORI ***");  // Changed from REFERENZE
  ep.align("left").bold(false);
  for (const [name, count] of Object.entries(kitchenSummary)) {
    ep.line(`${padRight(name.toUpperCase(), 24)} ${String(count).padStart(4)}`);
  }
  ep.bold(true).line(sep);
  ep.bold(false).line();
}
```

- [ ] **Step 5: Verify compilation**

Run: `npm run lint`
Expected: No TypeScript errors

---

## Task 7: Update receipt label tests

**Covers:** Test coverage for new container logic

**Files:**
- Modify: `apps/api/src/repository/receipt-labels.test.ts`

**Interfaces:**
- Consumes: Updated REFERENZE logic
- Produces: Tests verifying only container items are counted

- [ ] **Step 1: Add container counting tests**

Add new test cases to `receipt-labels.test.ts`:

```typescript
// Container counting tests
test("container items are counted in kitchen summary", () => {
  const containerItems = [
    { name: "Bun", isContainer: 1 },
    { name: "Prosciutto", isContainer: 0 },
    { name: "Panino", isContainer: 1 },
  ];
  
  const counts: Record<string, number> = {};
  for (const item of containerItems) {
    if (item.isContainer) {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
    }
  }
  
  assert.deepEqual(counts, { Bun: 1, Panino: 1 });
  assert.ok(!("Prosciutto" in counts), "Non-container items should not be counted");
});

test("non-container items are excluded from kitchen summary", () => {
  const containerItems = [
    { name: "Mozzarella", isContainer: 0 },
    { name: "Pomodoro", isContainer: 0 },
  ];
  
  const counts: Record<string, number> = {};
  for (const item of containerItems) {
    if (item.isContainer) {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
    }
  }
  
  assert.deepEqual(counts, {});
});
```

- [ ] **Step 2: Run tests**

Run: `npm test --workspace @gustopos/api`
Expected: All tests pass

---

## Task 8: Update frontend to display container fields

**Covers:** UI for managing container items

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx` (add container column)
- Modify: `apps/web/src/components/IngredientsView.tsx` (add container field to forms)

**Interfaces:**
- Consumes: Updated Zod schemas from Task 3
- Produces: UI for setting isContainer flag

- [ ] **Step 1: Add container column to IngredientsTab**

In `IngredientsTab.tsx`, add a column header "Container" and a checkbox for each row:

```tsx
<th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text-muted">
  Container
</th>
```

And in the row:
```tsx
<td className="px-3 py-2">
  <input
    type="checkbox"
    checked={item.isContainer === 1}
    onChange={(e) => updateItem(item.id, { isContainer: e.target.checked ? 1 : 0 })}
    className="h-4 w-4 rounded border-border"
  />
</td>
```

- [ ] **Step 2: Add container field to ingredient form**

In `IngredientsView.tsx`, add a checkbox field for `isContainer` in the create/edit form.

- [ ] **Step 3: Verify compilation**

Run: `npm run lint`
Expected: No TypeScript errors

---

## Task 9: Build and verify full stack

**Covers:** End-to-end verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working system

- [ ] **Step 1: Build shared package**

Run: `npm run build --workspace @gustopos/shared`
Expected: Build succeeds

- [ ] **Step 2: Build API**

Run: `npm run build --workspace @gustopos/api`
Expected: Build succeeds

- [ ] **Step 3: Build web**

Run: `npm run build --workspace @gustopos/web`
Expected: Build succeeds

- [ ] **Step 4: Run all tests**

Run: `npm test --workspace @gustopos/api`
Expected: All tests pass

- [ ] **Step 5: Verify type checking**

Run: `npm run lint`
Expected: No TypeScript errors

---

## Summary of Changes

| File | Change |
|------|--------|
| `apps/api/src/db/schema.ts` | Add `isContainer` to `inventory` and `bom_items` tables |
| `packages/shared/src/contracts.ts` | Add `isContainer` to Zod schemas |
| `apps/api/src/repository/app.repository.ts` | Update REFERENZE logic to only count containers |
| `apps/api/src/repository/receipt-labels.test.ts` | Add container counting tests |
| `apps/web/src/components/inventory/IngredientsTab.tsx` | Add container column |
| SQL scripts | Create Bun, Panino, Piadina, Piatto inventory items |

## Expected Receipt Output After Fix

```
         KITCHEN

Ordine: m3x7k2p1 | Dine-in
Tavolo: 5

----------------------------------------------
            *** CONTENITORI ***
----------------------------------------------
BUN                                2
PANINO                             1
PIADINA                            1
----------------------------------------------

** 2x Margherita**
  [Senza olive]
  + Olio al tartufo
  *-allergico glutine

** 1x Pizza Prosciutto e Funghi**
  [Funghi champignon]

** 1x Tiramisu Classico**
```

Instead of counting every ingredient (Pomodoro, Mozzarella, Prosciutto, etc.), it now only counts the container items (Bun, Panino, Piadina) that the kitchen needs to prepare.
