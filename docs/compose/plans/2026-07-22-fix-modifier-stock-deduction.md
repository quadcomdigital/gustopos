# Fix Modifier Stock Deduction & Container Counting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the stock deduction bug where modifier options with `inventory_item_id` are never deducted, and fix the CONTENITORI counting to include selected modifiers.

**Architecture:** Two-part fix: (1) Remove bread ingredients from BOMs since they're selected via modifiers, (2) Add deduction logic for modifier options with `inventory_item_id`.

**Tech Stack:** PostgreSQL, Drizzle ORM, NestJS API

## Global Constraints

- Tenant: `ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f` (Franks)
- 18 BOMs have bread components that must be removed
- 131 modifier options have `inventory_item_id` but NO `bom_id` — currently never deducted
- Build order: shared → api → web → print-bridge

---

## The Problem (Data Evidence)

### Current State

```
Smash Burger Order:
├── BOM: bom_smash_burger
│   └── Bun classico (i_bun_classico) × 1  ← ALWAYS deducted
│
└── Modifier: "Tipo di pane" → Customer selects Piadina
    └── Piadina (i_piadina)  ← NEVER deducted (no bom_id!)
```

**Result:**
- Bun classico: -1 (WRONG — customer didn't want it!)
- Piadina: 0 (WRONG — not deducted!)

### Data Statistics

| Metric | Count |
|--------|-------|
| BOMs with bread components | 18 |
| Menu items affected | 18 |
| Modifier options with `inventory_item_id` only | 131 |
| Modifier options with `bom_id` only | 50 |

---

## Task 1: Remove Bread Ingredients from BOMs

**Covers:** Fix BOM recipes to not include selectable bread

**Files:**
- SQL script (direct DB modification)

**Interfaces:**
- Produces: BOMs without bread ingredients, bread selected only via modifiers

- [ ] **Step 1: Remove bread components from all 18 BOMs**

```sql
-- Remove bread ingredients from BOMs
DELETE FROM bom_components
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND component_type = 'ingredient'
AND component_id IN (
  SELECT id FROM inventory
  WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
  AND name ILIKE ANY(ARRAY['%bun%', '%panino%', '%piadina%'])
);
```

Expected: ~18 rows deleted (one per BOM)

- [ ] **Step 2: Verify BOMs no longer have bread**

```sql
SELECT bc.bom_id, bi.name, i.name as ingredient
FROM bom_components bc
JOIN bom_items bi ON bi.id = bc.bom_id
JOIN inventory i ON i.id = bc.component_id
WHERE bc.tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND i.name ILIKE ANY(ARRAY['%bun%', '%panino%', '%piadina%']);
```

Expected: 0 rows

- [ ] **Step 3: Verify BOMs still have other ingredients**

```sql
SELECT bc.bom_id, bi.name, COUNT(*) as ingredient_count
FROM bom_components bc
JOIN bom_items bi ON bi.id = bc.bom_id
WHERE bc.tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
GROUP BY bc.bom_id, bi.name
ORDER BY bi.name;
```

Expected: All 18 BOMs still have remaining ingredients (Pomodoro, Smash, Bacon, etc.)

---

## Task 2: Add Inventory Deduction for Modifier Options

**Covers:** Deduct `inventory_item_id` from modifier options during order creation

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (createOrder method, ~line 4215)

**Interfaces:**
- Consumes: `modifierOptionsByOptionId` map (already loaded)
- Produces: Inventory deducted for modifier options with `inventory_item_id`

- [ ] **Step 1: Locate the modifier deduction code**

In `createOrder` method, find the loop around line 4215:

```typescript
// Deduct inventory from modifier options that reference BOMs (e.g., ingredient portions)
for (const mod of item.selectedModifiers ?? []) {
  const modOption = modifierOptionsByOptionId.get(mod.optionId);
  if (modOption?.bomId) {
    // ... existing BOM deduction
  }
}
```

- [ ] **Step 2: Add inventory_item_id deduction**

After the existing `bomId` check, add deduction for `inventoryItemId`:

```typescript
for (const mod of item.selectedModifiers ?? []) {
  const modOption = modifierOptionsByOptionId.get(mod.optionId);
  if (modOption?.bomId) {
    // Existing: deduct via BOM explosion
    const exploded = this.explodeBomRequirements({
      bomId: modOption.bomId,
      multiplier: 1,
      bomById,
      componentsByBomId: bomComponentsById,
    });
    for (const [ingredientId, qty] of exploded) {
      const current = consumptionByIngredient.get(ingredientId) ?? 0;
      consumptionByIngredient.set(ingredientId, current + qty * item.quantity);
    }
  }
  
  // NEW: deduct inventory_item_id directly
  if (modOption?.inventoryItemId) {
    const current = consumptionByIngredient.get(modOption.inventoryItemId) ?? 0;
    consumptionByIngredient.set(modOption.inventoryItemId, current + 1 * item.quantity);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/api
```

Expected: No errors

---

## Task 3: Also Handle Category Pool Options

**Covers:** Deduct `inventory_item_id` from category pool options

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (createOrder method)

**Interfaces:**
- Consumes: `catPoolOptionsByOptionId` map (if exists)
- Produces: Inventory deducted for pool options with `inventory_item_id`

- [ ] **Step 1: Check if pool options are handled**

Look for how category pool options are loaded in `createOrder`. They may be in a separate map.

- [ ] **Step 2: Add pool option deduction**

After the modifier options loop, add similar logic for pool options:

```typescript
// Deduct inventory from category pool options
for (const mod of item.selectedModifiers ?? []) {
  const poolOption = catPoolOptionsByOptionId?.get(mod.optionId);
  if (poolOption?.inventoryItemId) {
    const current = consumptionByIngredient.get(poolOption.inventoryItemId) ?? 0;
    consumptionByIngredient.set(poolOption.inventoryItemId, current + 1 * item.quantity);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/api
```

Expected: No errors

---

## Task 4: Fix CONTENITORI Counting for Modifiers

**Covers:** Count selected modifier items in CONTENITORI section

**Files:**
- Modify: `apps/api/src/repository/app.repository.ts` (createPrintJobsForOrder method)

**Interfaces:**
- Consumes: `selectedModifiers` from order items
- Produces: CONTENITORI includes modifier selections

- [ ] **Step 1: Locate the container counting code**

In `createPrintJobsForOrder`, find the loop that counts inventory (around line 1084-1098).

- [ ] **Step 2: Add modifier counting**

After counting pool options, add counting for modifier options:

```typescript
// Count modifier options that are containers
for (const mod of item.selectedModifiers ?? []) {
  const modOption = modifierOptionsByOptionId.get(mod.optionId);
  if (!modOption?.inventoryItemId) continue;
  
  // Check if this inventory item is a container
  const isContainer = inventoryIsContainerById.get(modOption.inventoryItemId) ?? 0;
  if (!isContainer) continue;
  
  const invName = inventoryNameById.get(modOption.inventoryItemId) ?? modOption.inventoryItemId;
  const counts = inventoryCountByArea.get(area) ?? {};
  counts[invName] = (counts[invName] ?? 0) + item.quantity;
  inventoryCountByArea.set(area, counts);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run lint --workspace @gustopos/api
```

Expected: No errors

---

## Task 5: Update isContainer Flags on Inventory

**Covers:** Mark bread items as containers

**Files:**
- SQL script (direct DB modification)

**Interfaces:**
- Produces: `is_container = 1` on Bun classico, Panino, Piadina

- [ ] **Step 1: Mark bread items as containers**

```sql
UPDATE inventory
SET is_container = 1
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND name ILIKE ANY(ARRAY['%bun%', '%panino%', '%piadina%']);
```

Expected: ~3 rows updated

- [ ] **Step 2: Verify is_container flags**

```sql
SELECT id, name, is_container
FROM inventory
WHERE tenant_id = 'ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f'
AND name ILIKE ANY(ARRAY['%bun%', '%panino%', '%piadina%']);
```

Expected: All 3 items show `is_container = 1`

---

## Task 6: Test the Complete Flow

**Covers:** End-to-end verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working system

- [ ] **Step 1: Verify Smash Burger BOM no longer has bread**

```sql
SELECT bc.component_id, i.name
FROM bom_components bc
JOIN inventory i ON i.id = bc.component_id
WHERE bc.bom_id = 'bom_smash_burger';
```

Expected: No Bun classico, only Pomodoro, Smash, Bacon, Cheddar, Lattuga

- [ ] **Step 2: Test order creation via API**

Create a test order with Smash Burger + Piadina modifier. Verify:
- Piadina is deducted from inventory
- Bun classico is NOT deducted
- Other ingredients are deducted correctly

- [ ] **Step 3: Verify kitchen receipt shows CONTENITORI**

Check that the kitchen receipt shows:
```
*** CONTENITORI ***
PIADINA                            1
```

Instead of:
```
*** REFERENZE ***
BUN CLASSICO                       1  ← wrong!
```

- [ ] **Step 4: Run all tests**

```bash
npm test --workspace @gustopos/api
```

Expected: All tests pass

---

## Summary of Changes

| Task | Change | Impact |
|------|--------|--------|
| Task 1 | Remove bread from 18 BOMs | Bread no longer hardcoded in recipes |
| Task 2 | Add inventory_item_id deduction | Modifier selections now deducted |
| Task 3 | Add pool option deduction | Pool selections now deducted |
| Task 4 | Fix CONTENITORI counting | Shows selected bread in receipt |
| Task 5 | Mark bread as isContainer | Enables container counting |
| Task 6 | End-to-end verification | Confirms everything works |

## Expected Behavior After Fix

### Smash Burger + Piadina Order

```
1. Order: 1x Smash Burger + Piadina modifier
2. Stock deduction:
   - Piadina: -1  ✓ (selected by customer)
   - Bun classico: 0  ✓ (not selected)
   - Pomodoro: -50g  ✓
   - Smash: -180g  ✓
   - Bacon: -3  ✓
   - Cheddar: -2  ✓
   - Lattuga: -50g  ✓

3. Kitchen receipt:
   *** CONTENITORI ***
   PIADINA                            1
   
   ** 1x Smash Burger**
     [Tipo di pane: Piadina]
```

### Smash Burger + Bun Order (default)

```
1. Order: 1x Smash Burger + Bun classico modifier
2. Stock deduction:
   - Bun classico: -1  ✓ (selected by customer)
   - Pomodoro: -50g  ✓
   - Smash: -180g  ✓
   - etc.

3. Kitchen receipt:
   *** CONTENITORI ***
   BUN CLASSICO                       1
   
   ** 1x Smash Burger**
     [Tipo di pane: Bun classico]
```
