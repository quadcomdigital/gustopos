import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { menuItems, menuModifierGroups, menuModifierOptions } from "../src/db/schema";

/**
 * One-off: restore the required product-level "Base" modifier group
 * (Bun / Panino / Piadina) on the CLASSICI items that lost it, so the POS
 * product modal behaves exactly like the other burgers/classici/special.
 *
 * Idempotent: items that already have a "Base" group are skipped.
 *
 * Usage:
 *   npx tsx apps/api/scripts/add-base-group.ts
 */
const TENANT_ID = process.env.BASE_GROUP_TENANT_ID ?? "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f";
const TARGET_NAMES = ["Messicano", "Caprese", "Fritturino", "HOT DOG", "Patatino", "Topolino"];

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

async function main() {
  const items = await db
    .select({ id: menuItems.id, name: menuItems.name, categoryId: menuItems.categoryId })
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, TENANT_ID), inArray(menuItems.name, TARGET_NAMES)));

  if (items.length === 0) {
    throw new Error("No target items found for tenant " + TENANT_ID);
  }

  // Template: an existing "Base" group (with its options) from any item.
  const baseGroups = await db
    .select()
    .from(menuModifierGroups)
    .where(and(eq(menuModifierGroups.tenantId, TENANT_ID), eq(menuModifierGroups.name, "Base")))
    .limit(1);
  const templateGroup = baseGroups[0];
  if (!templateGroup) {
    throw new Error('Template group "Base" not found');
  }
  const templateOptions = await db
    .select()
    .from(menuModifierOptions)
    .where(eq(menuModifierOptions.groupId, templateGroup.id))
    .orderBy(menuModifierOptions.sortOrder);
  if (templateOptions.length === 0) {
    throw new Error('Template group "Base" has no options');
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const existing = await db
      .select({ id: menuModifierGroups.id })
      .from(menuModifierGroups)
      .where(and(
        eq(menuModifierGroups.tenantId, TENANT_ID),
        eq(menuModifierGroups.menuItemId, item.id),
        eq(menuModifierGroups.name, "Base"),
      ))
      .limit(1);
    if (existing.length > 0) {
      skipped.push(item.name);
      continue;
    }

    const groupId = newId("mg");
    await db.insert(menuModifierGroups).values({
      id: groupId,
      tenantId: TENANT_ID,
      menuItemId: item.id,
      name: "Base",
      required: templateGroup.required,
      minSelections: templateGroup.minSelections,
      maxSelections: templateGroup.maxSelections,
      multiSelectPriceMode: templateGroup.multiSelectPriceMode,
      sortOrder: templateGroup.sortOrder ?? 0,
    });

    await db.insert(menuModifierOptions).values(
      templateOptions.map((opt) => ({
        id: newId("mo"),
        tenantId: TENANT_ID,
        groupId,
        name: opt.name,
        inventoryItemId: opt.inventoryItemId,
        referenceId: opt.referenceId,
        componentType: opt.componentType,
        componentId: opt.componentId,
        priceDelta: opt.priceDelta,
        isDefault: opt.isDefault,
        isActive: opt.isActive,
        sortOrder: opt.sortOrder ?? 0,
        quantity: opt.quantity,
        unit: opt.unit,
      })),
    );

    created.push(item.name);
  }

  console.log("Base group restored for:", created.length ? created.join(", ") : "(none)");
  console.log("Skipped (already present):", skipped.length ? skipped.join(", ") : "(none)");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
