import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Category, Ingredient, IngredientCreateRequest, BomItem, PrepItem, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest, MenuItemReplaceRecipeRequest, MenuRecipeComponent, CategoryModifierPool, PrintArea, MenuItemModifier, ModifierGroup } from '@gustopos/shared';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';
import SearchableSelect from '../../../shared/ui/molecules/SearchableSelect';
import InlineCategoryPicker from '../InlineCategoryPicker';
import ModifierEditor from '../ModifierEditor';
import ModifierGroupsEditor from '../ModifierGroupsEditor';
import ComponentTree from './ComponentTree';
import AddComponentModal from './AddComponentModal';
import EditComponentModal from './EditComponentModal';
import CreateIngredientInlineModal from './CreateIngredientInlineModal';
import CreatePrepInlineModal from './CreatePrepInlineModal';
import { required, minLength, positiveNumber, getErrorClass, type ValidationErrors } from '../../../shared/ui/hooks/useFieldValidation';
import { explodeBomCost } from '../useInventoryShared';

const PRINT_AREA_LABELS: Record<string, string> = { kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' };

interface FoodProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  categoryModifierPools?: CategoryModifierPool[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreateMenuItem: (payload: MenuItemCreateRequest) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  onReplaceRecipe?: (id: string, payload: MenuItemReplaceRecipeRequest) => Promise<void>;
  onCreateIngredient?: (payload: IngredientCreateRequest) => Promise<Ingredient>;
  onCreatePrepItem?: (payload: { ingredientId: string; name: string; quantityPerUnit: number; unit: string }) => Promise<PrepItem>;
  editItem?: MenuItemAdmin | null;
}

export default function FoodProductModal({
  open, onClose, onSuccess, categories, inventory, bomItems, prepItems, categoryModifierPools = [],
  onCreateCategory, onCreateMenuItem, onUpdateMenuItem, onReplaceRecipe, onCreateIngredient, onCreatePrepItem, editItem,
}: FoodProductModalProps) {
  const isEdit = !!editItem;
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [price, setPrice] = useState('');
  const [defaultContainerId, setDefaultContainerId] = useState('');
  const [printAreas, setPrintAreas] = useState<PrintArea[]>(['kitchen']);
  const [recipe, setRecipe] = useState<MenuRecipeComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');

  const [showAddComponent, setShowAddComponent] = useState(false);
  const [editComponent, setEditComponent] = useState<MenuRecipeComponent | null>(null);
  const [showCreateIngredient, setShowCreateIngredient] = useState(false);
  const [showCreatePrep, setShowCreatePrep] = useState(false);
  const [modifiers, setModifiers] = useState<MenuItemModifier[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  const menuCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'menu'), [categories]);
  const containerCandidates = useMemo(() => inventory.filter((i) => i.isContainer === 1).map((i) => ({ id: i.id, name: i.name })), [inventory]);

  useEffect(() => {
    if (editItem && open) {
      setName(editItem.name);
      setCategoryId(editItem.categoryId ?? '');
      setCategoryName(editItem.category);
      setPrice(String(editItem.price));
      setDefaultContainerId(editItem.defaultContainerId ?? '');
      setPrintAreas(editItem.printAreas?.length ? editItem.printAreas : ['kitchen']);
      setRecipe(editItem.recipe ?? []);
      setModifiers(editItem.modifiers ?? []);
      setModifierGroups(editItem.modifierGroups ?? []);
    } else if (!open) {
      setName(''); setCategoryId(''); setCategoryName(''); setPrice(''); setDefaultContainerId(''); setPrintAreas(['kitchen']); setRecipe([]); setModifiers([]); setModifierGroups([]); setErrors({}); setError('');
    }
  }, [editItem, open]);

  const estimatedCost = useMemo(() => explodeBomCost(recipe, inventory, bomItems, prepItems), [recipe, inventory, bomItems, prepItems]);

  const marginWarning = useMemo(() => {
    const p = Number(price);
    if (!p || p <= 0 || estimatedCost <= 0) return '';
    if (estimatedCost > p) return `Costo stimato (€${estimatedCost.toFixed(2)}) supera il prezzo (€${p.toFixed(2)})`;
    const margin = ((p - estimatedCost) / p) * 100;
    if (margin < 30) return `Margine basso: ${margin.toFixed(0)}%`;
    return '';
  }, [price, estimatedCost]);

  const handleSave = async () => {
    const errs: ValidationErrors = {};
    errs.name = required(name, 'Nome') ?? minLength(name, 2, 'Nome');
    errs.price = positiveNumber(price, 'Prezzo');
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    if (recipe.length === 0) { setError('Aggiungi almeno un componente.'); return; }
    setSaving(true);
    setError('');
    try {
      const catName = categoryId ? (menuCategories.find((c) => c.id === categoryId)?.name ?? categoryName.trim()) : categoryName.trim();

      if (isEdit && onUpdateMenuItem && editItem) {
        await onUpdateMenuItem(editItem.id, {
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          defaultContainerId: defaultContainerId || null,
          price: Number(price),
          printAreas,
          modifiers,
          modifierGroups,
        });
        if (onReplaceRecipe) {
          await onReplaceRecipe(editItem.id, { recipe });
        }
      } else {
        await onCreateMenuItem({
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          defaultContainerId: defaultContainerId || null,
          printAreas,
          price: Number(price),
          recipe,
          modifiers,
          modifierGroups,
        });
      }
      setSaving(false);
      onSuccess();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? 'Errore durante il salvataggio');
    }
  };

  const handleAddComponent = useCallback((comp: MenuRecipeComponent) => {
    setRecipe((prev) => [...prev, comp]);
  }, []);

  const handleEditSave = useCallback((updated: MenuRecipeComponent) => {
    setRecipe((prev) => prev.map((c) => c.componentType === updated.componentType && c.componentId === updated.componentId ? updated : c));
  }, []);

  const handleSwap = useCallback((newType: 'ingredient' | 'prep' | 'bom', newId: string) => {
    if (!editComponent) return;
    const existing = recipe.find((c) => c.componentType === editComponent.componentType && c.componentId === editComponent.componentId);
    if (!existing) return;
    const unit = newType === 'ingredient' ? inventory.find((i) => i.id === newId)?.unit ?? existing.unit
      : newType === 'prep' ? prepItems.find((p) => p.id === newId)?.unit ?? existing.unit
      : bomItems.find((b) => b.id === newId)?.unit ?? existing.unit;
    setRecipe((prev) => prev.map((c) => c === existing ? { componentType: newType, componentId: newId, quantity: 1, unit } : c));
    setEditComponent(null);
  }, [editComponent, recipe, inventory, prepItems, bomItems]);

  const handleRemove = useCallback((type: string, id: string) => {
    setRecipe((prev) => prev.filter((c) => !(c.componentType === type && c.componentId === id)));
  }, []);

  const handleQuantityChange = useCallback((type: string, id: string, qty: number) => {
    setRecipe((prev) => prev.map((c) => c.componentType === type && c.componentId === id ? { ...c, quantity: qty } : c));
  }, []);

  const dirty = useMemo(() => {
    if (!isEdit || !editItem) return name !== '' || price !== '' || recipe.length > 0;
    return (
      name !== editItem.name
      || categoryId !== (editItem.categoryId ?? '')
      || defaultContainerId !== (editItem.defaultContainerId ?? '')
      || price !== String(editItem.price)
      || JSON.stringify(printAreas) !== JSON.stringify(editItem.printAreas)
      || JSON.stringify(recipe) !== JSON.stringify(editItem.recipe)
      || JSON.stringify(modifiers) !== JSON.stringify(editItem.modifiers)
      || JSON.stringify(modifierGroups) !== JSON.stringify(editItem.modifierGroups)
    );
  }, [isEdit, editItem, name, categoryId, defaultContainerId, price, printAreas, recipe, modifiers, modifierGroups]);

  return (
    <>
      <Modal
        open={open} onClose={onClose}
        title={isEdit ? `Modifica: ${editItem?.name}` : 'Prodotto food'}
        size="lg" dirty={dirty}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Annulla</Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              {saving ? 'Salvataggio...' : isEdit ? 'Salva' : 'Crea prodotto'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.name)}`} />
              {errors.name && <p className="text-[9px] text-danger mt-0.5">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Categoria</label>
              <InlineCategoryPicker
                categories={menuCategories} selectedId={categoryId}
                onSelect={(id) => { setCategoryId(id); const c = menuCategories.find((cat) => cat.id === id); if (c) setCategoryName(c.name); }}
                onCreate={async (n) => { if (onCreateCategory) await onCreateCategory(n, 'menu'); }}
                label=""
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Prezzo (€)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Prezzo" inputMode="decimal" min="0.01" step="0.10" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.price)}`} />
              {errors.price && <p className="text-[9px] text-danger mt-0.5">{errors.price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="flex flex-wrap gap-2">
              {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
                <button key={area} type="button"
                  onClick={() => setPrintAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area])}
                  className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${printAreas.includes(area) ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'}`}>
                  stampa {PRINT_AREA_LABELS[area]}
                </button>
              ))}
            </div>
            {containerCandidates.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">Container</label>
                <div className="flex-1">
                  <SearchableSelect items={containerCandidates} getLabel={(c) => c.name} getValue={(c) => c.id} selectedValue={defaultContainerId} onSelect={setDefaultContainerId} placeholder="Nessun" />
                </div>
                {defaultContainerId && (
                  <button type="button" onClick={() => setDefaultContainerId('')} className="text-[10px] font-bold uppercase tracking-wider text-danger">Rimuovi</button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Componenti</label>
                <span className="text-[10px] font-bold text-text-muted px-1.5 py-0.5 rounded bg-bg">{recipe.length}</span>
              </div>
              <Button variant="secondary" onClick={() => setShowAddComponent(true)}>
                <Plus size={14} /> Aggiungi componente
              </Button>
            </div>

            <ComponentTree
              components={recipe}
              inventory={inventory}
              bomItems={bomItems}
              prepItems={prepItems}
              onEdit={(comp) => setEditComponent(comp)}
              onRemove={handleRemove}
              onQuantityChange={handleQuantityChange}
            />
          </div>

          <div className="border-t border-border pt-3">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2">Modificatori</label>
            <ModifierEditor
              modifiers={modifiers}
              inventory={inventory}
              onChange={setModifiers}
            />
            <ModifierGroupsEditor
              value={modifierGroups}
              inventory={inventory}
              onChange={setModifierGroups}
              categoryPools={categoryId ? categoryModifierPools.filter((p) => p.categoryIds?.includes(categoryId) || p.categoryId === categoryId) : []}
            />
          </div>

          {estimatedCost > 0 && (
            <div className="flex items-center justify-between text-xs text-text-muted bg-bg rounded-lg px-3 py-2 border border-border">
              <span>Costo stimato:</span>
              <span className="font-bold text-primary">€{estimatedCost.toFixed(2)}</span>
            </div>
          )}

          {marginWarning && (
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-800 text-xs">
              <AlertTriangle size={14} className="shrink-0" />
              {marginWarning}
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </Modal>

      <AddComponentModal
        open={showAddComponent}
        onClose={() => setShowAddComponent(false)}
        onAdd={handleAddComponent}
        onCreateIngredient={() => setShowCreateIngredient(true)}
        onCreatePrep={() => setShowCreatePrep(true)}
        inventory={inventory}
        bomItems={bomItems}
        prepItems={prepItems}
        existingComponents={recipe}
      />

      <EditComponentModal
        open={!!editComponent}
        onClose={() => setEditComponent(null)}
        component={editComponent}
        inventory={inventory}
        bomItems={bomItems}
        prepItems={prepItems}
        onSave={handleEditSave}
        onSwap={handleSwap}
        onRemove={() => { if (editComponent) { handleRemove(editComponent.componentType, editComponent.componentId); setEditComponent(null); } }}
      />

      {onCreateIngredient && (
        <CreateIngredientInlineModal
          open={showCreateIngredient}
          onClose={() => setShowCreateIngredient(false)}
          onSuccess={(ing) => handleAddComponent({ componentType: 'ingredient', componentId: ing.id, quantity: 1, unit: ing.unit })}
          categories={categories}
          onCreateCategory={onCreateCategory}
          onCreate={onCreateIngredient}
        />
      )}

      {onCreatePrepItem && (
        <CreatePrepInlineModal
          open={showCreatePrep}
          onClose={() => setShowCreatePrep(false)}
          onSuccess={(preps) => { preps.forEach((p) => handleAddComponent({ componentType: 'prep', componentId: p.id, quantity: 1, unit: p.unit })); }}
          inventory={inventory}
          onCreate={onCreatePrepItem}
        />
      )}
    </>
  );
}
