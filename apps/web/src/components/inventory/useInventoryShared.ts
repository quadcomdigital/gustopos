import { useMemo } from 'react';
import type {
  Ingredient,
  BomItem,
  MenuItemAdmin,
  Category,
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
  onCreateBom?: (payload: { name: string; unit: string; yieldQuantity: number; categoryId?: string; isPreBatched: number; components: Array<{ componentType: 'ingredient' | 'bom'; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
  onUpdateBom?: (id: string, payload: { name?: string; unit?: string; yieldQuantity?: number; categoryId?: string; isActive?: boolean }) => Promise<void>;
  onReplaceBomComponents?: (id: string, payload: { components: Array<{ componentType: 'ingredient' | 'bom'; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
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
    recipe: Array<{ componentType: 'ingredient' | 'bom'; componentId: string; quantity: number; unit: string }>;
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
    recipe: Array<{ componentType: 'ingredient' | 'bom'; componentId: string; quantity: number; unit: string }>;
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

/** Build a map of component key → display name for ingredients + BoM */
export function useComponentNameMap(inventory: Ingredient[], bomItems: BomItem[]) {
  return useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const ing of inventory) entries.push([`ingredient:${ing.id}`, ing.name]);
    for (const bom of bomItems) entries.push([`bom:${bom.id}`, bom.name]);
    return new Map(entries);
  }, [inventory, bomItems]);
}

/** Build recipe candidates for select dropdowns */
export function useRecipeCandidates(
  type: 'ingredient' | 'bom',
  inventory: Ingredient[],
  bomItems: BomItem[],
  excludeBomId?: string,
) {
  return useMemo(() => {
    if (type === 'ingredient') {
      return inventory.map((item) => ({ id: item.id, label: `${item.name} (${item.id})`, unit: item.unit }));
    }
    return bomItems
      .filter((item) => item.id !== excludeBomId)
      .map((item) => ({ id: item.id, label: `${item.name} (${item.id})`, unit: item.unit }));
  }, [type, inventory, bomItems, excludeBomId]);
}

export const componentTypeLabel = (componentType: 'ingredient' | 'bom' | undefined) =>
  componentType === 'ingredient' ? 'Ingrediente' : 'BoM';
