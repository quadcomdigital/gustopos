import type { PublicMenuResponse } from '@gustopos/shared';

/**
 * What a public dish lets the guest change, derived purely from the menu
 * payload: the tenant-authored modifier options (paid additions: "AGGIUNTA",
 * "MAXI"…) plus the dish's own recipe, which is what the guest is shown and can
 * therefore ask to leave out ("senza cipolla").
 */

type PublicMenuItem = PublicMenuResponse['items'][number];
type CategoryPools = PublicMenuResponse['categoryModifierPools'];

/** One recipe component the guest may ask to leave out. */
export type RemovableComponent = { id: string; name: string };

/**
 * Recipe components a guest can remove. Both ingredients and preps are
 * removable — the server applies the override to the recipe component id and
 * the kitchen ticket prints "senza …". Components without a resolved name are
 * skipped: showing "senza <uuid>" would be worse than not offering the choice.
 */
export function removableComponents(item: PublicMenuItem): RemovableComponent[] {
  const seen = new Set<string>();
  const components: RemovableComponent[] = [];
  for (const component of item.recipe ?? []) {
    const name = component.componentName?.trim();
    if (!name || seen.has(component.componentId)) continue;
    seen.add(component.componentId);
    components.push({ id: component.componentId, name });
  }
  return components;
}

/** Category pools that actually apply to this item and have a live option. */
export function poolsForItem(
  item: PublicMenuItem,
  pools: CategoryPools,
): CategoryPools {
  if (!item.categoryId) return [];
  return pools.filter((pool) => {
    const categoryIds = pool.categoryIds.length > 0 ? pool.categoryIds : pool.categoryId ? [pool.categoryId] : [];
    if (!categoryIds.includes(item.categoryId!)) return false;
    return pool.options.some((option) => option.isActive !== false);
  });
}

/** True when opening the customization sheet for this item has something to show. */
export function itemIsCustomizable(item: PublicMenuItem, pools: CategoryPools): boolean {
  const ownGroups = (item.modifierGroups ?? []).some((group) =>
    (group.options ?? []).some((option) => option.isActive),
  );
  return ownGroups || poolsForItem(item, pools).length > 0 || removableComponents(item).length > 0;
}

/** "senza cipolla, senza pomodoro": the one-line summary used in the cart. */
export function removedLabel(
  overrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>,
  ingredientNameById: Map<string, string>,
): string {
  const removed = overrides.filter((override) => override.action === 'remove');
  if (removed.length === 0) return '';
  return removed
    .map((override) => `senza ${ingredientNameById.get(override.ingredientId) ?? override.ingredientId}`)
    .join(', ');
}
