import { and, asc, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import {
  categories,
  categoryModifierPools,
  categoryModifierPoolCategories,
  categoryModifierPoolOptions,
  menuItems,
  menuModifierGroups,
  menuModifierOptions,
} from "../src/db/schema";

/**
 * One-off: create the "Base componibile" CATEGORY MODIFIER POOL for the `Drinks`
 * category (all cocktails) of tenant `franks`.
 *
 * Requirement: the 30 buildable bases of a cocktail must be selectable on EVERY
 * cocktail, at ZERO cost (they exist only so the bar ticket prints what went
 * into the glass).
 *
 * Source of truth: the product-level group "Base componibile" already on the
 * COCKTAIL item. Its options are copied 1:1 (name, ingredient component,
 * quantity/unit) with `price_delta = 0.00` and no multiplier, so pricing is
 * unchanged by construction.
 *
 * The COCKTAIL product group is deactivated in the SAME transaction: without
 * it COCKTAIL would show the same 30 entries twice (inline group + pool in
 * "Personalizza"). The rows are kept (never deleted) so historical tickets
 * still reprint a name instead of a raw `mo_…` id.
 *
 * The pool is linked to `Drinks` only: beers (Bevande) and the uncategorised
 * AMARO / wine items are deliberately untouched.
 *
 * Idempotent (pool already present → exit) and transactional (all-or-nothing).
 *
 * Usage:
 *   DATABASE_URL=postgresql://… npx tsx apps/api/scripts/franks-cocktail-base-pool.ts
 *   POOL_TENANT_ID=ten_… npx tsx apps/api/scripts/franks-cocktail-base-pool.ts   # other tenant
 */
const TENANT_ID = process.env.POOL_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const CATEGORY_NAME = "Drinks";
const POOL_NAME = "Base componibile";
const SOURCE_ITEM_NAME = "COCKTAIL";
const SOURCE_GROUP_NAME = "Base componibile";

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function main() {
  const existingPools = await db
    .select({ id: categoryModifierPools.id })
    .from(categoryModifierPools)
    .where(and(eq(categoryModifierPools.tenantId, TENANT_ID), eq(categoryModifierPools.name, POOL_NAME)));

  if (existingPools.length > 0) {
    const stillActive = await db
      .select({ id: menuModifierOptions.id })
      .from(menuModifierGroups)
      .innerJoin(menuModifierOptions, eq(menuModifierOptions.groupId, menuModifierGroups.id))
      .where(and(
        eq(menuModifierGroups.tenantId, TENANT_ID),
        eq(menuModifierGroups.name, SOURCE_GROUP_NAME),
        eq(menuModifierOptions.isActive, 1),
      ));
    if (stillActive.length > 0) {
      console.warn(
        `WARNING: pool "${POOL_NAME}" exists (${existingPools[0].id}) but ${stillActive.length} option(s) of the ` +
          `"${SOURCE_GROUP_NAME}" product group are still active — COCKTAIL would show the list twice.`,
      );
    }
    console.log(`Skipped: pool "${POOL_NAME}" already present (${existingPools[0].id})`);
    await pool.end();
    return;
  }

  const categoryRows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(
      eq(categories.tenantId, TENANT_ID),
      eq(categories.name, CATEGORY_NAME),
      eq(categories.scope, "menu"),
    ));
  if (categoryRows.length === 0) {
    throw new Error(`Category "${CATEGORY_NAME}" not found for tenant ${TENANT_ID}`);
  }
  if (categoryRows.length > 1) {
    throw new Error(`Multiple "${CATEGORY_NAME}" categories for tenant ${TENANT_ID}`);
  }
  const categoryId = categoryRows[0].id;

  const itemRows = await db
    .select({ id: menuItems.id, name: menuItems.name })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, TENANT_ID), eq(menuItems.name, SOURCE_ITEM_NAME)));
  if (itemRows.length !== 1) {
    throw new Error(`Expected exactly one "${SOURCE_ITEM_NAME}" item, found ${itemRows.length}`);
  }

  const groupRows = await db
    .select({ id: menuModifierGroups.id, sortOrder: menuModifierGroups.sortOrder })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, itemRows[0].id),
      eq(menuModifierGroups.name, SOURCE_GROUP_NAME),
    ));
  if (groupRows.length !== 1) {
    throw new Error(`Expected exactly one "${SOURCE_GROUP_NAME}" group on ${SOURCE_ITEM_NAME}, found ${groupRows.length}`);
  }
  const sourceGroupId = groupRows[0].id;

  const optionRows = await db
    .select({
      id: menuModifierOptions.id,
      name: menuModifierOptions.name,
      componentType: menuModifierOptions.componentType,
      componentId: menuModifierOptions.componentId,
      quantity: menuModifierOptions.quantity,
      unit: menuModifierOptions.unit,
      sortOrder: menuModifierOptions.sortOrder,
      isActive: menuModifierOptions.isActive,
    })
    .from(menuModifierOptions)
    .where(and(eq(menuModifierOptions.tenantId, TENANT_ID), eq(menuModifierOptions.groupId, sourceGroupId)))
    .orderBy(asc(menuModifierOptions.sortOrder));

  if (optionRows.length === 0) {
    throw new Error(`No options found on group ${sourceGroupId}`);
  }

  const poolId = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  let deactivated = 0;

  await db.transaction(async (tx) => {
    await tx.insert(categoryModifierPools).values({
      id: poolId,
      tenantId: TENANT_ID,
      categoryId,
      name: POOL_NAME,
      sortOrder: 0,
    });

    await tx.insert(categoryModifierPoolCategories).values({
      id: `cmpc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      tenantId: TENANT_ID,
      poolId,
      categoryId,
    });

    await tx.insert(categoryModifierPoolOptions).values(
      optionRows.map((option, idx) => ({
        id: `cmpo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${idx}`,
        tenantId: TENANT_ID,
        poolId,
        name: option.name,
        // Mirrors the source option: the ingredient reference lives in
        // `component_id`, `inventory_item_id` stays NULL so the POS routes the
        // choice to a pool selection (printed by name) and never to an
        // ingredient "add" override.
        inventoryItemId: null,
        referenceId: null,
        componentType: option.componentType ?? "ingredient",
        componentId: option.componentId,
        quantity: String(option.quantity ?? 1),
        unit: option.unit ?? "pz",
        // Purely for printing: no price variation on adding a base.
        priceDelta: "0.00",
        priceMultiplier: null,
        isActive: 1,
        sortOrder: option.sortOrder ?? idx,
      })),
    );

    // COCKTAIL's own group is retired so the list exists in exactly one place.
    const deactivatedRows = await tx
      .update(menuModifierOptions)
      .set({ isActive: 0 })
      .where(and(eq(menuModifierOptions.tenantId, TENANT_ID), eq(menuModifierOptions.groupId, sourceGroupId)))
      .returning({ id: menuModifierOptions.id });
    deactivated = deactivatedRows.length;
  });

  console.log(`Pool "${POOL_NAME}" created: ${poolId}`);
  console.log(`  category     ${CATEGORY_NAME} (${categoryId})`);
  console.log(`  options      ${optionRows.length} (all price_delta = 0.00)`);
  console.log(`  COCKTAIL group "${SOURCE_GROUP_NAME}" deactivated: ${deactivated} option(s)`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
