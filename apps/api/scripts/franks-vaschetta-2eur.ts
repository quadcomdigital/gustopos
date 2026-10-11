import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { menuItems, menuModifierGroups, menuModifierOptions } from "../src/db/schema";

/**
 * One-off: the "VASCHETTA PATATINE" (€1.00) gets a +€1.00 option so the same
 * product can be sold as a €2.00 tray without duplicating the item.
 *
 * Shape (see `add-corretto-modifier.ts` for the same reasoning):
 *   - optional, never mandatory: unticked = today's €1.00 tray, nothing changes
 *     on the ticket;
 *   - `maxSelections > 1` with a single option so the POS renders a
 *     DESELECTABLE checkbox (a max=1 group would be a radio that cannot be
 *     cleared);
 *   - no ingredient/BoM backs the option (componentId null, exactly like
 *     "A piatto" and "Intera"): franks runs `simple_catalog`, so there is no
 *     stock movement, and `referenceId` stays null so the RIEPILOGO container
 *     tally keeps resolving from product/category;
 *   - group named "Grandezza" and NOT "Formato": in Magazzino a group called
 *     "Formato" routes the product to VariableProductModal (the variant
 *     builder), which requires ingredient + quantity per variant and does not
 *     round-trip an existing group.
 *
 * What prints once ticked:
 *   - kitchen comanda: `  Vaschetta da 2€` (2x1 bold, under the item name);
 *   - cashier receipt: `  Vaschetta da 2€ +EUR 1.00`;
 *   - POS / public menu: chip `Vaschetta da 2€ +€1,00`, price recomputed by
 *     `computeGroupModifierDelta` on the client and by `pricePublicLines`
 *     server-side.
 *
 * Idempotent: already-applied changes are skipped.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx apps/api/scripts/franks-vaschetta-2eur.ts
 */
const TENANT_ID = process.env.FRANKS_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const ITEM_NAME = "VASCHETTA PATATINE";
const GROUP_NAME = "Grandezza";
const OPTION_NAME = "Vaschetta da 2€";
const PRICE_DELTA = "1.00";
const SORT_ORDER = 0;

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function main() {
  const items = await db
    .select({ id: menuItems.id, name: menuItems.name, price: menuItems.price })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, TENANT_ID), eq(menuItems.name, ITEM_NAME)));

  if (items.length === 0) {
    throw new Error(`Item "${ITEM_NAME}" not found for tenant ${TENANT_ID}`);
  }
  if (items.length > 1) {
    throw new Error(`Multiple items named "${ITEM_NAME}" found: ${items.map((i) => i.id).join(", ")}`);
  }
  const item = items[0];

  const existingGroups = await db
    .select({ id: menuModifierGroups.id, name: menuModifierGroups.name })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, item.id),
    ));

  const duplicateOption = existingGroups.length > 0
    ? await db
        .select({ id: menuModifierOptions.id })
        .from(menuModifierOptions)
        .innerJoin(menuModifierGroups, eq(menuModifierGroups.id, menuModifierOptions.groupId))
        .where(and(
          eq(menuModifierOptions.tenantId, TENANT_ID),
          eq(menuModifierGroups.menuItemId, item.id),
          eq(menuModifierOptions.name, OPTION_NAME),
        ))
        .limit(1)
    : [];

  if (duplicateOption.length > 0) {
    console.log(`Skipped: "${OPTION_NAME}" already present on ${item.name}`);
    await pool.end();
    return;
  }

  const existingGroup = existingGroups.find(
    (group) => group.name.trim().toLocaleLowerCase("it") === GROUP_NAME.toLocaleLowerCase("it"),
  );
  if (existingGroup) {
    console.log(`Skipped: "${GROUP_NAME}" group already present on ${item.name} (${existingGroup.id})`);
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
    sortOrder: SORT_ORDER,
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
    sortOrder: SORT_ORDER,
    quantity: "1",
    unit: "pz",
  });

  console.log(
    `Created "${GROUP_NAME}" on ${item.name} (${item.id}) with "${OPTION_NAME}" (+€${PRICE_DELTA}); ` +
    `base price €${Number(item.price).toFixed(2)} → €${(Number(item.price) + Number(PRICE_DELTA)).toFixed(2)} when ticked`,
  );
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
