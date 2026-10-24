import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { menuItems, menuModifierGroups, menuModifierOptions } from "../src/db/schema";

/**
 * One-off: the "VASCHETTA" (€3.00) gets a +€2.00 option so the same product can
 * be sold as a €5.00 larger tray without duplicating the item.
 *
 * Shape (same reasoning as `franks-vaschetta-2eur.ts`):
 *   - optional, never mandatory: unticked = today's €3.00 tray, nothing changes
 *     on the ticket;
 *   - `maxSelections > 1` with a single option so the POS renders a
 *     DESELECTABLE checkbox (a max=1 group would be a radio that cannot be
 *     cleared);
 *   - no ingredient/BoM backs the option (componentId null, exactly like
 *     "Vaschetta da 2€"): franks runs `simple_catalog`, so there is no stock
 *     movement, and `referenceId` stays null so the RIEPILOGO container tally
 *     keeps resolving from product/category;
 *   - group named "Grandezza" and NOT "Formato": in Magazzino a group called
 *     "Formato" routes the product to VariableProductModal (the variant
 *     builder), which requires ingredient + quantity per variant and does not
 *     round-trip an existing group.
 *
 * The "A scelta" group stays untouched (required, 1–6, all €0.00): the €5
 * variant is a manual price override for the bigger tray, it does not unlock
 * extra choices.
 *
 * What prints once ticked:
 *   - kitchen comanda: `  Vaschetta da 5€` (2x1 bold, under the item name);
 *   - cashier receipt: `  Vaschetta da 5€ +EUR 2.00`;
 *   - POS / public menu: chip `Vaschetta da 5€ +€2,00`, price recomputed by
 *     `computeGroupModifierDelta` on the client and by `pricePublicLines`
 *     server-side.
 *
 * Idempotent: already-applied changes are skipped.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx apps/api/scripts/franks-vaschetta-5eur.ts
 */
const TENANT_ID = process.env.FRANKS_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const ITEM_NAME = "VASCHETTA";
const GROUP_NAME = "Grandezza";
const OPTION_NAME = "Vaschetta da 5€";
const PRICE_DELTA = "2.00";
const GROUP_SORT_ORDER = 0;
const CHOICE_GROUP_SORT_ORDER = 1;

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const normalized = (value: string) => value.trim().toLocaleLowerCase("it");

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
    .select({ id: menuModifierGroups.id, name: menuModifierGroups.name, sortOrder: menuModifierGroups.sortOrder })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, item.id),
    ));

  const existingGroup = existingGroups.find((group) => normalized(group.name) === normalized(GROUP_NAME));

  const duplicateOption = existingGroup
    ? await db
        .select({ id: menuModifierOptions.id })
        .from(menuModifierOptions)
        .where(and(
          eq(menuModifierOptions.tenantId, TENANT_ID),
          eq(menuModifierOptions.groupId, existingGroup.id),
          eq(menuModifierOptions.name, OPTION_NAME),
        ))
        .limit(1)
    : [];

  if (duplicateOption.length > 0) {
    console.log(`Skipped: "${OPTION_NAME}" already present on ${item.name}`);
    await pool.end();
    return;
  }

  const groupId = existingGroup?.id ?? newId("mg");
  const choiceGroup = existingGroups.find((group) => normalized(group.name) === "a scelta");

  await db.transaction(async (tx) => {
    if (!existingGroup) {
      await tx.insert(menuModifierGroups).values({
        id: groupId,
        tenantId: TENANT_ID,
        menuItemId: item.id,
        name: GROUP_NAME,
        required: 0,
        minSelections: 0,
        // > 1 so the POS renders a deselectable checkbox instead of a radio.
        maxSelections: 2,
        multiSelectPriceMode: "max",
        sortOrder: GROUP_SORT_ORDER,
      });
    }

    await tx.insert(menuModifierOptions).values({
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

    // Size first, then the "A scelta" chips: only reorder when the choice group
    // still sits at the same slot as the new size group.
    if (choiceGroup && choiceGroup.sortOrder <= GROUP_SORT_ORDER) {
      await tx
        .update(menuModifierGroups)
        .set({ sortOrder: CHOICE_GROUP_SORT_ORDER })
        .where(and(
          eq(menuModifierGroups.tenantId, TENANT_ID),
          eq(menuModifierGroups.id, choiceGroup.id),
        ));
    }
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
