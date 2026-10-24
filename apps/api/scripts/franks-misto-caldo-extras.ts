import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { menuItems, menuModifierGroups, menuModifierOptions } from "../src/db/schema";

/**
 * One-off: MISTO CALDO (€4.00) gets two paid extras — Wurstel and Anelli di
 * cipolla at +€0.50 each — instead of leaving them as free-text notes on the
 * kitchen ticket ("più wurstel", "più anelli").
 *
 * Shape:
 *   - optional group "Aggiunte", never mandatory: unticked = today's €4.00 mix;
 *   - `maxSelections = 2` and `multiSelectPriceMode = "sum"` so both extras can
 *     be picked and each one adds its own €0.50 (4.00 → 4.50 → 5.00);
 *   - real ingredients (inventoryItemId + componentId set) so the options stay
 *     recognisable in Magazzino; franks runs `simple_catalog`, so this does not
 *     move stock;
 *   - `referenceId` stays null: the RIEPILOGO container tally must keep
 *     resolving from product/category.
 *
 * What prints once ticked:
 *   - kitchen comanda: `  Wurstel` / `  Anelli di cipolla` under the item name;
 *   - cashier receipt: `  Wurstel +EUR 0.50` / `  Anelli di cipolla +EUR 0.50`;
 *   - POS / public menu: chips `Wurstel +€0,50` and `Anelli di cipolla +€0,50`.
 *
 * Idempotent: already-applied options are skipped.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx apps/api/scripts/franks-misto-caldo-extras.ts
 */
const TENANT_ID = process.env.FRANKS_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const ITEM_NAME = "MISTO CALDO";
const GROUP_NAME = "Aggiunte";
const PRICE_DELTA = "0.50";
const GROUP_SORT_ORDER = 0;

const EXTRAS = [
  { name: "Wurstel", ingredientId: "i_msen4iwr", sortOrder: 0 },
  { name: "Anelli di cipolla", ingredientId: "i_mseqo3au", sortOrder: 1 },
] as const;

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
    .select({ id: menuModifierGroups.id, name: menuModifierGroups.name })
    .from(menuModifierGroups)
    .where(and(
      eq(menuModifierGroups.tenantId, TENANT_ID),
      eq(menuModifierGroups.menuItemId, item.id),
    ));

  const existingGroup = existingGroups.find((group) => normalized(group.name) === normalized(GROUP_NAME));

  const existingOptions = existingGroup
    ? await db
        .select({ id: menuModifierOptions.id, name: menuModifierOptions.name })
        .from(menuModifierOptions)
        .where(and(
          eq(menuModifierOptions.tenantId, TENANT_ID),
          eq(menuModifierOptions.groupId, existingGroup.id),
        ))
    : [];

  const existingNames = new Set(existingOptions.map((option) => normalized(option.name)));
  const missing = EXTRAS.filter((extra) => !existingNames.has(normalized(extra.name)));

  if (missing.length === 0) {
    console.log(`Skipped: all extras already present on ${item.name}`);
    await pool.end();
    return;
  }

  const groupId = existingGroup?.id ?? newId("mg");

  await db.transaction(async (tx) => {
    if (!existingGroup) {
      await tx.insert(menuModifierGroups).values({
        id: groupId,
        tenantId: TENANT_ID,
        menuItemId: item.id,
        name: GROUP_NAME,
        required: 0,
        minSelections: 0,
        // Both extras can be selected together: "sum" charges each €0.50.
        maxSelections: EXTRAS.length,
        multiSelectPriceMode: "sum",
        sortOrder: GROUP_SORT_ORDER,
      });
    }

    for (const extra of missing) {
      await tx.insert(menuModifierOptions).values({
        id: newId("mo"),
        tenantId: TENANT_ID,
        groupId,
        name: extra.name,
        inventoryItemId: extra.ingredientId,
        referenceId: null,
        componentType: "ingredient",
        componentId: extra.ingredientId,
        priceDelta: PRICE_DELTA,
        isDefault: 0,
        isActive: 1,
        sortOrder: extra.sortOrder,
        quantity: "1",
        unit: "pz",
      });
    }
  });

  console.log(
    `Added ${missing.map((extra) => `"${extra.name}" (+€${PRICE_DELTA})`).join(", ")} ` +
    `to ${item.name} (${item.id}) under "${GROUP_NAME}"; base price €${Number(item.price).toFixed(2)}`,
  );
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
