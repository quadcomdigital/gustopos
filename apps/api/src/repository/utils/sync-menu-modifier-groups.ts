import { and, eq } from "drizzle-orm";
import type { ModifierGroupInput } from "@gustopos/shared";
import type { db as dbClient } from "../../db/client";
import { menuModifierGroups, menuModifierOptions, menuModifierOptionOverrides } from "../../db/schema";

/**
 * Replace a menu item's modifier groups (delete + reinsert) in one transaction.
 *
 * Shared between InventoryRepository (full Magazzino flow) and
 * SimpleCatalogRepository (simple_catalog mode): the persistence of modifier
 * groups is identical, only the module gate in front of it differs.
 */
export async function syncMenuModifierGroups(
  tx: typeof dbClient,
  tenantId: string,
  menuItemId: string,
  groups: ModifierGroupInput[],
): Promise<void> {
  const existingGroups = await tx
    .select({ id: menuModifierGroups.id })
    .from(menuModifierGroups)
    .where(and(eq(menuModifierGroups.tenantId, tenantId), eq(menuModifierGroups.menuItemId, menuItemId)));
  for (const group of existingGroups) {
    const options = await tx
      .select({ id: menuModifierOptions.id })
      .from(menuModifierOptions)
      .where(eq(menuModifierOptions.groupId, group.id));
    for (const opt of options) {
      await tx
        .delete(menuModifierOptionOverrides)
        .where(eq(menuModifierOptionOverrides.optionId, opt.id));
    }
    await tx.delete(menuModifierOptions).where(eq(menuModifierOptions.groupId, group.id));
  }
  await tx
    .delete(menuModifierGroups)
    .where(and(eq(menuModifierGroups.tenantId, tenantId), eq(menuModifierGroups.menuItemId, menuItemId)));

  for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
    const group = groups[groupIdx];
    const groupId = group.id || `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    await tx.insert(menuModifierGroups).values({
      id: groupId,
      tenantId,
      menuItemId,
      name: group.name,
      required: group.required ? 1 : 0,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      multiSelectPriceMode: group.multiSelectPriceMode ?? "max",
      sortOrder: groupIdx,
    });

    for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
      const opt = group.options[optIdx];
      const optId = opt.id || `mo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      await tx.insert(menuModifierOptions).values({
        id: optId,
        tenantId,
        groupId,
        name: opt.name,
        inventoryItemId: opt.inventoryItemId || null,
        referenceId: opt.referenceId ?? null,
        componentType: opt.componentType ?? "ingredient",
        componentId: opt.componentId ?? opt.inventoryItemId ?? null,
        priceDelta: String(opt.priceDelta),
        isDefault: opt.isDefault ? 1 : 0,
        isActive: opt.isActive ? 1 : 0,
        sortOrder: optIdx,
        quantity: String(opt.quantity ?? 1),
        unit: opt.unit ?? "pz",
      });

      for (const override of opt.ingredientOverrides) {
        await tx.insert(menuModifierOptionOverrides).values({
          id: `moo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          tenantId,
          optionId: optId,
          ingredientId: override.ingredientId,
          action: override.action,
        });
      }
    }
  }
}
