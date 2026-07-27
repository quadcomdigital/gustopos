# BOM Stock Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stock tracking for pre-batched BOMs (Cartoccio, Carbocrema) so kitchen can track prepared items separately from raw ingredients.

**Architecture:** Add `stock_quantity` and `is_pre_batched` fields to `bom_items`. New API endpoints for preparing BOMs and checking stock. Modified order flow to check BOM stock before serving. Dashboard updates for preparation management.

**Tech Stack:** PostgreSQL (Drizzle schema), NestJS (API), React (UI), Zustand (state)

## Global Constraints

- Build order: shared → api → web → print-bridge
- API CommonJS, web ESM
- `npm run build` handles correct order
- Tests: `tsx --test` (API), `tsc --noEmit` (web)
- Ports: Web=11900, API=11901, Print-bridge=11905

---

### Task 1: Schema Migration — Add BOM Stock Fields

**Covers:** [S3]

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Interfaces:**
- Consumes: existing `bomItems` table definition
- Produces: updated `bomItems` with `stockQuantity` and `isPreBatched` fields

- [ ] **Step 1: Add new fields to bomItems schema**

```typescript
// apps/api/src/db/schema.ts — in bomItems table definition
export const bomItems = pgTable("bom_items", {
  // ... existing fields ...
  yieldQuantity: numeric("yield_quantity", { precision: 12, scale: 3 }).notNull(),
  isActive: integer("is_active").notNull().default(1),
  categoryId: text("category_id"),
  isContainer: integer("is_container").notNull().default(0),
  // NEW FIELDS
  stockQuantity: numeric("stock_quantity", { precision: 12, scale: 3 }).notNull().default(0),
  isPreBatched: integer("is_pre_batched").notNull().default(0),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
});
```

- [ ] **Step 2: Update Zod schemas in shared package**

```typescript
// packages/shared/src/contracts.ts — find bomItemSchema and add:
export const bomItemSchema = z.object({
  // ... existing fields ...
  stockQuantity: z.number(),
  isPreBatched: z.number(),
});
```

- [ ] **Step 3: Generate and apply migration**

Run: `npm run db:generate --workspace @gustopos/api`
Run: `npm run db:migrate --workspace @gustopos/api`

- [ ] **Step 4: Verify columns exist**

Run: `PGPASSWORD=gustopos_dev_password psql -h localhost -U postgres -d gustopos -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'bom_items' AND column_name IN ('stock_quantity', 'is_pre_batched');"`

Expected: Returns both columns

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts packages/shared/src/contracts.ts
git commit -m "feat(bom): add stock_quantity and is_pre_batched fields to bom_items"
```

---

### Task 2: Repository — prepareBom Method

**Covers:** [S6]

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`

**Interfaces:**
- Consumes: `bomItems` table with new fields, `bomComponents`, `inventory`
- Produces: `prepareBom(id: string, quantity: number): Promise<PrepareResult>`

- [ ] **Step 1: Add PrepareResult type**

```typescript
// apps/api/src/repository/app.repository.ts — near top of file
interface PrepareResult {
  bomId: string;
  name: string;
  previousStock: number;
  newStock: number;
  ingredientsDeducted: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
}
```

- [ ] **Step 2: Implement prepareBom method**

```typescript
// apps/api/src/repository/app.repository.ts — add to AppRepository class
async prepareBom(id: string, quantity: number): Promise<PrepareResult> {
  return this.db.transaction(async (tx) => {
    // 1. Get BOM
    const bom = await tx.query.bomItems.findFirst({
      where: eq(bomItems.id, id),
    });
    if (!bom) throw new Error(`BOM ${id} not found`);
    if (bom.isActive !== 1) throw new Error(`BOM "${bom.name}" is not active`);
    if (bom.isPreBatched !== 1) throw new Error(`BOM "${bom.name}" is not pre-batched`);

    // 2. Get BOM components (ingredients only)
    const components = await tx.query.bomComponents.findMany({
      where: eq(bomComponents.bomId, id),
    });
    const ingredientComponents = components.filter(c => c.componentType === "ingredient");
    if (ingredientComponents.length === 0) throw new Error(`BOM "${bom.name}" has no ingredients`);

    // 3. Calculate required quantities
    const yieldQty = toNumeric(bom.yieldQuantity);
    const multiplier = quantity / yieldQty;
    const required: Array<{ id: string; name: string; quantity: number; unit: string }> = [];
    
    for (const comp of ingredientComponents) {
      const reqQty = toNumeric(comp.quantity) * multiplier;
      const invItem = await tx.query.inventory.findFirst({
        where: eq(inventory.id, comp.componentId),
      });
      if (!invItem) throw new Error(`Ingredient ${comp.componentId} not found`);
      required.push({
        id: comp.componentId,
        name: invItem.name,
        quantity: reqQty,
        unit: comp.unit,
      });
    }

    // 4. Check stock availability
    for (const req of required) {
      const invItem = await tx.query.inventory.findFirst({
        where: eq(inventory.id, req.id),
      });
      if (!invItem) throw new Error(`Ingredient ${req.name} not found`);
      if (toNumeric(invItem.quantity) < req.quantity) {
        throw new Error(`Insufficient ${req.name}: need ${req.quantity} ${req.unit}, have ${invItem.quantity}`);
      }
    }

    // 5. Deduct ingredients
    for (const req of required) {
      await tx.update(inventory)
        .set({ quantity: sql`${inventory.quantity} - ${req.quantity}` })
        .where(eq(inventory.id, req.id));
    }

    // 6. Update BOM stock
    const prevStock = toNumeric(bom.stockQuantity);
    const newStock = prevStock + quantity;
    await tx.update(bomItems)
      .set({ stockQuantity: newStock.toString() })
      .where(eq(bomItems.id, id));

    // 7. Record stock movements
    for (const req of required) {
      await tx.insert(stockMovements).values({
        inventoryId: req.id,
        movementType: "out",
        quantity: (-req.quantity).toString(),
        unit: req.unit,
        referenceType: "bom_preparation",
        referenceId: id,
        notes: `Prepared ${quantity} ${bom.name}`,
        tenantId: bom.tenantId,
      });
    }

    return {
      bomId: id,
      name: bom.name,
      previousStock: prevStock,
      newStock,
      ingredientsDeducted: required,
    };
  });
}
```

- [ ] **Step 3: Verify method compiles**

Run: `cd /srv/gustopos/apps/api && npx tsc --noEmit 2>&1 | grep -i "prepareBom"`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/repository/app.repository.ts
git commit -m "feat(bom): add prepareBom method for stock management"
```

---

### Task 3: Repository — getBomStock Method

**Covers:** [S6]

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`

**Interfaces:**
- Consumes: `bomItems` table with `isPreBatched` field
- Produces: `getBomStock(): Promise<BomStockItem[]>`

- [ ] **Step 1: Add BomStockItem type**

```typescript
// apps/api/src/repository/app.repository.ts — near PrepareResult
interface BomStockItem {
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
}
```

- [ ] **Step 2: Implement getBomStock method**

```typescript
// apps/api/src/repository/app.repository.ts — add to AppRepository class
async getBomStock(): Promise<BomStockItem[]> {
  const boms = await this.db.query.bomItems.findMany({
    where: eq(bomItems.isPreBatched, 1),
    columns: {
      id: true,
      name: true,
      stockQuantity: true,
      unit: true,
    },
  });
  return boms.map(b => ({
    id: b.id,
    name: b.name,
    stockQuantity: toNumeric(b.stockQuantity),
    unit: b.unit,
  }));
}
```

- [ ] **Step 3: Verify method compiles**

Run: `cd /srv/gustopos/apps/api && npx tsc --noEmit 2>&1 | grep -i "getBomStock"`

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/repository/app.repository.ts
git commit -m "feat(bom): add getBomStock method for stock visibility"
```

---

### Task 4: Repository — Update isPreBatched Flag

**Covers:** [S6]

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`

**Interfaces:**
- Consumes: `bomItems` table
- Produces: `updateBomPreBatched(id: string, isPreBatched: boolean): Promise<void>`

- [ ] **Step 1: Implement updateBomPreBatched method**

```typescript
// apps/api/src/repository/app.repository.ts — add to AppRepository class
async updateBomPreBatched(id: string, isPreBatched: boolean): Promise<void> {
  await this.db.update(bomItems)
    .set({ isPreBatched: isPreBatched ? 1 : 0 })
    .where(eq(bomItems.id, id));
}
```

- [ ] **Step 2: Verify method compiles**

Run: `cd /srv/gustopos/apps/api && npx tsc --noEmit 2>&1 | grep -i "updateBomPreBatched"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/repository/app.repository.ts
git commit -m "feat(bom): add updateBomPreBatched method"
```

---

### Task 5: API Endpoints — Prepare and Stock

**Covers:** [S4]

**Files:**
- Modify: `apps/api/src/app.controller.ts`

**Interfaces:**
- Consumes: `prepareBom()`, `getBomStock()` from repository
- Produces: `POST /api/bom/:id/prepare`, `GET /api/bom/stock`

- [ ] **Step 1: Add prepare endpoint**

```typescript
// apps/api/src/app.controller.ts — add new endpoint
@Post("bom/:id/prepare")
@Roles("admin", "chef")
async prepareBom(@Param("id") id: string, @Body() payload: { quantity: number }) {
  if (!payload.quantity || payload.quantity <= 0) {
    throw new BadRequestException("Quantity must be positive");
  }
  try {
    return await this.appRepository.prepareBom(id, payload.quantity);
  } catch (e: any) {
    throw new BadRequestException(e.message);
  }
}
```

- [ ] **Step 2: Add stock endpoint**

```typescript
// apps/api/src/app.controller.ts — add new endpoint
@Get("bom/stock")
@Roles("admin", "chef", "waiter")
async getBomStock() {
  return this.appRepository.getBomStock();
}
```

- [ ] **Step 3: Add update pre-batched endpoint**

```typescript
// apps/api/src/app.controller.ts — add new endpoint
@Patch("bom/:id/pre-batched")
@Roles("admin")
async updateBomPreBatched(@Param("id") id: string, @Body() payload: { isPreBatched: boolean }) {
  await this.appRepository.updateBomPreBatched(id, payload.isPreBatched);
  return { success: true };
}
```

- [ ] **Step 4: Verify endpoints compile**

Run: `cd /srv/gustopos/apps/api && npx tsc --noEmit 2>&1 | grep -i "prepareBom\|getBomStock\|updateBomPreBatched"`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.controller.ts
git commit -m "feat(bom): add API endpoints for BOM stock management"
```

---

### Task 6: Repository — Modify explodeBomRequirements for Pre-Batched

**Covers:** [S5, S6]

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`

**Interfaces:**
- Consumes: `explodeBomRequirements()`, `bomItems.isPreBatched`
- Produces: modified `explodeBomRequirements()` that handles pre-batched BOMs

- [ ] **Step 1: Modify explodeBomRequirements to handle pre-batched BOMs**

```typescript
// apps/api/src/repository/app.repository.ts — modify explodeBomRequirements method
private explodeBomRequirements(params: {
  bomId: string;
  multiplier: number;
  bomById: Map<string, BomRow>;
  componentsByBomId: Map<string, BomComponentRow[]>;
  visited?: Set<string>;
}): Map<string, number> {
  const { bomId, multiplier, bomById, componentsByBomId } = params;
  const visited = params.visited ?? new Set<string>();

  if (visited.has(bomId)) {
    const bomName = bomById.get(bomId)?.name ?? bomId;
    throw new Error(`BoM recursion cycle detected at "${bomName}" (${bomId})`);
  }

  const bom = bomById.get(bomId);
  if (!bom) {
    throw new Error(`BoM item ${bomId} not found`);
  }

  if (bom.isActive !== 1) {
    throw new Error(`BoM "${bom.name}" (${bomId}) is not active`);
  }

  const yieldQty = toNumeric(bom.yieldQuantity);
  if (yieldQty <= 0) {
    throw new Error(`Invalid BoM yield for ${bomId}`);
  }

  // NEW: If BOM is pre-batched, return it as a single ingredient requirement
  // The stock check happens in createOrder before calling this method
  if (bom.isPreBatched === 1) {
    const requirements = new Map<string, number>();
    requirements.set(bomId, multiplier);
    return requirements;
  }

  const normalizedMultiplier = multiplier / yieldQty;
  const components = componentsByBomId.get(bomId) ?? [];
  const requirements = new Map<string, number>();

  const nextVisited = new Set(visited);
  nextVisited.add(bomId);

  for (const component of components) {
    const qty = toNumeric(component.quantity) * normalizedMultiplier;

    if (component.componentType === "ingredient") {
      const current = requirements.get(component.componentId) ?? 0;
      requirements.set(component.componentId, current + qty);
      continue;
    }

    if (component.componentType === "bom") {
      const nested = this.explodeBomRequirements({
        bomId: component.componentId,
        multiplier: qty,
        bomById,
        componentsByBomId,
        visited: nextVisited,
      });

      for (const [ingredientId, nestedQty] of nested) {
        const current = requirements.get(ingredientId) ?? 0;
        requirements.set(ingredientId, current + nestedQty);
      }
    }
  }

  return requirements;
}
```

- [ ] **Step 2: Verify method compiles**

Run: `cd /srv/gustopos/apps/api && npx tsc --noEmit 2>&1 | grep -i "explodeBomRequirements"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/repository/app.repository.ts
git commit -m "feat(bom): modify explodeBomRequirements for pre-batched BOMs"
```

---

### Task 7: Repository — Modify createOrder for BOM Stock Check

**Covers:** [S5, S6]

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts`

**Interfaces:**
- Consumes: `explodeBomRequirements()` (modified), `bomItems.isPreBatched`, `bomItems.stockQuantity`
- Produces: modified `createOrder()` that checks BOM stock before exploding

- [ ] **Step 1: Add BOM stock check in createOrder**

```typescript
// apps/api/src/repository/app.repository.ts — in createOrder method, after fetching BOM requirements
// Find the section where BOM requirements are exploded and add stock check

// BEFORE the main explosion loop, add this check:
const preBatchedBoms = new Map<string, { bomId: string; quantity: number; name: string }>();

for (const [menuItemId, bomReqs] of bomByMenuId.entries()) {
  for (const req of bomReqs) {
    const bom = bomById.get(req.bomId);
    if (bom && bom.isPreBatched === 1) {
      const existing = preBatchedBoms.get(req.bomId);
      if (existing) {
        existing.quantity += req.quantity * (orderItems.find(i => i.menuItemId === menuItemId)?.quantity ?? 1);
      } else {
        preBatchedBoms.set(req.bomId, {
          bomId: req.bomId,
          quantity: req.quantity * (orderItems.find(i => i.menuItemId === menuItemId)?.quantity ?? 1),
          name: bom.name,
        });
      }
    }
  }
}

// Check stock for all pre-batched BOMs
for (const [, bomReq] of preBatchedBoms) {
  const bom = bomById.get(bomReq.bomId);
  if (!bom) throw new Error(`BOM ${bomReq.bomId} not found`);
  
  const currentStock = toNumeric(bom.stockQuantity);
  if (currentStock < bomReq.quantity) {
    throw new Error(`${bom.name} non disponibile (stock: ${currentStock})`);
  }
}

// Deduct from pre-batched BOM stock
for (const [, bomReq] of preBatchedBoms) {
  await tx.update(bomItems)
    .set({ stockQuantity: sql`${bomItems.stockQuantity} - ${bomReq.quantity}` })
    .where(eq(bomItems.id, bomReq.bomId));
}
```

- [ ] **Step 2: Verify method compiles**

Run: `cd /srv/gustopos/apps/api && npx tsc --noEmit 2>&1 | grep -i "createOrder"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/repository/app.repository.ts
git commit -m "feat(bom): add BOM stock check in createOrder"
```

---

### Task 8: Shared Contracts — Add API Schemas

**Covers:** [S4]

**Files:**
- Modify: `packages/shared/src/contracts.ts`

**Interfaces:**
- Consumes: existing Zod schemas
- Produces: `prepareBomSchema`, `bomStockSchema`

- [ ] **Step 1: Add prepareBomSchema**

```typescript
// packages/shared/src/contracts.ts — add new schemas
export const prepareBomSchema = z.object({
  quantity: z.number().positive(),
});

export const bomStockItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  stockQuantity: z.number(),
  unit: z.string(),
});
```

- [ ] **Step 2: Verify shared package builds**

Run: `npm run build --workspace @gustopos/shared`

Expected: Builds successfully

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/contracts.ts
git commit -m "feat(bom): add Zod schemas for BOM stock API"
```

---

### Task 9: Web — Add fetchBomStock and prepareBom API Functions

**Covers:** [S4]

**Files:**
- Modify: `apps/web/src/shared/api/client.ts`

**Interfaces:**
- Consumes: `bomStockItemSchema`, `prepareBomSchema` from shared
- Produces: `fetchBomStock()`, `prepareBom(id, quantity)`

- [ ] **Step 1: Add fetchBomStock function**

```typescript
// apps/web/src/shared/api/client.ts — add new function
export async function fetchBomStock(): Promise<Array<{
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
}>> {
  const res = await fetch(`${API_BASE}/api/bom/stock`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch BOM stock");
  return res.json();
}
```

- [ ] **Step 2: Add prepareBom function**

```typescript
// apps/web/src/shared/api/client.ts — add new function
export async function prepareBom(id: string, quantity: number): Promise<{
  bomId: string;
  name: string;
  previousStock: number;
  newStock: number;
  ingredientsDeducted: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
}> {
  const res = await fetch(`${API_BASE}/api/bom/${id}/prepare`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to prepare BOM");
  }
  return res.json();
}
```

- [ ] **Step 3: Add updateBomPreBatched function**

```typescript
// apps/web/src/shared/api/client.ts — add new function
export async function updateBomPreBatched(id: string, isPreBatched: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/api/bom/${id}/pre-batched`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ isPreBatched }),
  });
  if (!res.ok) throw new Error("Failed to update BOM");
}
```

- [ ] **Step 4: Verify web builds**

Run: `npm run build --workspace @gustopos/web`

Expected: Builds successfully

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/shared/api/client.ts
git commit -m "feat(bom): add API client functions for BOM stock"
```

---

### Task 10: Web — Create BomStockCard Component

**Covers:** [S7]

**Files:**
- Create: `apps/web/src/components/inventory/BomStockCard.tsx`

**Interfaces:**
- Consumes: `fetchBomStock()`, `prepareBom()` from client
- Produces: `BomStockCard` component

- [ ] **Step 1: Create BomStockCard component**

```tsx
// apps/web/src/components/inventory/BomStockCard.tsx
import { useState, useEffect } from "react";
import { fetchBomStock, prepareBom } from "../../shared/api/client";
import { Button } from "../shared/ui/atoms/Button";
import { Skeleton } from "../shared/ui/atoms/Skeleton";

interface BomStockItem {
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
}

export default function BomStockCard() {
  const [stock, setStock] = useState<BomStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState<string | null>(null);

  const loadStock = async () => {
    try {
      const data = await fetchBomStock();
      setStock(data);
    } catch (e) {
      console.error("Failed to load BOM stock", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const handlePrepare = async (bomId: string, quantity: number) => {
    setPreparing(bomId);
    try {
      await prepareBom(bomId, quantity);
      await loadStock();
    } catch (e: any) {
      alert(e.message || "Errore nella preparazione");
    } finally {
      setPreparing(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (stock.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-sm mb-3">Preparazioni</h3>
      <div className="space-y-3">
        {stock.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div>
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-xs text-gray-500">
                Stock: <span className={item.stockQuantity === 0 ? "text-red-600 font-bold" : ""}>{item.stockQuantity}</span> {item.unit}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrepare(item.id, 1)}
                disabled={preparing === item.id}
              >
                +1
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrepare(item.id, 5)}
                disabled={preparing === item.id}
              >
                +5
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePrepare(item.id, 10)}
                disabled={preparing === item.id}
              >
                +10
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /srv/gustopos/apps/web && npx tsc --noEmit 2>&1 | grep -i "BomStockCard"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/inventory/BomStockCard.tsx
git commit -m "feat(bom): create BomStockCard component"
```

---

### Task 11: Web — Add BomStockCard to Inventory Dashboard

**Covers:** [S7]

**Files:**
- Modify: `apps/web/src/components/inventory/InventoryTabs.tsx`

**Interfaces:**
- Consumes: `BomStockCard` component
- Produces: Updated dashboard with BOM stock section

- [ ] **Step 1: Import and add BomStockCard to dashboard**

```tsx
// apps/web/src/components/inventory/InventoryTabs.tsx — add import
import BomStockCard from "./BomStockCard";

// In the dashboard section, add after other cards:
<BomStockCard />
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /srv/gustopos/apps/web && npx tsc --noEmit 2>&1 | grep -i "InventoryTabs"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/inventory/InventoryTabs.tsx
git commit -m "feat(bom): add BomStockCard to inventory dashboard"
```

---

### Task 12: Web — Add Pre-Batched Toggle to BomTab

**Covers:** [S7]

**Files:**
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

**Interfaces:**
- Consumes: `updateBomPreBatched()` from client
- Produces: Toggle switch in BOM edit modal

- [ ] **Step 1: Add toggle for isPreBatched in BomTab edit modal**

```tsx
// apps/web/src/components/inventory/BomTab.tsx — in the edit modal
// Add a toggle switch for isPreBatched

<div className="flex items-center gap-2">
  <label className="text-sm font-medium">Pre-preparata</label>
  <input
    type="checkbox"
    checked={editingBom?.isPreBatched === 1}
    onChange={(e) => {
      if (editingBom) {
        updateBomPreBatched(editingBom.id, e.target.checked);
        setEditingBom({ ...editingBom, isPreBatched: e.target.checked ? 1 : 0 });
      }
    }}
    className="w-4 h-4"
  />
  <span className="text-xs text-gray-500">
    Abilita stock separato per questa preparazione
  </span>
</div>
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /srv/gustopos/apps/web && npx tsc --noEmit 2>&1 | grep -i "BomTab"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/inventory/BomTab.tsx
git commit -m "feat(bom): add pre-batched toggle to BomTab"
```

---

### Task 13: Web — Add Stock Badge to BomTab Cards

**Covers:** [S7]

**Files:**
- Modify: `apps/web/src/components/inventory/BomCards.tsx`

**Interfaces:**
- Consumes: BOM data with `stockQuantity` and `isPreBatched`
- Produces: Stock badge on BOM cards

- [ ] **Step 1: Add stock badge to BomCards**

```tsx
// apps/web/src/components/inventory/BomCards.tsx — in the card render
// Add stock badge for pre-batched BOMs

{bom.isPreBatched === 1 && (
  <div className={`text-xs px-2 py-1 rounded-full ${
    bom.stockQuantity === 0 
      ? "bg-red-100 text-red-700" 
      : "bg-green-100 text-green-700"
  }`}>
    Stock: {bom.stockQuantity} {bom.unit}
  </div>
)}
```

- [ ] **Step 2: Verify component compiles**

Run: `cd /srv/gustopos/apps/web && npx tsc --noEmit 2>&1 | grep -i "BomCards"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/inventory/BomCards.tsx
git commit -m "feat(bom): add stock badge to BomCards"
```

---

### Task 14: Web — Update App Store for BOM Stock

**Covers:** [S7]

**Files:**
- Modify: `apps/web/src/store/app-store.ts`

**Interfaces:**
- Consumes: `fetchBomStock()` from client
- Produces: `bomStock` state in store

- [ ] **Step 1: Add bomStock to app store**

```typescript
// apps/web/src/store/app-store.ts — add to store interface and implementation
bomStock: Array<{
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
}>;
fetchBomStock: () => Promise<void>;

// In store implementation:
bomStock: [],
fetchBomStock: async () => {
  const stock = await fetchBomStock();
  set({ bomStock: stock });
},
```

- [ ] **Step 2: Verify store compiles**

Run: `cd /srv/gustopos/apps/web && npx tsc --noEmit 2>&1 | grep -i "app-store"`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/app-store.ts
git commit -m "feat(bom): add bomStock to app store"
```

---

### Task 15: Mark Cartoccio and Carbocrema as Pre-Batched

**Covers:** [S9]

**Files:**
- None (database update)

**Interfaces:**
- Consumes: `bom_items` table
- Produces: Updated `is_pre_batched` for Cartoccio and Carbocrema

- [ ] **Step 1: Mark Cartoccio as pre-batched**

Run: `PGPASSWORD=gustopos_dev_password psql -h localhost -U postgres -d gustopos -c "UPDATE bom_items SET is_pre_batched = 1 WHERE id = 'bom_mrnkkugn';"`

- [ ] **Step 2: Mark Carbocrema as pre-batched**

Run: `PGPASSWORD=gustopos_dev_password psql -h localhost -U postgres -d gustopos -c "UPDATE bom_items SET is_pre_batched = 1 WHERE id = 'bom_mrnhssj1';"`

- [ ] **Step 3: Verify updates**

Run: `PGPASSWORD=gustopos_dev_password psql -h localhost -U postgres -d gustopos -c "SELECT id, name, is_pre_batched, stock_quantity FROM bom_items WHERE id IN ('bom_mrnkkugn', 'bom_mrnhssj1');"`

Expected: Both show `is_pre_batched = 1`

- [ ] **Step 4: Commit (optional — data migration)**

```bash
git add -A
git commit -m "chore(bom): mark Cartoccio and Carbocrema as pre-batched"
```

---

### Task 16: Rebuild and Verify

**Covers:** [S9]

**Files:**
- None

**Interfaces:**
- Consumes: all previous tasks
- Produces: working system

- [ ] **Step 1: Build shared package**

Run: `npm run build --workspace @gustopos/shared`

- [ ] **Step 2: Build API**

Run: `npm run build --workspace @gustopos/api`

- [ ] **Step 3: Build web**

Run: `npm run build --workspace @gustopos/web`

- [ ] **Step 4: Restart PM2 processes**

Run: `pm2 restart gustopos-api gustopos-web`

- [ ] **Step 5: Test prepare endpoint**

Run: `curl -X POST http://localhost:11901/api/bom/bom_mrnkkugn/prepare -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"quantity": 10}'`

Expected: Returns success with ingredients deducted

- [ ] **Step 6: Test stock endpoint**

Run: `curl http://localhost:11901/api/bom/stock -H "Authorization: Bearer <token>"`

Expected: Returns Cartoccio and Carbocrema with stock

- [ ] **Step 7: Commit final state**

```bash
git add -A
git commit -m "feat(bom): complete BOM stock levels implementation"
```
