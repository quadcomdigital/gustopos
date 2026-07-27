import type {
  Ingredient, BomItem, PrepItem, MenuItemAdmin, Category,
  MenuItemCreateRequest, MenuItemUpdateRequest, MenuItemReplaceRecipeRequest,
  MenuItemModifier, PrintArea, ModifierGroup, CategoryModifierPool,
  IngredientCreateRequest,
} from '@gustopos/shared';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { RotateCcw, Search, Plus, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import Button from '../../shared/ui/atoms/Button';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import Skeleton from '../../shared/ui/atoms/Skeleton';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import Modal from '../../shared/ui/molecules/Modal';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import { useScopedCategories, componentTypeLabel, explodeBomCost } from './useInventoryShared';
import InlineCategoryPicker from './InlineCategoryPicker';
import RecipeBuilder from './RecipeBuilder';
import ModifierEditor from './ModifierEditor';
import ModifierGroupsEditor from './ModifierGroupsEditor';
import CustomerPreview from './CustomerPreview';
import { useDebounce } from '../../hooks/useDebounce';
import { required, minLength, positiveNumber, validNumber, getErrorClass, type ValidationErrors } from '../../shared/ui/hooks/useFieldValidation';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import MenuCards from './MenuCards';
import EmptyState from '../../shared/ui/atoms/EmptyState';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import { createIngredient, createPrepItem } from '../../shared/api/client';
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
  onUpdate?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  onReplaceRecipe?: (id: string, payload: MenuItemReplaceRecipeRequest) => Promise<void>;
  onSetMenuItemActive?: (id: string, active: boolean) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreateIngredient?: (payload: IngredientCreateRequest) => Promise<Ingredient>;
  onCreatePrepItem?: (payload: { ingredientId: string; name: string; quantityPerUnit: number; unit: string }) => Promise<PrepItem>;
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
  onUpdate,
  onReplaceRecipe,
  onSetMenuItemActive,
  onDelete,
  onCreateCategory,
  onCreateIngredient,
  onCreatePrepItem,
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

  const menuRecipeCandidates = useMemo(
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
  const [editDefaultContainerId, setEditDefaultContainerId] = useState('');

  // New product form state (kept for compatibility, but managed by new modals)
  const [newName] = useState('');
  const [newCategory] = useState('');
  const [newCategoryId] = useState('');
  const [newPrice] = useState('');
  const [newPrintAreas] = useState<PrintArea[]>(['kitchen']);
  const [newModifiers] = useState<MenuItemModifier[]>([]);
  const [newModifierGroups] = useState<ModifierGroup[]>([]);
  const [newRecipe] = useState<MenuItemCreateRequest['recipe']>([]);
  const [newDefaultContainerId] = useState('');
  const [newSaving] = useState(false);
  const [newError] = useState('');
  const [createErrors] = useState<ValidationErrors>({});
  const [showCreateModal] = useState(false);

  // New product builder state
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showSimpleModal, setShowSimpleModal] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [editBuilderItem, setEditBuilderItem] = useState<MenuItemAdmin | null>(null);

  const containerCandidates = useMemo(
    () => inventory.filter((i) => i.isContainer === 1 && i.isActive),
    [inventory],
  );

  useEffect(() => {
    if (!selectedMenu) return;
    setEditName(selectedMenu.name);
    setEditCategory(selectedMenu.category);
    setEditCategoryId(selectedMenu.categoryId ?? '');
    setEditPrice(String(selectedMenu.price));
    setEditPrintAreas(selectedMenu.printAreas);
    setEditModifiers(selectedMenu.modifiers ?? []);
    setEditModifierGroups(selectedMenu.modifierGroups ?? []);
    setEditRecipe(selectedMenu.recipe);
    setEditDefaultContainerId(selectedMenu.defaultContainerId ?? '');
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
      || editDefaultContainerId !== (selectedMenu.defaultContainerId ?? '')
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
      defaultContainerId: editDefaultContainerId || null,
      price,
      printAreas: editPrintAreas,
      modifiers: editModifiers,
      modifierGroups: editModifierGroups,
    });
    void onRefresh?.();
  };

  const saveRecipe = async () => {
    if (!selectedMenu || !onReplaceRecipe) return;
    if (editRecipe.length === 0) return;
    await onReplaceRecipe(selectedMenu.id, { recipe: editRecipe });
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

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <SectionHeader
        title="Prodotti Vendibili"
        actions={
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
      />
      <div className="px-4 py-2 border-b border-border bg-bg/20">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca prodotto o categoria..."
            className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
          />
        </div>
      </div>

      {menuCategories.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-bg/20">
          <SegmentedChips
            ariaLabel="Filtra prodotti per categoria"
            value={filterCategoryId}
            onChange={setFilterCategoryId}
            options={chipOptions}
            size="sm"
          />
        </div>
      )}

      {/* Mobile Card Layout */}
      <div className="md:hidden overflow-auto flex-1">
          <MenuCards
          items={filteredMenuItems}
          onEdit={(id) => {
            const item = menuItems.find((m) => m.id === id);
            if (!item) return;
            const hasRecipe = item.recipe && item.recipe.length > 0;
            const hasModifierGroups = item.modifierGroups && item.modifierGroups.length > 0;
            setEditBuilderItem(item);
            if (hasRecipe) {
              setShowFoodModal(true);
            } else if (hasModifierGroups) {
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
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <EmptyState
                icon={<UtensilsCrossed size={24} />}
                title={searchQuery ? 'Nessun prodotto corrisponde alla ricerca.' : 'Nessun prodotto configurato.'}
                description={!searchQuery ? 'Crea il primo prodotto per iniziare.' : undefined}
              />
            )}
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
                    {item.recipe.length > 0 ? (
                      <div className="space-y-1">
                        {item.recipe.map((component, idx) => {
                          const candidate = menuRecipeCandidates.find((c) => c.id === component.componentId);
                          const lineCost = candidate?.unitCost ? component.quantity * candidate.unitCost : undefined;
                          return (
                            <p key={`${item.id}-${idx}`} className="text-xs text-secondary">
                              <span className="font-bold uppercase text-[10px] mr-2">{componentTypeLabel(component.componentType)}</span>
                              {component.componentName ?? candidate?.label ?? component.componentId} · {component.quantity} {component.unit}
                              {lineCost !== undefined && <span className="ml-1 text-text-muted">€{lineCost.toFixed(2)}</span>}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-danger">Ricetta mancante</p>
                    )}
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
                      setEditBuilderItem(item);
                      if (hasRecipe) {
                        setShowFoodModal(true);
                      } else if (hasModifierGroups) {
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
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<UtensilsCrossed size={24} />}
                      title={searchQuery ? 'Nessun prodotto corrisponde alla ricerca.' : 'Nessun prodotto configurato.'}
                      description={!searchQuery ? 'Crea il primo prodotto per iniziare.' : undefined}
                    />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Nome</label>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.name)}`} />
                      {editErrors.name && <p className="text-[9px] text-danger">{editErrors.name.message}</p>}
                    </div>
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
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Prezzo (€)</label>
                      <input value={editPrice} onChange={(e) => setEditPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" min="0.01" step="0.10" aria-label="Prezzo" className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.price)}`} />
                      {editErrors.price && <p className="text-[9px] text-danger">{editErrors.price.message}</p>}
                    </div>
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

                  {containerCandidates.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">Container di default</label>
                      <div className="flex-1">
                        <SearchableSelect
                          items={containerCandidates}
                          getLabel={(c) => c.name}
                          getValue={(c) => c.id}
                          selectedValue={editDefaultContainerId}
                          onSelect={setEditDefaultContainerId}
                          placeholder="Nessun contenitore"
                        />
                      </div>
                      {editDefaultContainerId && (
                        <button
                          type="button"
                          onClick={() => setEditDefaultContainerId('')}
                          className="text-[10px] font-bold uppercase tracking-wider text-danger"
                        >
                          Rimuovi
                        </button>
                      )}
                    </div>
                  )}

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
        onCreateCategory={onCreateCategory}
        onCreate={onCreate!}
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
        onCreateMenuItem={onCreate!}
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
        onCreateMenuItem={onCreate!}
        onUpdateMenuItem={onUpdate}
        onReplaceRecipe={onReplaceRecipe}
        onCreateIngredient={onCreateIngredient ?? createIngredient}
        onCreatePrepItem={onCreatePrepItem ?? createPrepItem}
        editItem={editBuilderItem}
      />
    </div>
  );
}
