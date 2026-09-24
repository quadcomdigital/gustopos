import type { AppData } from '@gustopos/shared';

type ComponentNameSource = Pick<AppData, 'inventory' | 'bomItems' | 'menu'>;
type ModifierNameSource = Pick<AppData, 'menu' | 'categoryModifierPools'>;

/**
 * id → human name for every catalog component that can appear on an order
 * override (ingredient / prep / BoM). Menu recipes already carry the
 * server-resolved `componentName`, so we don't need the prep list loaded
 * (which is empty for `simple_catalog` tenants).
 */
export function buildComponentNameById(source: ComponentNameSource): Map<string, string> {
  const map = new Map<string, string>();
  for (const ingredient of source.inventory ?? []) {
    map.set(ingredient.id, ingredient.name);
  }
  for (const bom of source.bomItems ?? []) {
    map.set(bom.id, bom.name);
  }
  for (const menu of source.menu ?? []) {
    for (const component of menu.recipe ?? []) {
      if (component.componentName && !map.has(component.componentId)) {
        map.set(component.componentId, component.componentName);
      }
    }
  }
  return map;
}

/**
 * option id → human name for BOTH menu-scoped modifier options and category
 * modifier pool options. Previously each screen only read one of the two, so
 * pool options leaked `cmpo_…` ids (or disappeared entirely).
 */
export function buildModifierOptionNameById(
  source: ModifierNameSource,
  componentNameById?: ReadonlyMap<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  const resolve = (option: { name?: string; inventoryItemId?: string; componentId?: string }): string => {
    const explicit = option.name?.trim();
    if (explicit) return explicit;
    const target = option.inventoryItemId ?? option.componentId;
    if (target) {
      return componentNameById?.get(target) ?? target;
    }
    return '';
  };

  for (const menu of source.menu ?? []) {
    for (const group of menu.modifierGroups ?? []) {
      for (const option of group.options ?? []) {
        map.set(option.id, resolve(option));
      }
    }
  }
  for (const pool of source.categoryModifierPools ?? []) {
    for (const option of pool.options ?? []) {
      if (!map.has(option.id)) {
        map.set(option.id, resolve(option));
      }
    }
  }
  return map;
}

/**
 * Resolve an order override / modifier option reference to a printable name,
 * never an opaque id when a name is known.
 */
export function resolveCatalogName(id: string, componentNameById: ReadonlyMap<string, string>): string {
  return componentNameById.get(id) ?? id;
}
