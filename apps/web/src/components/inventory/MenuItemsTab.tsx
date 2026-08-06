import type {
  Ingredient, BomItem, PrepItem, MenuItemAdmin, Category,
  MenuItemCreateRequest, CanonicalCreateMenuProductRequest, MenuItemUpdateRequest, PrepItemCreateRequest, CanonicalUnit,
  MenuItemModifier, PrintArea, ModifierGroup, CategoryModifierPool,
  IngredientCreateRequest, UnitConversion,
} from '@gustopos/shared';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { RotateCcw, Plus, UtensilsCrossed } from 'lucide-react';
import Button from '../../shared/ui/atoms/Button';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import Modal from '../../shared/ui/molecules/Modal';
import TabTemplate from '../../shared/ui/molecules/TabTemplate';
import { useScopedCategories, componentTypeLabel } from './useInventoryShared';
import InlineCategoryPicker from './InlineCategoryPicker';
import RecipeBuilder from './RecipeBuilder';
import ModifierEditor from './ModifierEditor';
import ModifierGroupsEditor from './ModifierGroupsEditor';
import CustomerPreview from './CustomerPreview';
import { useDebounce } from '../../hooks/useDebounce';
import FormField from '../../shared/ui/molecules/FormField';
import { required, minLength, positiveNumber, getErrorClass, type ValidationErrors } from '../../shared/ui/hooks/useFieldValidation';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import MenuCards from './MenuCards';
import LoadingOrEmpty from '../../shared/ui/molecules/LoadingOrEmpty';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import { createIngredient, createPrepItem } from '../../shared/api/client';
import { useAppStore } from '../../store/app-store';
import {
  NewProductSelectionModal,
  SimpleProductModal,
  VariableProductModal,
  FoodProductModal,
} from './product-builder';

const PRINT_AREA_LABELS: Record<string, string> = {
  kitchen: 'Cucina',
  bar: 'Bar',
  cashier: 'Cassa',
};

type EditTab = 'metadata' | 'recipe' | 'modifiers' | 'preview';

interface MenuItemsTabProps {
  menuItems: MenuItemAdmin[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems?: PrepItem[];
  categories: Category[];
  categoryModifierPools?: CategoryModifierPool[];
  simpleCatalogMode?: boolean;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onCreate?: (payload: MenuItemCreateRequest) => Promise<void>;
  onCreateMenuProduct?: (payload: CanonicalCreateMenuProductRequest) => Promise<void>;
  onUpdate?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  onSetMenuItemActive?: (id: string, active: boolean) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreateIngredient?: (payload: IngredientCreateRequest) => Promise<Ingredient>;
  onCreatePrepItem?: (payload: PrepItemCreateRequest) => Promise<PrepItem>;
  /** Called when user clicks 'Apri in BoM' — closes FoodProductModal and switches to BoM tab */
  onOpenBomTab?: (bomId: string) => void;
}

export default function MenuItemsTab({
  menuItems,
  inventory,
  bomItems,
  prepItems = [],
  categories,
  categoryModifierPools = [],
  simpleCatalogMode = false,
  loading = false,
  onRefresh,
  onCreate,
  onCreateMenuProduct,
  onUpdate,
  onSetMenuItemActive,
  onDelete,
  onCreateCategory,
  onCreateIngredient,
  onCreatePrepItem,
  onOpenBomTab,
}: MenuItemsTabProps) {
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [editTab, setEditTab] = useState<EditTab>('metadata');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);

  const menuCategories = useScopedCategories(categories, 'menu');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const { confirm, requestConfirm, handleConfirm, handleCancel } = useConfirm();

  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      const catId = item.categoryId ?? '__none__';
      counts.set(catId, (counts.get(catId) ?? 0) + 1);
    }
    return [
      { value: '', label: 'Tutte', badge: menuItems.length },
      ...menuCategories.map((c) => ({ value: c.id, label: c.name, badge: counts.get(c.id) ?? 0 })),
    ];
  }, [menuItems, menuCategories]);

  const filteredMenuItems = useMemo(() => {
    let result = filterCategoryId ? menuItems.filter((m) => m.categoryId === filterCategoryId) : menuItems;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));
    }
    return result;
  }, [menuItems, filterCategoryId, debouncedSearch]);

  const selectedMenu = useMemo(
    () => menuItems.find((item) => item.id === selectedMenuId) ?? null,
    [menuItems, selectedMenuId],
  );

  const _menuRecipeCandidates = useMemo(
    () => inventory.map((item) => ({ id: item.id, label: item.name, unit: item.unit, stockLevel: item.quantity, unitCost: item.unitCost })),
    [inventory],
  );

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editPrice, setEditPrice] = useState('0');
  const [editPrintAreas, setEditPrintAreas] = useState<PrintArea[]>(['kitchen']);
  const [editModifiers, setEditModifiers] = useState<MenuItemModifier[]>([]);
  const [editModifierGroups, setEditModifierGroups] = useState<ModifierGroup[]>([]);
  const [editRecipe, setEditRecipe] = useState<MenuItemCreateRequest['recipe']>([]);

  // New product form state (kept for compatibility, but managed by new modals)
  const [_newName] = useState('');
  const [_newCategory] = useState('');
  const [_newCategoryId] = useState('');
  const [_newPrice] = useState('');
  const [_newPrintAreas] = useState<PrintArea[]>(['kitchen']);
  const [_newModifiers] = useState<MenuItemModifier[]>([]);
  const [_newModifierGroups] = useState<ModifierGroup[]>([]);
  const [_newRecipe] = useState<MenuItemCreateRequest['recipe']>([]);
  const [_newSaving] = useState(false);
  const [_newError] = useState('');
  const [_createErrors] = useState<ValidationErrors>({});
  const [_showCreateModal] = useState(false);

  // New product builder state
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showSimpleModal, setShowSimpleModal] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [editBuilderItem, setEditBuilderItem] = useState<MenuItemAdmin | null>(null);

  // ─── Conversions cache for unit selectors ────────────────────────────────
  const fetchUnitConversionsStore = useAppStore((s) => s.fetchUnitConversions);
  const [conversionsMap, setConversionsMap] = useState<Record<string, UnitConversion[]>>({});

  useEffect(() => {
    if (inventory.length === 0) { setConversionsMap({}); /* eslint-disable-line react-hooks/set-state-in-effect -- [literal-reset] reset conversions when inventory empties */ return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        inventory.map(async (ing) => {
          const convs = await fetchUnitConversionsStore(ing.id).catch(() => [] as UnitConversion[]);
          return [ing.id, convs] as [string, UnitConversion[]];
        }),
      );
      if (!cancelled) setConversionsMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [inventory, fetchUnitConversionsStore]);

  /** Resolve recipe components: explode BoM references into their sub-components */
  const resolvedRecipes = useMemo(() => {
    const map: Record<string, Array<{ componentType: string; name: string; quantity: number; unit: string; unitCost?: number }>> = {};
    for (const item of menuItems) {
      const resolved: typeof map[string] = [];
      for (const comp of item.recipe) {
        if (comp.componentType === 'bom') {
          const bom = bomItems.find((b) => b.id === comp.componentId);
          if (bom && bom.components.length > 0) {
            const scale = comp.quantity / Number(bom.yieldQuantity || 1);
            for (const sub of bom.components) {
              const subInv = inventory.find((i) => i.id === sub.componentId);
              const subName = sub.componentType === 'ingredient'
                ? (subInv?.name ?? sub.componentId)
                : sub.componentType === 'prep'
                  ? (prepItems.find((p) => p.id === sub.componentId)?.name ?? sub.componentId)
                  : (bomItems.find((b) => b.id === sub.componentId)?.name ?? sub.componentId);

              const qty = Number(sub.quantity) * scale;
              resolved.push({
                componentType: sub.componentType,
                name: subName,
                quantity: qty,
                unit: sub.unit,
                unitCost: subInv?.unitCost ? Number(subInv.unitCost) * qty : undefined,
              });
            }
          } else {
            // BoM not found — show the reference as fallback
            resolved.push({
              componentType: 'bom',
              name: comp.componentName ?? comp.componentId,
              quantity: comp.quantity,
              unit: comp.unit,
            });
          }
        } else {
          // Regular ingredient / prep component
          const inv = inventory.find((i) => i.id === comp.componentId);

          const name = comp.componentName
            ?? (comp.componentType === 'prep' ? prepItems.find((p) => p.id === comp.componentId)?.name : undefined)
            ?? inv?.name
            ?? comp.componentId;

          resolved.push({
            componentType: comp.componentType,
            name,
            quantity: comp.quantity,
            unit: comp.unit,
            unitCost: inv?.unitCost ? Number(inv.unitCost) * comp.quantity : undefined,
          });
        }
      }
      map[item.id] = resolved;
    }
    return map;
  }, [menuItems, bomItems, inventory, prepItems]);

  useEffect(() => {
    if (!selectedMenu) return;
    setEditName(selectedMenu.name); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize edit form fields from selected menu item; safe because all values are primitives or read-only arrays
    setEditCategory(selectedMenu.category);  
    setEditCategoryId(selectedMenu.categoryId ?? '');  
    setEditPrice(String(selectedMenu.price));  
    setEditPrintAreas(selectedMenu.printAreas);  
    setEditModifiers(selectedMenu.modifiers ?? []);  
    setEditModifierGroups(selectedMenu.modifierGroups ?? []);  
    setEditRecipe(selectedMenu.recipe);  
    setEditTab('metadata');
  }, [selectedMenu]);

  const editModalDirty = useMemo(() => {
    if (!selectedMenu) return false;
    const recipeChanged = JSON.stringify(editRecipe) !== JSON.stringify(selectedMenu.recipe);
    const modifiersChanged = JSON.stringify(editModifiers) !== JSON.stringify(selectedMenu.modifiers ?? []);
    const modifierGroupsChanged = JSON.stringify(editModifierGroups) !== JSON.stringify(selectedMenu.modifierGroups ?? []);
    return (
      editName.trim() !== selectedMenu.name
      || editCategoryId !== (selectedMenu.categoryId ?? '')
      || editPrice !== String(selectedMenu.price)
      || JSON.stringify(editPrintAreas) !== JSON.stringify(selectedMenu.printAreas)
      || recipeChanged
      || modifiersChanged
      || modifierGroupsChanged
    );
  }, [selectedMenu, editName, editCategoryId, editPrice, editPrintAreas, editRecipe, editModifiers, editModifierGroups]);

  const [editErrors, setEditErrors] = useState<ValidationErrors>({});

  const saveMetadata = async () => {
    if (!selectedMenu || !onUpdate) return;
    const errors: ValidationErrors = {};
    errors.name = required(editName, 'Nome') ?? minLength(editName, 2, 'Nome');
    errors.price = positiveNumber(editPrice, 'Prezzo');
    setEditErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const price = Number(editPrice);
    await onUpdate(selectedMenu.id, {
      name: editName.trim(),
      category: editCategoryId ? (menuCategories.find((c) => c.id === editCategoryId)?.name ?? editCategory.trim()) : editCategory.trim(),
      categoryId: editCategoryId || undefined,
      price,
      printAreas: editPrintAreas,
      modifierGroups: editModifierGroups,
    });
    void onRefresh?.();
  };

  const saveRecipe = async () => {
    if (!selectedMenu || !onUpdate) return;
    if (editRecipe.length === 0) return;
    const unitByKey = new Map(
      selectedMenu.recipe.map((r) => [`${r.componentType}:${r.componentId}`, r.unit]),
    );
    await onUpdate(selectedMenu.id, {
      components: editRecipe.map((c) => ({
        componentType: c.componentType,
        componentId: c.componentId,
        quantity: c.quantity,
        unit: (unitByKey.get(`${c.componentType}:${c.componentId}`) ?? 'pz') as CanonicalUnit,
      })),
    });
    void onRefresh?.();
  };

  const removeItem = async (id: string) => {
    if (!onDelete) return;
    requestConfirm('Eliminare questo prodotto?', async () => {
      await onDelete(id);
      if (selectedMenuId === id) setSelectedMenuId('');
      void onRefresh?.();
    });
  };

  const handleCloseModal = useCallback(() => setSelectedMenuId(''), []);

  const replaceBomComponents = useAppStore((s) => s.replaceBomComponents);
  const createBomItem = useAppStore((s) => s.createBomItem);
  const handleReplaceBomComponents = useCallback(async (
    bomId: string,
    payload: { components: Array<{ componentType: string; componentId: string; quantity: number; unit: string }> },
  ) => {
    await replaceBomComponents(bomId, payload as any);
    void onRefresh?.();
  }, [replaceBomComponents, onRefresh]);

  const handleCreateBomItem = useCallback(async (payload: any): Promise<string | null> => {
    await createBomItem(payload);
    void onRefresh?.();
    // Store has bomItems updated synchronously after createBomItem completes
    const state = useAppStore.getState();
    // Reverse find to get the most recently created BoM (newest appended last)
    const match = [...state.bomItems].reverse().find((b) => b.name === payload.name);
    return match?.id ?? null;
  }, [createBomItem, onRefresh]);

  const handleOpenBomTab = useCallback((bomId: string) => {
    setShowFoodModal(false);
    setEditBuilderItem(null);
    onOpenBomTab?.(bomId);
  }, [onOpenBomTab]);

  return (
    <>
      <TabTemplate
        title="Prodotti Vendibili"
        headerActions={
          <>
            <Button variant="secondary" onClick={() => void onRefresh?.()}>
              <RotateCcw size={14} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setShowSelectionModal(true)}>
              <Plus size={14} />
              Nuovo prodotto
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cerca prodotto o categoria..."
        chips={{
          ariaLabel: 'Filtra prodotti per categoria',
          value: filterCategoryId,
          onChange: setFilterCategoryId,
          options: chipOptions,
        }}
        noScroll
      >

      {/* Mobile Card Layout */}
      <div className="md:hidden overflow-auto flex-1">
          <MenuCards
          resolvedRecipes={resolvedRecipes}
          items={filteredMenuItems}
          onEdit={(id) => {
            const item = menuItems.find((m) => m.id === id);
            if (!item) return;
            const hasRecipe = item.recipe && item.recipe.length > 0;
            const hasModifierGroups = item.modifierGroups && item.modifierGroups.length > 0;
            // Products with only modifier groups (no recipe, no 'Formato' variants)
            // are plain items with choice groups (e.g. VASCHETTA 'A scelta'): the
            // FoodProductModal handles and persists them. VariableProductModal is
            // reserved for true variant products (group named 'Formato').
            const isVariantProduct = hasModifierGroups && item.modifierGroups.some((g) => g.name === 'Formato');
            setEditBuilderItem(item);
            if (hasRecipe || (hasModifierGroups && !isVariantProduct)) {
              setShowFoodModal(true);
            } else if (isVariantProduct) {
              setShowVariableModal(true);
            } else {
              setShowSimpleModal(true);
            }
          }}
          onDelete={(id) => void removeItem(id)}
          onToggleActive={(id, active) => void onSetMenuItemActive?.(id, active)}
          simpleCatalogMode={simpleCatalogMode}
        />
        {filteredMenuItems.length === 0 && (
          <p className="px-4 py-8 text-sm text-text-muted text-center">
            <LoadingOrEmpty
              loading={loading}
              icon={<UtensilsCrossed size={24} />}
              title={searchQuery ? 'Nessun prodotto corrisponde alla ricerca.' : 'Nessun prodotto configurato.'}
              description={!searchQuery ? 'Crea il primo prodotto per iniziare.' : undefined}
            />
          </p>
        )}
      </div>

      {/* Products Table (Desktop) */}
      <div className="hidden md:block overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg/50 border-b border-border">
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Prodotto</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Categoria</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Prezzo</th>
              {!simpleCatalogMode && (<th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Recipe</th>)}
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Stato</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredMenuItems.map((item) => (
              <tr key={item.id} className="hover:bg-bg/30 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-bold text-secondary text-sm">{item.name}</p>
                </td>
                <td className="px-6 py-4 text-sm">{item.category}</td>
                <td className="px-6 py-4 text-sm font-bold">€{item.price.toFixed(2)}</td>
                {!simpleCatalogMode && (
                  <td className="px-6 py-4">
                    {(() => {
                      const resolved = resolvedRecipes[item.id];
                      if (resolved && resolved.length > 0) {
                        return (
                          <div className="space-y-1">
                            {resolved.map((comp, idx) => (
                              <p key={`${item.id}-rcp-${idx}`} className="text-xs text-secondary">
                                <span className="font-bold uppercase text-[10px] mr-2">{componentTypeLabel(comp.componentType as any)}</span>
                                {comp.name} · {Number.isInteger(comp.quantity) ? comp.quantity : comp.quantity.toFixed(2)} {comp.unit}
                                {comp.unitCost !== undefined && <span className="ml-1 text-text-muted">€{comp.unitCost.toFixed(2)}</span>}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      // Show warning only for products that truly have no recipe (e.g. simple products)
                      if (item.recipe.length === 0) {
                        return <p className="text-xs text-danger">Ricetta mancante</p>;
                      }
                      return <p className="text-xs text-text-muted italic">—</p>;
                    })()}
                  </td>
                )}
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {item.printAreas.map((area) => (
                      <span key={`${item.id}-area-${area}`} className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-bg border border-border">{PRINT_AREA_LABELS[area] ?? area}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <StatusPill label={item.isActive ? 'Attivo' : 'Inattivo'} tone={item.isActive ? 'success' : 'neutral'} />
                    <Button variant="ghost" onClick={() => void onSetMenuItemActive?.(item.id, !item.isActive)}>
                      {item.isActive ? 'Disattiva' : 'Attiva'}
                    </Button>
                    <Button variant="secondary" onClick={() => {
                      const hasRecipe = item.recipe && item.recipe.length > 0;
                      const hasModifierGroups = item.modifierGroups && item.modifierGroups.length > 0;
                      // Products with only modifier groups (no recipe, no 'Formato' variants)
                      // are plain items with choice groups (e.g. VASCHETTA 'A scelta'): the
                      // FoodProductModal handles and persists them. VariableProductModal is
                      // reserved for true variant products (group named 'Formato').
                      const isVariantProduct = hasModifierGroups && item.modifierGroups.some((g) => g.name === 'Formato');
                      setEditBuilderItem(item);
                      if (hasRecipe || (hasModifierGroups && !isVariantProduct)) {
                        setShowFoodModal(true);
                      } else if (isVariantProduct) {
                        setShowVariableModal(true);
                      } else {
                        setShowSimpleModal(true);
                      }
                    }}>
                      Modifica
                    </Button>
                    {onDelete && (
                      <Button variant="danger" onClick={() => void removeItem(item.id)}>
                        Elimina
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredMenuItems.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-text-muted" colSpan={simpleCatalogMode ? 4 : 5}>
                  <LoadingOrEmpty
                    loading={loading}
                    icon={<UtensilsCrossed size={24} />}
                    title={searchQuery ? 'Nessun prodotto corrisponde alla ricerca.' : 'Nessun prodotto configurato.'}
                    description={!searchQuery ? 'Crea il primo prodotto per iniziare.' : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </TabTemplate>

      {/* Tabbed Edit Modal */}
      <Modal
        open={!!selectedMenu}
        onClose={handleCloseModal}
        title={selectedMenu ? `Editor: ${selectedMenu.name}` : ''}
        size="lg"
        dirty={editModalDirty}
        footer={
          <Button variant="secondary" onClick={() => setSelectedMenuId('')}>
            Chiudi
          </Button>
        }
      >
          {selectedMenu && (
            <>
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 border-b border-border -mx-4 px-4">
                {([
                  { key: 'metadata', label: 'Dettagli' },
                  { key: 'recipe', label: 'Ricetta' },
                  { key: 'modifiers', label: 'Modificatori' },
                  { key: 'preview', label: 'Anteprima' },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setEditTab(tab.key)}
                    className={`px-3 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors ${
                      editTab === tab.key
                        ? 'text-primary border-primary'
                        : 'text-text-muted border-transparent hover:text-secondary'
                    }`}
                  >
                    {tab.label}
                    {editTab === tab.key && editModalDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent ml-1 inline-block" />
                    )}
                  </button>
                ))}
              </div>

              {/* Metadata Tab */}
              {editTab === 'metadata' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <FormField label="Nome" error={editErrors.name?.message}>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.name)}`} />
                    </FormField>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Categoria</label>
                      <InlineCategoryPicker
                        categories={menuCategories}
                        selectedId={editCategoryId}
                        onSelect={(id) => { setEditCategoryId(id); const c = menuCategories.find((cat) => cat.id === id); if (c) setEditCategory(c.name); }}
                        onCreate={async (name) => { if (onCreateCategory) await onCreateCategory(name, 'menu'); }}
                        label=""
                      />
                    </div>
                    <FormField label="Prezzo (€)" error={editErrors.price?.message}>
                      <input value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" min="0.01" step="0.10" aria-label="Prezzo" className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.price)}`} />
                    </FormField>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
                      <button
                        key={`edit-area-${area}`}
                        type="button"
                        onClick={() => setEditPrintAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area])}
                        className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${editPrintAreas.includes(area) ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'}`}
                      >
                        stampa {PRINT_AREA_LABELS[area] ?? area}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Stato</label>
                    <Button
                      variant={selectedMenu.isActive ? 'primary' : 'secondary'}
                      onClick={() => void onSetMenuItemActive?.(selectedMenu.id, !selectedMenu.isActive)}
                    >
                      {selectedMenu.isActive ? 'Attivo' : 'Inattivo'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="primary" onClick={() => void saveMetadata()}>
                      Salva dettagli
                    </Button>
                    <Button variant="danger" onClick={() => void removeItem(selectedMenu.id)}>
                      Elimina prodotto
                    </Button>
                  </div>
                </div>
              )}

              {/* Recipe Tab */}
              {editTab === 'recipe' && !simpleCatalogMode && (
                <div className="space-y-3 pt-2">
                  <RecipeBuilder
                    components={editRecipe}
                    inventory={inventory}
                    bomItems={bomItems}
                    prepItems={prepItems}
                    onChange={setEditRecipe}
                    showCost
                    conversionsMap={conversionsMap}
                  />
                  <Button
                    variant="primary"
                    onClick={() => void saveRecipe()}
                    disabled={editRecipe.length === 0}
                  >
                    Salva ricetta
                  </Button>
                </div>
              )}

              {/* Modifiers Tab */}
              {editTab === 'modifiers' && (
                <div className="space-y-3 pt-2">
                  <ModifierEditor
                    modifiers={editModifiers}
                    inventory={inventory}
                    onChange={setEditModifiers}
                  />
                   <ModifierGroupsEditor
                    value={editModifierGroups}
                    inventory={inventory}
                    prepItems={prepItems}
                    bomItems={bomItems}
                    onChange={setEditModifierGroups}
                    categoryPools={selectedMenu?.categoryId ? categoryModifierPools.filter((p) => p.categoryIds?.includes(selectedMenu.categoryId!) || p.categoryId === selectedMenu.categoryId) : []}
                  />
                  <Button
                    variant="primary"
                    onClick={() => void saveMetadata()}
                  >
                    Salva extra
                  </Button>
                </div>
              )}

              {/* Preview Tab */}
              {editTab === 'preview' && (
                <CustomerPreview
                  item={selectedMenu}
                  inventory={inventory}
                />
              )}
            </>
          )}
        </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Conferma"
        message={confirm?.message ?? ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* New Product Builder Modals */}
      <NewProductSelectionModal
        open={showSelectionModal}
        onClose={() => setShowSelectionModal(false)}
        onSelectSimple={() => { setShowSelectionModal(false); setShowSimpleModal(true); }}
        onSelectVariable={() => { setShowSelectionModal(false); setShowVariableModal(true); }}
        onSelectFood={() => { setShowSelectionModal(false); setShowFoodModal(true); }}
      />

      <SimpleProductModal
        open={showSimpleModal}
        onClose={() => { setShowSimpleModal(false); setEditBuilderItem(null); }}
        onSuccess={() => { setShowSimpleModal(false); setEditBuilderItem(null); void onRefresh?.(); }}
        categories={categories}
        inventory={inventory}
        categoryModifierPools={categoryModifierPools}
        prepItems={prepItems}
        onCreateCategory={onCreateCategory}
        onCreate={onCreate}
        onCreateMenuProduct={onCreateMenuProduct}
        onUpdate={onUpdate}
        editItem={editBuilderItem}
      />

      <VariableProductModal
        open={showVariableModal}
        onClose={() => { setShowVariableModal(false); setEditBuilderItem(null); }}
        onSuccess={() => { setShowVariableModal(false); setEditBuilderItem(null); void onRefresh?.(); }}
        categories={categories}
        inventory={inventory}
        bomItems={bomItems}
        categoryModifierPools={categoryModifierPools}
        onCreateCategory={onCreateCategory}
        onCreateMenuItem={onCreate}
        onCreateMenuProduct={onCreateMenuProduct}
        onUpdateMenuItem={onUpdate}
        editItem={editBuilderItem}
      />

      <FoodProductModal
        open={showFoodModal}
        onClose={() => { setShowFoodModal(false); setEditBuilderItem(null); }}
        onSuccess={() => { setShowFoodModal(false); setEditBuilderItem(null); void onRefresh?.(); }}
        categories={categories}
        inventory={inventory}
        bomItems={bomItems}
        prepItems={prepItems}
        categoryModifierPools={categoryModifierPools}
        onCreateCategory={onCreateCategory}
        onCreateMenuProduct={onCreateMenuProduct}
        onUpdateMenuItem={onUpdate}
        onCreateIngredient={onCreateIngredient ?? createIngredient}
        onCreatePrepItem={onCreatePrepItem ?? createPrepItem}
        onReplaceBomComponents={handleReplaceBomComponents}
        onCreateBomItem={handleCreateBomItem}
        conversionsMap={conversionsMap}
        onOpenBomTab={handleOpenBomTab}
        editItem={editBuilderItem}
      />
    </>
  );
}
