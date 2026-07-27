# Supplier-Ingredient Wiring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire suppliers to ingredients so purchase orders auto-fill with the right items, costs, and brand names per supplier.

**Architecture:** Suppliers provide brands of generic ingredients. The `supplier_ingredients` join table links a supplier to an ingredient with a brand name and unit cost. When creating a PO, selecting a supplier auto-fills ingredients from that link. Receiving a PO updates stock and can update the supplier's unit cost.

**Tech Stack:** NestJS, Drizzle ORM, PostgreSQL, Zod, React, Zustand

## Design

### Data Model

```
Inventory (generic ingredients)
  └── supplier_ingredients (link: supplier + brand + cost)
        └── Suppliers (companies)
```

**Key principle:** An ingredient is always generic ("Mozzarella"). A supplier provides a brand of that ingredient ("Galbani Mozzarella" at €0.37/pz). The brand is a supplier-level detail, not an inventory-level one.

### Existing Tables
- `inventory` — generic ingredients (name, unit, unitCost, minThreshold)
- `suppliers` — supplier info (name, vat, phone, email)
- `supplier_ingredients` — **already created** but needs `brand_name` column
- `purchase_orders` — links to supplier
- `purchase_order_items` — links to inventory, has unitCost

### What Changes
1. Add `brand_name` to `supplier_ingredients` (the brand this supplier sells)
2. PO creation: when selecting a supplier, auto-fill items from `supplier_ingredients`
3. PO receiving: update `inventory.unitCost` with the actual received cost
4. Inventory view: show which supplier provides each ingredient + brand

### File Structure

| File | Responsibility |
|------|---------------|
| `apps/api/src/db/schema.ts` | Add `brandName` to `supplier_ingredients` |
| `packages/shared/src/contracts.ts` | Update Zod schemas with `brandName` |
| `apps/api/src/repository/app.repository.ts` | PO auto-fill logic, cost update on receive |
| `apps/api/src/app.controller.ts` | New/updated endpoints |
| `apps/web/src/shared/api/client.ts` | Client functions |
| `apps/web/src/components/PurchasingView.tsx` | UI: supplier-ingredient links, PO creation |

---

### Task 1: Add `brandName` to supplier_ingredients

**Files:**
- Modify: `apps/api/src/db/schema.ts:492-505`
- Modify: `packages/shared/src/contracts.ts` (supplierIngredient schemas)
- Create: `apps/api/drizzle/0035_xxx.sql` (migration)

- [ ] Add `brandName` column to `supplierIngredients` table in schema:
  ```ts
  brandName: text("brand_name"),
  ```
- [ ] Update Zod schemas to include `brandName: z.string().optional()`
- [ ] Generate migration: `npm run db:generate --workspace @gustopos/api`
- [ ] Apply migration: `DATABASE_URL="postgresql://postgres:gustopos_dev_password@localhost:5432/gustopos" npx drizzle-kit migrate`
- [ ] Verify: `npx tsc --noEmit --project apps/api/tsconfig.json`

---

### Task 2: PO auto-fill from supplier_ingredients

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (add method)
- Modify: `apps/api/src/app.controller.ts` (add endpoint)
- Modify: `apps/web/src/shared/api/client.ts` (add client function)

When user selects a supplier for a PO, fetch their ingredients to pre-fill the order.

- [ ] Add `getSupplierIngredientsForPo(supplierId)` method in repository:
  ```ts
  async getSupplierIngredientsForPo(supplierId: string) {
    // Returns ingredients from supplier_ingredients with current DB cost
    // Joins inventory to get current stock level and unit
    // Returns: [{ ingredientId, name, brandName, supplierCost, currentCost, currentStock, unit }]
  }
  ```
- [ ] Add endpoint: `GET /purchasing/suppliers/:id/po-items`
- [ ] Add client function: `fetchSupplierPoItems(supplierId: string)`
- [ ] Verify: typecheck passes

---

### Task 3: PO receiving updates inventory cost

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (existing receive logic)
- Modify: `apps/api/src/app.controller.ts` (existing receive endpoint)

When goods are received, the actual cost may differ from the quoted cost. Update inventory.unitCost and supplier_ingredients.unitCost.

- [ ] Find existing goods receipt logic in repository
- [ ] After receiving, update `inventory.unitCost` with the received unit cost
- [ ] Also update `supplier_ingredients.unitCost` for that supplier+ingredient
- [ ] Verify: typecheck passes

---

### Task 4: Inventory view shows supplier info

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (inventory list query)
- Modify: `apps/web/src/components/PurchasingView.tsx` (or InventoryView)

Each ingredient in the inventory list should show its preferred supplier and brand.

- [ ] Modify inventory list query to LEFT JOIN `supplier_ingredients` (where isPreferred=1)
- [ ] Add `supplierName`, `brandName` to inventory response
- [ ] Display in inventory table: Supplier column with brand name
- [ ] Verify: typecheck passes

---

### Task 5: Supplier-ingredient link management UI

**Files:**
- Modify: `apps/web/src/components/PurchasingView.tsx` (or new component)

UI to manage which ingredients a supplier provides, with brand name and cost.

- [ ] Add "Ingredients" tab/section in supplier detail view
- [ ] Show table: Ingredient | Brand | Unit Cost | Preferred | Actions
- [ ] Add/edit/remove links
- [ ] Bulk import: "Link all ingredients from XLSX to this supplier"
- [ ] Verify: typecheck passes

---

### Task 6: PO creation with auto-fill

**Files:**
- Modify: `apps/web/src/components/PurchasingView.tsx` (PO creation flow)

When creating a PO, selecting a supplier auto-fills the order items.

- [ ] Supplier dropdown in PO creation form
- [ ] On supplier select, call `fetchSupplierPoItems(supplierId)`
- [ ] Pre-fill PO items table with: Ingredient | Brand | Qty | Unit Cost
- [ ] User can adjust quantities and costs
- [ ] Save PO
- [ ] Verify: typecheck passes

---

## Expected Flow (End-to-End)

1. **Setup (once):** Create suppliers → Link ingredients to suppliers with brand + cost
2. **Reorder (weekly):** Create PO → Select supplier → Items auto-fill → Adjust qty → Save
3. **Receive (on delivery):** Receive PO → Stock updates → Costs update if changed
4. **Monitor:** Inventory view shows supplier + brand for each ingredient
