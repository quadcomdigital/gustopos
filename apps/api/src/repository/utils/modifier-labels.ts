import { and, eq, inArray } from "drizzle-orm";
import type { db as dbClient } from "../../db/client";
import {
  menuModifierOptions,
  categoryModifierPoolOptions,
  inventory,
  prepItems,
  bomItems,
} from "../../db/schema";

// ─── Selected modifier labels ───────────────────────────────────────────────
// Shared by the cashier documents (scontrino chiusura conto + preconto) to
// print the selected modifier names ("aggiunte") under each order line.
//
// Resolution mirrors the production ticket (createPrintJobsForOrder):
// product-level options (`menu_item_modifier_options`) win, then category pool
// options (`category_modifier_pool_options`) with a fallback to the referenced
// inventory/prep/BoM name — never an opaque `mo_…` / `cmpo_…` id when a name
// exists. Ingredient overrides (`+ Mozzarella` / `- Rucola`) are intentionally
// NOT handled here: they must not appear on the cashier receipt.

export async function resolveModifierNameById(
  client: typeof dbClient,
  tenantId: string,
  optionIds: ReadonlyArray<string>,
): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  const ids = [...new Set(optionIds)];
  if (ids.length === 0) {
    return nameById;
  }

  const optionRows = await client
    .select({ id: menuModifierOptions.id, name: menuModifierOptions.name })
    .from(menuModifierOptions)
    .where(and(eq(menuModifierOptions.tenantId, tenantId), inArray(menuModifierOptions.id, ids)));
  for (const row of optionRows) {
    nameById.set(row.id, row.name);
  }

  const poolOptionRows = await client
    .select({
      id: categoryModifierPoolOptions.id,
      name: categoryModifierPoolOptions.name,
      inventoryItemId: categoryModifierPoolOptions.inventoryItemId,
      componentId: categoryModifierPoolOptions.componentId,
    })
    .from(categoryModifierPoolOptions)
    .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), inArray(categoryModifierPoolOptions.id, ids)));

  if (poolOptionRows.length > 0) {
    const poolInventoryIds = [...new Set(poolOptionRows.map((row) => row.inventoryItemId).filter((value): value is string => Boolean(value)))];
    const poolComponentIds = [...new Set(poolOptionRows.map((row) => row.componentId).filter((value): value is string => Boolean(value)))];

    const inventoryNameById = new Map<string, string>();
    if (poolInventoryIds.length > 0) {
      const rows = await client
        .select({ id: inventory.id, name: inventory.name })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, poolInventoryIds)));
      for (const row of rows) inventoryNameById.set(row.id, row.name);
    }

    const componentNameById = new Map<string, string>();
    if (poolComponentIds.length > 0) {
      const [prepRows, bomRows] = await Promise.all([
        client
          .select({ id: prepItems.id, name: prepItems.name })
          .from(prepItems)
          .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, poolComponentIds))),
        client
          .select({ id: bomItems.id, name: bomItems.name })
          .from(bomItems)
          .where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, poolComponentIds))),
      ]);
      for (const row of prepRows) componentNameById.set(row.id, row.name);
      for (const row of bomRows) componentNameById.set(row.id, row.name);
    }

    for (const row of poolOptionRows) {
      if (nameById.has(row.id)) continue;
      const resolvedName = row.name
        || (row.inventoryItemId ? inventoryNameById.get(row.inventoryItemId) : undefined)
        || (row.componentId ? componentNameById.get(row.componentId) : undefined)
        || row.componentId
        || row.id;
      nameById.set(row.id, resolvedName);
    }
  }

  return nameById;
}

/**
 * Maps a stored `selected_modifiers` list to printable option names, keeping
 * the original selection order. The raw id is only a last-resort fallback when
 * no name can be resolved.
 */
export function formatSelectedModifiers(
  selectedModifiers: ReadonlyArray<{ optionId: string }>,
  nameById: ReadonlyMap<string, string>,
): string[] {
  return selectedModifiers
    .map((entry) => nameById.get(entry.optionId) ?? entry.optionId)
    .filter((label) => label.length > 0);
}
