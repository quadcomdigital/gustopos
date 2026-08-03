import { useMemo } from 'react';
import type {
  Ingredient,
  BomItem,
  MenuItemAdmin,
  Category,
  PrepItem,
} from '@gustopos/shared';

export const COMMON_UNITS = ['kg', 'g', 'lt', 'ml', 'pz', 'unit'] as const;

export interface InventoryTabProps {
  inventory: Ingredient[];
  bomItems: BomItem[];
  menuItems: MenuItemAdmin[];
  categories: Category[];
  onRefreshInventory?: () => Promise<void>;
  onRefreshBom?: () => Promise<void>;
  onRefreshCategories?: () => Promise<void>;
  onRefreshMenu?: () => Promise<void>;
  onCreateCategory?: (payload: { name: string; scope: Category['scope']; printAreas: Array<'kitchen' | 'bar' | 'cashier'> }) => Promise<void>;
  onUpdateCategory?: (id: string, payload: { name?: string; isActive?: boolean; printAreas?: Array<'kitchen' | 'bar' | 'cashier'> }) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onCreateBom?: (payload: { name: string; unit: string; yieldQuantity: number; categoryId?: string; components: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
  onUpdateBom?: (id: string, payload: { name?: string; unit?: string; yieldQuantity?: number; categoryId?: string; isActive?: boolean }) => Promise<void>;
  onReplaceBomComponents?: (id: string, payload: { components: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
  onDeleteBom?: (id: string) => Promise<void>;
  onCreateIngredient?: (payload: { name: string; quantity: number; unit: string; minThreshold: number; categoryId?: string }) => Promise<void>;
  onUpdateIngredient?: (id: string, payload: { name?: string; quantity?: number; unit?: string; minThreshold?: number; categoryId?: string }) => Promise<void>;
  onDeleteIngredient?: (id: string) => Promise<void>;
  onCreateMenuItem?: (payload: {
    name: string;
    price: number;
    category: string;
    categoryId?: string;
    printAreas?: Array<'kitchen' | 'bar' | 'cashier'>;
    recipe: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }>;
    modifierGroups?: Array<{
      id: string;
      name: string;
      required: boolean;
      minSelections: number;
      maxSelections: number;
      options: Array<{ id: string; name: string; priceDelta: number; isDefault: boolean; isActive: boolean }>;
    }>;
  }) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: {
    name?: string;
    price?: number;
    category?: string;
    categoryId?: string;
    printAreas?: Array<'kitchen' | 'bar' | 'cashier'>;
    modifierGroups?: Array<{
      id: string;
      name: string;
      required: boolean;
      minSelections: number;
      maxSelections: number;
      options: Array<{ id: string; name: string; priceDelta: number; isDefault: boolean; isActive: boolean }>;
    }>;
  }) => Promise<void>;
  onReplaceMenuRecipe?: (id: string, payload: {
    recipe: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }>;
  }) => Promise<void>;
  onSetMenuItemActive?: (id: string, active: boolean) => Promise<void>;
  onDeleteMenuItem?: (id: string) => Promise<void>;
  simpleCatalogMode?: boolean;
}

/** Filter categories by scope */
export function useScopedCategories(categories: Category[], scope: Category['scope']) {
  return useMemo(
    () => categories.filter((c) => c.scope === scope && c.isActive),
    [categories, scope],
  );
}

export const componentTypeLabel = (componentType: 'ingredient' | 'bom' | 'prep' | undefined) =>
  componentType === 'ingredient' ? 'Ingrediente' : componentType === 'prep' ? 'Preparato' : 'BoM';

export function explodeBomCost(
  components: Array<{ componentType: string; componentId: string; quantity: number }>,
  inventory: Ingredient[],
  bomItems: BomItem[],
  prepItems: PrepItem[],
  visitedBomIds?: Set<string>,
): number {
  const visited = visitedBomIds ?? new Set<string>();
  let total = 0;
  for (const comp of components) {
    if (comp.componentType === 'ingredient') {
      const ing = inventory.find((i) => i.id === comp.componentId);
      if (ing?.unitCost) total += comp.quantity * ing.unitCost;
    } else if (comp.componentType === 'prep') {
      const prep = prepItems.find((p) => p.id === comp.componentId);
      if (prep && prep.sourceType === 'ingredient') {
        const ing = inventory.find((i) => i.id === prep.sourceId);
        if (ing?.unitCost) {
          const perUnit = prep.outputQuantity > 0 ? prep.inputQuantity / prep.outputQuantity : 0;
          total += comp.quantity * perUnit * ing.unitCost;
        }
      }
    } else if (comp.componentType === 'bom') {
      if (visited.has(comp.componentId)) continue;
      visited.add(comp.componentId);
      const subBom = bomItems.find((b) => b.id === comp.componentId);
      if (subBom) {
        const subCost = explodeBomCost(subBom.components, inventory, bomItems, prepItems, visited);
        if (subBom.yieldQuantity > 0) {
          total += comp.quantity * (subCost / subBom.yieldQuantity);
        }
      }
    }
  }
  return total;
}
