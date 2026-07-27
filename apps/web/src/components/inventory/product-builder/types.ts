import type { Ingredient, BomItem, PrepItem, MenuItemAdmin, Category, MenuItemCreateRequest, MenuItemUpdateRequest, MenuItemReplaceRecipeRequest, CategoryModifierPool } from '@gustopos/shared';

export type ProductType = 'simple' | 'variable' | 'food';

export interface ProductBuilderBaseProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  categoryModifierPools?: CategoryModifierPool[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
}

export interface SimpleProductModalProps extends ProductBuilderBaseProps {
  onCreate: (payload: MenuItemCreateRequest) => Promise<void>;
  onUpdate?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  editItem?: MenuItemAdmin | null;
}

export interface VariableProductModalProps extends ProductBuilderBaseProps {
  onCreateMenuItem: (payload: MenuItemCreateRequest) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  editItem?: MenuItemAdmin | null;
}

export interface FoodProductModalProps extends ProductBuilderBaseProps {
  onCreateMenuItem: (payload: MenuItemCreateRequest) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  onReplaceRecipe?: (id: string, payload: MenuItemReplaceRecipeRequest) => Promise<void>;
  onCreateIngredient?: (payload: any) => Promise<Ingredient>;
  onCreatePrepItem?: (payload: any) => Promise<PrepItem>;
  editItem?: MenuItemAdmin | null;
}

export interface Variant {
  id: string;
  name: string;
  price: string;
  ingredientId: string;
  quantity: string;
  unit: string;
}

export interface PrepVariant {
  id: string;
  name: string;
  quantityPerUnit: string;
  unit: string;
}
