# Food Cost Container Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow selecting which container (Bun/Panino/Piadina) is the default for each menu item in the food cost matrix, and include its cost in the calculation.

**Architecture:** Add a `defaultContainerId` field to `menu_items` table. Update `getFoodCostMatrix` to include the cost of the selected container. Update UI to show a dropdown for container selection.

**Tech Stack:** PostgreSQL, Drizzle ORM, NestJS API, React

## Global Constraints

- Tenant: `ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f` (Franks)
- Container items: Bun classico (€0.91), Panino (€0.25), Piadina (€0.80)
- Build order: shared → api → web → print-bridge

---

## The Problem

Currently, the food cost matrix does NOT include the cost of the selected bread because bread is selected via modifiers, not stored in `menu_item_ingredients`. We need to:

1. Store which container is the default for each menu item
2. Include its cost in the food cost calculation
3. Allow changing the default container in the UI

## Expected UI

```
Smash Burger (€7.00)
├── [Container: Bun classico ▼] → €0.91
├── Bacon × 3 × €0.50 = €1.50
├── Cheddar × 2 × €0.30 = €0.60
├── Pomodoro × 0.025 × €2.00 = €0.05
├── Smash × 0.180 × €8.50 = €1.53
└── Songino × 0.018 × €4.00 = €0.07

Totale: €4.66 (con Bun)
Margine: 33.4%
```

---

## Task 1: Add defaultContainerId to menu_items

**Covers:** Store which container is default for each menu item

**Files:**
- Modify: `apps/api/src/db/schema.ts:53-62` (menu_items table)
- Create: `apps/api/drizzle/0038_*.sql` (auto-generated)

**Interfaces:**
- Produces: `menu_items.defaultContainerId` field (text, nullable)

- [ ] **Step 1: Add field to schema**

In `apps/api/src/db/schema.ts`, add `defaultContainerId` to `menu_items` table:

```typescript
export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  categoryId: text("category_id"),
  printAreas: text("print_areas").notNull().default('["kitchen"]'),
  isActive: integer("is_active").notNull().default(1),
  defaultContainerId: text("default_container_id"),  // NEW
});
```

- [ ] **Step 2: Generate migration**

```bash
npm run db:generate --workspace @gustopos/api
```

Expected: New migration file created

- [ ] **Step 3: Apply migration**

```bash
cd /srv/gustopos/apps/api && DATABASE_URL="postgresql://postgres:gustopos_dev_password@localhost:5432/gustopos" npx drizzle-kit migrate
```

Expected: Migration applied

---

## Task 2: Update Zod schemas for defaultContainerId

**Covers:** Shared contracts for API

**Files:**
- Modify: `packages/shared/src/contracts.ts`

**Interfaces:**
- Produces: Updated Zod schemas with `defaultContainerId` field

- [ ] **Step 1: Update menuItem schema**

Find `menuItemSchema` and add:

```typescript
defaultContainerId: z.string().nullable().optional(),
```

- [ ] **Step 2: Update menuItemUpdateRequest schema**

Find `menuItemUpdateRequestSchema` and add:

```typescript
defaultContainerId: z.string().nullable().optional(),
```

- [ ] **Step 3: Build shared package**

```bash
npm run build --workspace @gustopos/shared
```

Expected: Build succeeds

---

## Task 3: Update repository for defaultContainerId

**Covers:** Data access layer for container selection

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`

**Interfaces:**
- Consumes: Updated Zod schemas from Task 2
- Produces: Container-aware data access

- [ ] **Step 1: Update mapMenuItemsAdmin**

Find `mapMenuItemsAdmin` method and add `defaultContainerId` to the return:

```typescript
return menuRows.map((row) => ({
  id: row.id,
  name: row.name,
  price: toNumeric(row.price as unknown as string),
  category: row.category,
  categoryId: row.categoryId ?? undefined,
  printAreas: parsePrintAreas(row.printAreas),
  isActive: row.isActive === 1,
  defaultContainerId: row.defaultContainerId ?? null,  // NEW
  recipe: recipeByMenuId.get(row.id) ?? [],
  // ... rest of fields
}));
```

- [ ] **Step 2: Update updateMenuItem**

Find `updateMenuItem` method and add `defaultContainerId` to the update:

```typescript
await tx
  .update(menuItems)
  .set({
    name: parsed.name,
    price: String(parsed.price),
    category: parsed.category,
    categoryId: parsed.categoryId ?? null,
    printAreas: JSON.stringify(parsed.printAreas),
    defaultContainerId: parsed.defaultContainerId ?? null,  // NEW
  })
  .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/api
```

Expected: No errors

---

## Task 4: Update getFoodCostMatrix to include container cost

**Covers:** Include selected container cost in food cost calculation

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts:8850-9029` (getFoodCostMatrix method)

**Interfaces:**
- Consumes: `menu_items.defaultContainerId`, `inventory.unit_cost`
- Produces: Food cost matrix with container cost included

- [ ] **Step 1: Add container cost to query**

In `getFoodCostMatrix`, update the query to fetch `defaultContainerId`:

```typescript
const [menuRows, ingRows, recipeRows] = await Promise.all([
  db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      category: menuItems.category,
      price: menuItems.price,
      defaultContainerId: menuItems.defaultContainerId,  // NEW
    })
    .from(menuItems)
    .where(eq(menuItems.tenantId, tenantId)),
  // ... rest of queries
]);
```

- [ ] **Step 2: Fetch container costs**

After fetching menu rows, fetch container inventory items:

```typescript
// Fetch container costs
const containerIds = [...new Set(menuRows.map(m => m.defaultContainerId).filter(Boolean))];
const containerRows = containerIds.length > 0
  ? await db
      .select({ id: inventory.id, name: inventory.name, unitCost: inventory.unitCost })
      .from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, containerIds)))
  : [];
const containerById = new Map(containerRows.map(c => [c.id, c]));
```

- [ ] **Step 3: Add container cost to matrix rows**

In the loop that builds matrix rows, add container cost:

```typescript
for (const menu of menuRows) {
  const summary = summaryMap.get(menu.id);
  if (!summary) continue;

  // Add container cost if selected
  if (menu.defaultContainerId) {
    const container = containerById.get(menu.defaultContainerId);
    if (container) {
      const containerCost = toNumeric(container.unitCost as unknown as string);
      summary.totalCost += containerCost;
      summary.ingredientCount++;
      
      // Also add to rows array for display
      rows.push({
        menuItemId: menu.id,
        menuItemName: menu.name,
        category: menu.category,
        ingredientId: container.id,
        ingredientName: `[Container] ${container.name}`,
        quantity: 1,
        unit: 'pz',
        ingredientCost: containerCost,
        totalCost: containerCost,
        menuItemPrice: toNumeric(menu.price as unknown as string),
        margin: 0,
        marginPercent: 0,
        recommendedPrice: 0,
        status: 'ok',
      });
    }
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/api
```

Expected: No errors

---

## Task 5: Update frontend to show container selector

**Covers:** UI for selecting default container

**Files:**
- Modify: `apps/web/src/components/inventory/FoodCostMatrixTab.tsx`

**Interfaces:**
- Consumes: Updated food cost matrix with container data
- Produces: UI dropdown for container selection

- [ ] **Step 1: Add container selector to FoodCostMatrixRow interface**

Update the interface to include container info:

```typescript
interface FoodCostMatrixRow {
  menuItemId: string;
  menuItemName: string;
  category: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  ingredientCost: number;
  totalCost: number;
  menuItemPrice: number;
  margin: number;
  marginPercent: number;
  recommendedPrice: number;
  status: 'ok' | 'needs_change';
  isContainer?: boolean;  // NEW
}
```

- [ ] **Step 2: Add container selector in summary view**

In the summary section (where each menu item is shown), add a dropdown:

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm font-medium">Container:</span>
  <select
    value={item.defaultContainerId || ''}
    onChange={(e) => onUpdateContainer?.(item.menuItemId, e.target.value || null)}
    className="px-2 py-1 rounded border border-border text-sm"
  >
    <option value="">Nessuno</option>
    {containers.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name} (€{c.unitCost.toFixed(2)})
      </option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Add container cost to total display**

Update the total cost display to show container cost separately:

```tsx
<div className="text-sm">
  <span className="text-text-muted">Container:</span>
  <span className="ml-2">€{containerCost.toFixed(2)}</span>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/web
```

Expected: No errors

---

## Task 6: Add API endpoint for updating defaultContainerId

**Covers:** API endpoint for container selection

**Files:**
- Modify: `apps/api/src/app.controller.ts`

**Interfaces:**
- Consumes: Updated repository from Task 3
- Produces: PATCH endpoint for defaultContainerId

- [ ] **Step 1: Add endpoint**

Add a new endpoint to update `defaultContainerId`:

```typescript
@Patch('menu/:id/container')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
async updateMenuItemContainer(
  @TenantId() tenantId: string,
  @Param('id') id: string,
  @Body() body: { defaultContainerId: string | null },
) {
  return this.repository.updateMenuItem(id, { defaultContainerId: body.defaultContainerId });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/api
```

Expected: No errors

---

## Task 7: Add frontend client function for container update

**Covers:** Frontend API client for container selection

**Files:**
- Modify: `apps/web/src/shared/api/client.ts`

**Interfaces:**
- Consumes: API endpoint from Task 6
- Produces: `updateMenuItemContainer` function

- [ ] **Step 1: Add client function**

```typescript
export async function updateMenuItemContainer(
  menuItemId: string,
  defaultContainerId: string | null,
): Promise<void> {
  await apiFetch(`/menu/${menuItemId}/container`, {
    method: 'PATCH',
    body: JSON.stringify({ defaultContainerId }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/web
```

Expected: No errors

---

## Task 8: Set default containers for Franks menu items

**Covers:** Initial data for Franks tenant

**Files:**
- SQL script (direct DB modification)

**Interfaces:**
- Produces: Default containers set for all menu items

- [ ] **Step 1: Set Bun classico as default for burger items**

```sql
UPDATE menu_items
SET default_container_id = 'i_bun_classico'
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND name ILIKE ANY(ARRAY['%burger%', '%smash%', '%frank%', '%chicken%', '%spicy%']);
```

- [ ] **Step 2: Set Panino as default for panino items**

```sql
UPDATE menu_items
SET default_container_id = 'i_panino'
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND name ILIKE ANY(ARRAY['%contadino%', '%lady%', '%montagnolo%', '%ventimiglia%', '%vegetariano%']);
```

- [ ] **Step 3: Set Piadina as default for wrap items**

```sql
UPDATE menu_items
SET default_container_id = 'i_piadina'
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND name ILIKE '%wrap%';
```

- [ ] **Step 4: Verify all items have containers**

```sql
SELECT id, name, default_container_id
FROM menu_items
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
ORDER BY name;
```

Expected: All relevant items have default_container_id set

---

## Task 9: End-to-end verification

**Covers:** Full stack verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working system

- [ ] **Step 1: Verify database schema**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'menu_items' AND column_name = 'default_container_id';
```

Expected: Column exists

- [ ] **Step 2: Verify default containers are set**

```sql
SELECT COUNT(*) as items_with_container
FROM menu_items
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND default_container_id IS NOT NULL;
```

Expected: > 0 items have containers

- [ ] **Step 3: Run TypeScript type check**

```bash
npm run lint
```

Expected: No errors

- [ ] **Step 4: Run API tests**

```bash
npm test --workspace @gustopos/api
```

Expected: All tests pass

- [ ] **Step 5: Build all packages**

```bash
npm run build
```

Expected: Build succeeds

---

## Summary of Changes

| Task | Change | Impact |
|------|--------|--------|
| Task 1 | Add `defaultContainerId` to menu_items | Schema change |
| Task 2 | Update Zod schemas | Shared contracts |
| Task 3 | Update repository | Data access |
| Task 4 | Update getFoodCostMatrix | Include container cost |
| Task 5 | Update frontend UI | Container selector |
| Task 6 | Add API endpoint | Container update |
| Task 7 | Add frontend client | API client |
| Task 8 | Set default containers | Initial data |
| Task 9 | End-to-end verification | Testing |

## Expected Result

### Food Cost Matrix (Smash Burger)

**Before:**
```
Smash Burger (€7.00)
├── Bacon × 3 × €0.50 = €1.50
├── Cheddar × 2 × €0.30 = €0.60
├── Pomodoro × 0.025 × €2.00 = €0.05
├── Smash × 0.180 × €8.50 = €1.53
└── Songino × 0.018 × €4.00 = €0.07

Totale: €3.75 (no container!)
Margine: 46.4%
```

**After:**
```
Smash Burger (€7.00)
├── [Container: Bun classico ▼] → €0.91
├── Bacon × 3 × €0.50 = €1.50
├── Cheddar × 2 × €0.30 = €0.60
├── Pomodoro × 0.025 × €2.00 = €0.05
├── Smash × 0.180 × €8.50 = €1.53
└── Songino × 0.018 × €4.00 = €0.07

Totale: €4.66 (with Bun)
Margine: 33.4%
```

### User Can Change Container

```
Smash Burger (€7.00)
├── [Container: Panino ▼] → €0.25  ← changed!
├── Bacon × 3 × €0.50 = €1.50
├── Cheddar × 2 × €0.30 = €0.60
├── Pomodoro × 0.025 × €2.00 = €0.05
├── Smash × 0.180 × €8.50 = €1.53
└── Songino × 0.018 × €4.00 = €0.07

Totale: €4.00 (with Panino)
Margine: 42.9%
```
