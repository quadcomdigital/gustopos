import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { menuItems, menuModifierGroups, menuModifierOptions } from "../src/db/schema";

/**
 * One-off: add an optional "Corretto" modifier to the "Analcolico" product.
 *
 * Requirement: a CHECKBOX the waiter can toggle on/off, never mandatory.
 * In the POS the checkbox/radio rendering is driven by `maxSelections > 1`
 * (see `isMultiSelectGroup` in @gustopos/shared): single-select groups render
 * as a radio and cannot be deselected. So the group is created as
 * multi-select (maxSelections 2) with a single option, which yields a
 * deselectable checkbox that adds +1.50 when ticked.
 *
 * Idempotent: if a "Corretto" group already exists on Analcolico, it is
 * skipped.
 *
 * Usage:
 *   npx tsx apps/api/scripts/add-corretto-modifier.ts
 */
const TENANT_ID = process.env.CORRETTO_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const ITEM_NAME = "Analcolico";
const GROUP_NAME = "Corretto";
const OPTION_NAME = "Corretto";
const PRICE_DELTA = "1.50";

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function main() {
  const items = await db
    .select({ id: menuItems.id, name: menuItems.name })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, TENANT_ID), eq(menuItems.name, ITEM_NAME)));

  if (items.length === 0) {
    throw new Error(`Item "${ITEM_NAME}" not found for tenant ${TENANT_ID}`);
  }
  if (items.length > 1) {
    throw new Error(`Multiple items named "${ITEM_NAME}" found: ${items.map((i) => i.id).join(", ")}`);
  }
  const item = items[0];

  const existing = await db
    .select({ id: menuModifierGroups.id })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, item.id),
      eq(menuModifierGroups.name, GROUP_NAME),
    ))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Skipped: "${GROUP_NAME}" already present on ${item.name}`);
    await pool.end();
    return;
  }

  const groupId = newId("mg");
  await db.insert(menuModifierGroups).values({
    id: groupId,
    tenantId: TENANT_ID,
    menuItemId: item.id,
    name: GROUP_NAME,
    required: 0,
    minSelections: 0,
    // > 1 so the POS renders a deselectable checkbox instead of a radio.
    maxSelections: 2,
    multiSelectPriceMode: "max",
    sortOrder: 1,
  });

  await db.insert(menuModifierOptions).values({
    id: newId("mo"),
    tenantId: TENANT_ID,
    groupId,
    name: OPTION_NAME,
    inventoryItemId: null,
    referenceId: null,
    componentType: "ingredient",
    componentId: null,
    priceDelta: PRICE_DELTA,
    isDefault: 0,
    isActive: 1,
    sortOrder: 0,
    quantity: "1",
    unit: "pz",
  });

  console.log(`Created "${GROUP_NAME}" (+€${PRICE_DELTA}) on ${item.name} (${item.id})`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
