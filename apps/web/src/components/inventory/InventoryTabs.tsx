import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  PrepItem,
} from '@gustopos/shared';
import { Package, ChevronUp, ChevronDown, ChefHat, AlertTriangle, BarChart3 } from 'lucide-react';
import LowStockAlert from './LowStockAlert';
import StockLevelChart from './StockLevelChart';
import CategoriesTab from './CategoriesTab';
import IngredientsTab from './IngredientsTab';
import BomTab from './BomTab';
import MenuItemsTab from './MenuItemsTab';
import CategoryPoolEditor from './CategoryPoolEditor';
import FoodCostMatrixTab from './FoodCostMatrixTab';
import PrepView from './PrepView';
import Button from '../../shared/ui/atoms/Button';
import LoadingOrEmpty from '../../shared/ui/molecules/LoadingOrEmpty';
import type { CategoryModifierPool, CategoryModifierPoolCreateRequest, CategoryModifierPoolUpdateRequest } from '@gustopos/shared';

export type InventoryTabKey = 'stock' | 'bom' | 'prep' | 'menu' | 'categories' | 'pools' | 'foodcost';
type _TabKey = InventoryTabKey;

interface InventoryTabsProps {
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  menuItems: MenuItemAdmin[];
  categories: Category[];
  simpleCatalogMode?: boolean;
  loading?: boolean;
  error?: string | null;
  onClearError?: () => void;
  onRetryAll?: () => void;
  onRefreshInventory?: () => Promise<void>;
  onRefreshBom?: () => Promise<void>;
  onRefreshPrepItems?: () => Promise<void>;
  onRefreshCategories?: () => Promise<void>;
  onRefreshMenu?: () => Promise<void>;
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
  onCreateMenuItem?: (payload: MenuItemCreateRequest) => Promise<void>;
  onCreateMenuProduct?: (payload: CanonicalCreateMenuProductRequest) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  onSetMenuItemActive?: (id: string, active: boolean) => Promise<void>;
  onDeleteMenuItem?: (id: string) => Promise<void>;
  onCreateCategoryForMenu?: (name: string, scope: Category['scope']) => Promise<void>;
  categoryModifierPools?: CategoryModifierPool[];
  onRefreshCategoryModifierPools?: () => Promise<void>;
  onCreateCategoryModifierPool?: (payload: CategoryModifierPoolCreateRequest) => Promise<void>;
  onUpdateCategoryModifierPool?: (id: string, payload: CategoryModifierPoolUpdateRequest) => Promise<void>;
  onDeleteCategoryModifierPool?: (id: string) => Promise<void>;
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
  /** Called when user clicks 'Apri in BoM' quick-link — switches to BoM tab */
  onOpenBomTab?: (bomId: string) => void;
}

const TABS: Array<{ key: InventoryTabKey; label: string }> = [
  { key: 'stock', label: 'Ingredienti' },
  { key: 'prep', label: 'Preparazioni' },
  { key: 'bom', label: 'BoM' },
  { key: 'menu', label: 'Menu' },
  { key: 'categories', label: 'Categorie' },
  { key: 'pools', label: 'Mod. Categoria' },
  { key: 'foodcost', label: 'Food Cost' },
];

const SIMPLE_TABS: Array<{ key: InventoryTabKey; label: string }> = [
  { key: 'menu', label: 'Prodotti' },
  { key: 'categories', label: 'Categorie' },
  { key: 'pools', label: 'Mod. Categoria' },
];

export default function InventoryTabs({
  inventory,
  bomItems,
  prepItems,
  menuItems,
  categories,
  simpleCatalogMode = false,
  loading = false,
  error = null,
  onClearError,
  onRetryAll,
  onRefreshInventory,
  onRefreshBom,
  onRefreshPrepItems,
  onRefreshCategories,
  onRefreshMenu,
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
  onCreateMenuItem,
  onCreateMenuProduct,
  onUpdateMenuItem,
  onSetMenuItemActive,
  onDeleteMenuItem,
  onCreateCategoryForMenu,
  categoryModifierPools = [],
  onRefreshCategoryModifierPools,
  onCreateCategoryModifierPool,
  onUpdateCategoryModifierPool,
  onDeleteCategoryModifierPool,
  foodCostMatrix,
  onRefreshFoodCost,
  onUpdateFoodCostCell,
  onImportFoodCost,
  onImportFoodCostXlsx,
  onExportFoodCost,
  onActiveTabChange,
  onOpenBomTab,
}: InventoryTabsProps) {
  const navigate = useNavigate();
  const tabs = simpleCatalogMode ? SIMPLE_TABS : TABS;
  const [activeTab, setActiveTab] = useState<InventoryTabKey>(simpleCatalogMode ? 'menu' : 'stock');
  const [cardsHidden, setCardsHidden] = useState(true);
  // Ingredient → prep quick-link: switch to the Preparazioni tab and open the
  // create modal pre-selected for that ingredient (works on mobile + desktop).
  const [variantIngredientId, setVariantIngredientId] = useState<string | null>(null);

  const handleTabSwitch = (tab: InventoryTabKey) => {
    setActiveTab(tab);
    onActiveTabChange?.(tab);
  };

  const handleCreateVariant = (ingredientId: string) => {
    setVariantIngredientId(ingredientId);
    handleTabSwitch('prep');
  };

  const lowStockCount = simpleCatalogMode ? 0 : inventory.filter((i) => i.quantity <= i.minThreshold && i.isActive && i.isStockTracked).length;

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col tabular-nums">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-2xl font-bold text-primary tracking-tight uppercase">
            {simpleCatalogMode ? 'Catalogo' : 'Magazzino'}
          </h2>
          <p className="text-text-muted text-[10px] sm:text-sm font-medium">
            {simpleCatalogMode ? 'Gestione prodotti vendibili' : 'Gestione scorte e ingredienti'}
          </p>
        </div>
        <button
          onClick={() => setCardsHidden(!cardsHidden)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg border border-border hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          title={cardsHidden ? 'Mostra riepilogo' : 'Nascondi riepilogo'}
          aria-label={cardsHidden ? 'Mostra riepilogo' : 'Nascondi riepilogo'}
          aria-expanded={!cardsHidden}
        >
          {cardsHidden ? <ChevronDown size={18} className="text-secondary" /> : <ChevronUp size={18} className="text-secondary" />}
        </button>
      </div>

      {/* Inline load error banner with retry */}
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-danger">{error}</p>
            <p className="text-[10px] text-text-muted mt-0.5">Si è verificato un errore durante il caricamento dei dati.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onClearError && (
              <Button variant="ghost" size="sm" onClick={onClearError}>Ignora</Button>
            )}
            {onRetryAll && (
              <Button variant="secondary" size="sm" onClick={onRetryAll}>Riprova</Button>
            )}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!cardsHidden && (
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className={`grid gap-3 sm:gap-4 ${simpleCatalogMode ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
          <div className="panel-card">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-info-50 text-accent rounded-lg flex items-center justify-center mb-2 sm:mb-3">
              <Package size={18} />
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">
              {simpleCatalogMode ? 'Prodotti' : 'Articoli'}
            </p>
            <p className="text-lg sm:text-2xl font-bold text-primary">{simpleCatalogMode ? menuItems.length : inventory.length}</p>
          </div>
          {!simpleCatalogMode && (
            <div className="panel-card">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-accent/10 text-accent rounded-lg flex items-center justify-center mb-2 sm:mb-3">
                <Package size={18} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">BoM</p>
              <p className="text-lg sm:text-2xl font-bold text-primary">{bomItems.length}</p>
            </div>
          )}
          {!simpleCatalogMode && (
            <div className="panel-card">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-warning-50 text-warning rounded-lg flex items-center justify-center mb-2 sm:mb-3">
                <ChefHat size={18} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">Preparazioni</p>
              <p className="text-lg sm:text-2xl font-bold text-primary">{prepItems.length}</p>
            </div>
          )}
          <div className="panel-card">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-success-50 text-success rounded-lg flex items-center justify-center mb-2 sm:mb-3">
              <span className="text-success font-bold text-lg">€</span>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-text-muted uppercase tracking-widest">
              {simpleCatalogMode ? 'Attivi' : 'Valore Magazzino'}
            </p>
            <p className="text-lg sm:text-2xl font-bold text-primary">
              {simpleCatalogMode
                ? menuItems.filter((item) => item.isActive).length
                : `€${inventory.reduce((sum, item) => sum + (item.quantity * (item.unitCost ?? 0)), 0).toFixed(2)}`}
            </p>
          </div>
        </div>
        {!simpleCatalogMode && (
          <LowStockAlert
            suggestions={inventory
              .filter((i) => i.quantity <= i.minThreshold && i.isActive && i.isStockTracked)
              .map((i) => ({
                ingredientId: i.id,
                name: i.name,
                sku: i.sku ?? null,
                currentQty: i.quantity,
                minThreshold: i.minThreshold,
                unit: i.unit,
                deficit: i.minThreshold - i.quantity,
                preferredSupplierName: i.supplierName ?? undefined,
                lastUnitCost: i.unitCost ?? undefined,
              }))}
            onOpenPurchasing={() => navigate('../purchasing')}
          />
        )}
      </div>
      )}

      {/* Stock Level Chart */}
      {!simpleCatalogMode && inventory.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <StockLevelChart inventory={inventory} />
        </div>
      )}

      {/* Desktop Tabs */}
      <div className="hidden md:flex items-center gap-1 mb-4 border-b border-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabSwitch(key)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-t ${
              activeTab === key
                ? 'text-primary border-primary'
                : 'text-text-muted border-transparent hover:text-secondary'
            }`}
          >
            {label}
            {key === 'stock' && lowStockCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-danger text-white text-[9px]">{lowStockCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden sticky top-0 z-30 bg-bg pt-1 pb-2 -mx-4 px-4">
        <div className="flex gap-1.5 bg-white rounded-xl border border-border p-1 shadow-sm overflow-x-auto no-scrollbar" style={{ scrollSnapType: 'x mandatory' }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabSwitch(key)}
              className={`py-2.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
                activeTab === key ? 'bg-primary text-white shadow-sm' : 'text-secondary'
              }`}
              style={{ scrollSnapAlign: 'start' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'categories' && (
          <CategoriesTab
            categories={categories}
            simpleCatalogMode={simpleCatalogMode}
            loading={loading}
            onRefresh={onRefreshCategories}
            onCreate={onCreateCategory}
            onUpdate={onUpdateCategory}
            onDelete={onDeleteCategory}
          />
        )}

        {activeTab === 'stock' && !simpleCatalogMode && (
          <IngredientsTab
            inventory={inventory}
            categories={categories}
            loading={loading}
            onRefresh={onRefreshInventory}
            onCreate={onCreateIngredient}
            onUpdate={onUpdateIngredient}
            onDelete={onDeleteIngredient}
            onAdjust={onAdjustIngredient}
            onFetchMovements={onFetchMovements}
            onCreateCategory={onCreateCategory}
            onCreateVariant={handleCreateVariant}
          />
        )}

        {activeTab === 'bom' && !simpleCatalogMode && (
          <BomTab
            bomItems={bomItems}
            prepItems={prepItems}
            inventory={inventory}
            categories={categories}
            loading={loading}
            onRefresh={onRefreshBom}
            onCreate={onCreateBom}
            onUpdate={onUpdateBom}
            onReplaceComponents={onReplaceBomComponents}
            onDelete={onDeleteBom}
            onCreateCategory={onCreateCategory}
          />
        )}

        {activeTab === 'prep' && !simpleCatalogMode && (
          <PrepView
            inventory={inventory}
            bomItems={bomItems}
            prepItems={prepItems}
            loading={loading}
            onRefresh={onRefreshPrepItems}
            initialIngredientId={variantIngredientId}
            onClearInitial={() => setVariantIngredientId(null)}
          />
        )}

        {activeTab === 'menu' && (
          <MenuItemsTab
            menuItems={menuItems}
            inventory={inventory}
            bomItems={bomItems}
            prepItems={prepItems}
            categories={categories}
            categoryModifierPools={categoryModifierPools}
            simpleCatalogMode={simpleCatalogMode}
            loading={loading}
            onRefresh={onRefreshMenu}             onCreate={onCreateMenuItem}
             onCreateMenuProduct={onCreateMenuProduct}
             onUpdate={onUpdateMenuItem}
            onSetMenuItemActive={onSetMenuItemActive}
            onDelete={onDeleteMenuItem}
            onCreateCategory={onCreateCategoryForMenu}
            onOpenBomTab={(bomId) => { handleTabSwitch('bom'); onOpenBomTab?.(bomId); }}
          />
        )}

        {activeTab === 'pools' && (
          <CategoryPoolEditor
            pools={categoryModifierPools}
            menuCategories={categories.filter((c) => c.scope === 'menu' && c.isActive)}
            inventory={inventory}
            prepItems={prepItems}
            bomItems={bomItems}
            onCreatePool={async (payload) => {
              if (onCreateCategoryModifierPool) await onCreateCategoryModifierPool(payload);
              onRefreshCategoryModifierPools?.();
            }}
            onUpdatePool={async (id, payload) => {
              if (onUpdateCategoryModifierPool) await onUpdateCategoryModifierPool(id, payload);
              onRefreshCategoryModifierPools?.();
            }}
            onDeletePool={async (id) => {
              if (onDeleteCategoryModifierPool) await onDeleteCategoryModifierPool(id);
              onRefreshCategoryModifierPools?.();
            }}
          />
        )}

        {activeTab === 'foodcost' && !simpleCatalogMode && (
          foodCostMatrix ? (
            <FoodCostMatrixTab
              matrixData={foodCostMatrix}
              onRefresh={onRefreshFoodCost}
              onUpdateCell={onUpdateFoodCostCell}
              onImport={onImportFoodCost}
              onImportXlsx={onImportFoodCostXlsx}
              onExport={onExportFoodCost}
            />
          ) : (
            <LoadingOrEmpty
              loading
              icon={<BarChart3 size={24} />}
              title="Caricamento matrice food cost..."
              description="Recupero dei costi e dei margini del menu."
            />
          )
        )}
      </div>
    </div>
  );
}
