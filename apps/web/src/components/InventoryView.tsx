import type {
  Ingredient,
  BomItem,
  MenuItemAdmin,
  Category,
  BomCreateRequest,
  BomUpsertComponentsRequest,
  BomUpdateRequest,
  IngredientCreateRequest,
  IngredientUpdateRequest,
  CategoryCreateRequest,
  CategoryUpdateRequest,
  MenuItemCreateRequest,
  CanonicalCreateMenuProductRequest,
  MenuItemUpdateRequest,
  CategoryModifierPool,
  CategoryModifierPoolCreateRequest,
  CategoryModifierPoolUpdateRequest,
  PrepItem,
} from '@gustopos/shared';
import InventoryTabs, { type InventoryTabKey } from './inventory/InventoryTabs';

interface InventoryViewProps {
  inventory: Ingredient[];
  bomItems?: BomItem[];
  prepItems?: PrepItem[];
  menuItems?: MenuItemAdmin[];
  categories?: Category[];
  loading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  onRetryAll?: () => void;
  categoryModifierPools?: CategoryModifierPool[];
  onRefreshInventory?: () => Promise<void>;
  onRefreshBom?: () => Promise<void>;
  onRefreshPrepItems?: () => Promise<void>;
  onRefreshCategories?: () => Promise<void>;
  onCreateCategory?: (payload: CategoryCreateRequest) => Promise<void>;
  onUpdateCategory?: (id: string, payload: CategoryUpdateRequest) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onCreateBom?: (payload: BomCreateRequest) => Promise<void>;
  onUpdateBom?: (id: string, payload: BomUpdateRequest) => Promise<void>;
  onReplaceBomComponents?: (id: string, payload: BomUpsertComponentsRequest) => Promise<void>;
  onDeleteBom?: (id: string) => Promise<void>;
  onCreateIngredient?: (payload: IngredientCreateRequest) => Promise<void>;
  onUpdateIngredient?: (id: string, payload: IngredientUpdateRequest) => Promise<void>;
  onDeleteIngredient?: (id: string) => Promise<void>;
  onAdjustIngredient?: (id: string, payload: { quantity: number; notes?: string }) => Promise<void>;
  onFetchMovements?: (ingredientId: string) => Promise<{ movements: any[] }>;
  onRefreshMenu?: () => Promise<void>;
  onCreateMenuItem?: (payload: MenuItemCreateRequest) => Promise<void>;
  onCreateMenuProduct?: (payload: CanonicalCreateMenuProductRequest) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  onSetMenuItemActive?: (id: string, active: boolean) => Promise<void>;
  onDeleteMenuItem?: (id: string) => Promise<void>;
  onRefreshCategoryModifierPools?: () => Promise<void>;
  onCreateCategoryModifierPool?: (payload: CategoryModifierPoolCreateRequest) => Promise<void>;
  onUpdateCategoryModifierPool?: (id: string, payload: CategoryModifierPoolUpdateRequest) => Promise<void>;
  onDeleteCategoryModifierPool?: (id: string) => Promise<void>;
  simpleCatalogMode?: boolean;
  foodCostMatrix?: {
    rows: Array<{
      menuItemId: string;
      menuItemName: string;
      category: string;
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unit: string;
      ingredientCost: number;
      totalCost: number;
      menuItemPrice: number;
      margin: number;
      marginPercent: number;
      recommendedPrice: number;
      status: 'ok' | 'needs_change';
    }>;
    summary: Array<{
      menuItemId: string;
      menuItemName: string;
      category: string;
      totalCost: number;
      currentPrice: number;
      recommendedPrice: number;
      margin: number;
      marginPercent: number;
      status: 'ok' | 'needs_change';
      ingredientCount: number;
    }>;
  };
  onRefreshFoodCost?: () => Promise<void>;
  onUpdateFoodCostCell?: (menuItemId: string, ingredientId: string, quantity: number, unit: string) => Promise<void>;
  onImportFoodCost?: (
    ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>,
    recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
  ) => Promise<{ costsUpdated: number; recipesImported: number; recipesSkipped: number; errors: string[] }>;
  onImportFoodCostXlsx?: (xlsxBase64: string) => Promise<{
    costsUpdated: number;
    costsSkipped: number;
    recipesImported: number;
    recipesSkipped: number;
    costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
    recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
    errors: string[];
  }>;
  onExportFoodCost?: () => Promise<void>;
  onActiveTabChange?: (tab: InventoryTabKey) => void;
}

/**
 * InventoryView — thin wrapper that delegates to InventoryTabs.
 *
 * Preserves the original props interface so existing callers
 * (InventoryRoute, SimpleCatalogRoute) work without changes.
 *
 * The inventory panel has been decomposed into:
 *   - InventoryTabs.tsx        — tab container + summary cards + navigation
 *   - CategoriesTab.tsx        — category CRUD
 *   - IngredientsTab.tsx       — ingredient CRUD + stock management + movements
 *   - BomTab.tsx               — BoM CRUD + recipe builder
 *   - MenuItemsTab.tsx         — menu item CRUD + tabbed editor (metadata/recipe/modifiers/preview)
 *   - InlineCategoryPicker.tsx — category combobox with create modal
 *   - RecipeBuilder.tsx        — reusable recipe component builder
 *   - ModifierEditor.tsx       — list-based modifier editor
 *   - StockMovementsDrawer.tsx — stock movement history drawer
 *   - CustomerPreview.tsx      — POS customer preview
 */
export default function InventoryView({
  inventory,
  bomItems = [],
  prepItems = [],
  menuItems = [],
  categories = [],
  loading = false,
  error = null,
  onClearError,
  onRetryAll,
  categoryModifierPools = [],
  onRefreshInventory,
  onRefreshBom,
  onRefreshPrepItems,
  onRefreshCategories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onCreateBom,
  onUpdateBom,
  onReplaceBomComponents,
  onDeleteBom,
  onCreateIngredient,
  onUpdateIngredient,
  onDeleteIngredient,
  onAdjustIngredient,
  onFetchMovements,
  onRefreshMenu,
  onCreateMenuItem,
  onCreateMenuProduct,
  onUpdateMenuItem,
  onSetMenuItemActive,
  onDeleteMenuItem,
  onRefreshCategoryModifierPools,
  onCreateCategoryModifierPool,
  onUpdateCategoryModifierPool,
  onDeleteCategoryModifierPool,
  simpleCatalogMode = false,
  foodCostMatrix,
  onRefreshFoodCost,
  onUpdateFoodCostCell,
  onImportFoodCost,
  onImportFoodCostXlsx,
  onExportFoodCost,
  onActiveTabChange,
}: InventoryViewProps) {
  return (
    <InventoryTabs
      inventory={inventory}
      bomItems={bomItems}
      prepItems={prepItems}
      menuItems={menuItems}
      categories={categories}
      loading={loading}
      error={error}
      onClearError={onClearError}
      onRetryAll={onRetryAll}
      categoryModifierPools={categoryModifierPools}
      simpleCatalogMode={simpleCatalogMode}
      foodCostMatrix={foodCostMatrix}
      onRefreshFoodCost={onRefreshFoodCost}
      onUpdateFoodCostCell={onUpdateFoodCostCell}
      onImportFoodCost={onImportFoodCost}
      onImportFoodCostXlsx={onImportFoodCostXlsx}
      onExportFoodCost={onExportFoodCost}
      onActiveTabChange={onActiveTabChange}
      onRefreshInventory={onRefreshInventory}
      onRefreshBom={onRefreshBom}
      onRefreshPrepItems={onRefreshPrepItems}
      onRefreshCategories={onRefreshCategories}
      onRefreshMenu={onRefreshMenu}
      onCreateCategory={onCreateCategory}
      onUpdateCategory={onUpdateCategory}
      onDeleteCategory={onDeleteCategory}
      onCreateBom={onCreateBom}
      onUpdateBom={onUpdateBom}
      onReplaceBomComponents={onReplaceBomComponents}
      onDeleteBom={onDeleteBom}
      onCreateIngredient={onCreateIngredient}
      onUpdateIngredient={onUpdateIngredient}
      onDeleteIngredient={onDeleteIngredient}
      onAdjustIngredient={onAdjustIngredient}
      onFetchMovements={onFetchMovements}       onCreateMenuItem={onCreateMenuItem}
       onCreateMenuProduct={onCreateMenuProduct}
       onUpdateMenuItem={onUpdateMenuItem}
      onSetMenuItemActive={onSetMenuItemActive}
      onDeleteMenuItem={onDeleteMenuItem}
      onRefreshCategoryModifierPools={onRefreshCategoryModifierPools}
      onCreateCategoryModifierPool={onCreateCategoryModifierPool}
      onUpdateCategoryModifierPool={onUpdateCategoryModifierPool}
      onDeleteCategoryModifierPool={onDeleteCategoryModifierPool}
      onCreateCategoryForMenu={async (name, scope = 'menu') => {
        if (onCreateCategory) {
          await onCreateCategory({ name, scope, printAreas: ['kitchen'] });
        }
      }}
    />
  );
}
