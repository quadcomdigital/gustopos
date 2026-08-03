import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Category, Ingredient, IngredientCreateRequest, BomItem, BomCreateRequest, PrepItem, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest, MenuItemReplaceRecipeRequest, MenuRecipeComponent, CategoryModifierPool, PrintArea, MenuItemModifier, ModifierGroup, UnitConversion } from '@gustopos/shared';
import FormField from '../../../shared/ui/molecules/FormField';
import { Plus, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import SaveFooter from '../../../shared/ui/molecules/SaveFooter';
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
  /** Called when a sub-component inside an expanded BoM is edited/removed — cascades to the BoM API */
  onReplaceBomComponents?: (bomId: string, payload: { components: Array<{ componentType: string; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
  /** Called to create a new BoM from the current recipe's components — returns the new BoM ID or null */
  onCreateBomItem?: (payload: BomCreateRequest) => Promise<string | null>;
  /** Called when user clicks 'Apri in BoM' quick-link — closes the modal and navigates */
  onOpenBomTab?: (bomId: string) => void;
  /** Map of ingredientId → unit conversions for unit selectors in child modals */
  conversionsMap?: Record<string, UnitConversion[]>;
  editItem?: MenuItemAdmin | null;
}

export default function FoodProductModal({
  open, onClose, onSuccess, categories, inventory, bomItems, prepItems, categoryModifierPools = [],
  onCreateCategory, onCreateMenuItem, onUpdateMenuItem, onReplaceRecipe, onCreateIngredient, onCreatePrepItem,
  conversionsMap = {},
  onReplaceBomComponents, onCreateBomItem, onOpenBomTab, editItem,
}: FoodProductModalProps) {
  const isEdit = !!editItem;
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [price, setPrice] = useState('');
  const [defaultContainerId, setDefaultContainerId] = useState('');
  const [printAreas, setPrintAreas] = useState<PrintArea[]>(['kitchen']);
  const [recipe, setRecipe] = useState<MenuRecipeComponent[]>([]);
  const [isBase, setIsBase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');

  const [showAddComponent, setShowAddComponent] = useState(false);
  const [editComponent, setEditComponent] = useState<MenuRecipeComponent | null>(null);
  const [showCreateIngredient, setShowCreateIngredient] = useState(false);
  const [showCreatePrep, setShowCreatePrep] = useState(false);
  const [modifiers, setModifiers] = useState<MenuItemModifier[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  // Keep track of original BoM ID when editing, so we can update it on save
  const [originalBomId, setOriginalBomId] = useState<string | null>(null);
  // Snapshot of the flattened recipe at edit-open time, for accurate dirty detection
  const [originalResolved, setOriginalResolved] = useState<MenuRecipeComponent[]>([]);

  // Save-as-BoM state
  const [showBomSave, setShowBomSave] = useState(false);
  const [bomSaveName, setBomSaveName] = useState('');
  const [bomSaveUnit, setBomSaveUnit] = useState('');
  const [bomSaveYield, setBomSaveYield] = useState('1');
  const [bomSaving, setBomSaving] = useState(false);

  const menuCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'menu'), [categories]);
  const containerCandidates = useMemo(() => inventory.filter((i) => i.isContainer === 1).map((i) => ({ id: i.id, name: i.name })), [inventory]);

  useEffect(() => {
    if (editItem && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] initializes form fields from editItem prop on modal open; safe because all setters receive primitive values derived from props, not from previous state
      setName(editItem.name);
      setCategoryId(editItem.categoryId ?? '');
      setCategoryName(editItem.category);
      setPrice(String(editItem.price));
      setDefaultContainerId(editItem.defaultContainerId ?? '');
      setPrintAreas(editItem.printAreas?.length ? editItem.printAreas : ['kitchen']);
      setModifiers(editItem.modifiers ?? []);
      setModifierGroups(editItem.modifierGroups ?? []);

      // Flatten any BoM references into their sub-components for inline editing.
      // The resolved array is what the user sees and edits — the BoM is an
      // implementation detail that gets updated on save.
      const bomComp = (editItem.recipe ?? []).find((c) => c.componentType === 'bom');
      setOriginalBomId(bomComp?.componentId ?? null);

      const resolved = (editItem.recipe ?? []).flatMap((comp) => {
        if (comp.componentType === 'bom') {
          const bom = bomItems.find((b) => b.id === comp.componentId);
          if (bom && bom.components.length > 0) {
            const scale = comp.quantity / Number(bom.yieldQuantity || 1);
            return bom.components
              .filter((sub) => {
                // Exclude container ingredients — they're managed via the container selector
                if (sub.componentType === 'ingredient') {
                  const ing = inventory.find((i) => i.id === sub.componentId);
                  return !ing || ing.isContainer !== 1;
                }
                return true;
              })
              .map((sub) => ({
                componentType: sub.componentType as 'ingredient' | 'bom' | 'prep',
                componentId: sub.componentId,
                quantity: Number(sub.quantity) * scale,
                unit: sub.unit,
              }));
          }
        }
        // Exclude container ingredients from top-level recipe too
        if (comp.componentType === 'ingredient') {
          const ing = inventory.find((i) => i.id === comp.componentId);
          if (ing?.isContainer === 1) return [];
        }
        return [comp];
      });

      setRecipe(resolved);
      setOriginalResolved(JSON.parse(JSON.stringify(resolved)));
      // Infer BASE mode: if price > 0 and no recipe, it's a BASE product
      setIsBase(editItem.price > 0 && resolved.length === 0);
    } else if (!open) {
      setName(''); setCategoryId(''); setCategoryName(''); setPrice(''); setDefaultContainerId(''); setPrintAreas(['kitchen']); setRecipe([]); setIsBase(false); setModifiers([]); setModifierGroups([]); setErrors({}); setError('');
      setOriginalBomId(null);
      setOriginalResolved([]);
    }
  }, [editItem, open]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!isBase && recipe.length === 0) { setError('Aggiungi almeno un componente.'); return; }
    setSaving(true);
    setError('');
    try {
      const catName = categoryId ? (menuCategories.find((c) => c.id === categoryId)?.name ?? categoryName.trim()) : categoryName.trim();

      // If editing a product that originally had a BoM, update it.
      // Otherwise, auto-create a shadow BoM from flat components.
      let finalRecipe = recipe;
      const hasFlatComponents = recipe.some((c) => c.componentType !== 'bom');

      if (hasFlatComponents && (onCreateBomItem || onReplaceBomComponents)) {
        const bomName = name.trim() || 'Prodotto';
        const unit = recipe[0]?.unit || 'kg';

        const apiComponents = recipe
          .filter((c) => {
            // Exclude container ingredients — they're managed separately via the container selector
            if (c.componentType === 'ingredient') {
              const ing = inventory.find((i) => i.id === c.componentId);
              return !ing || ing.isContainer !== 1;
            }
            return true;
          })
          .map((c) => ({
            componentType: c.componentType as 'ingredient' | 'bom' | 'prep',
            componentId: c.componentId,
            quantity: c.quantity,
            unit: c.unit,
          }));

        if (apiComponents.length === 0) {
          throw new Error('Nessun componente valido nella ricetta dopo il filtraggio dei contenitori.');
        }

        let bomId: string | null = null;

        if (isEdit && originalBomId && onReplaceBomComponents) {
          // Update existing BoM with current flat components
          bomId = originalBomId;
          await onReplaceBomComponents(bomId, { components: apiComponents });
        } else if (onCreateBomItem) {
          // Create a new BoM from scratch
          bomId = await onCreateBomItem({
            name: bomName,
            unit,
            yieldQuantity: 1,
            components: apiComponents,
            isContainer: 0,
          });

          if (!bomId) {
            throw new Error('Errore creazione BoM automatico — riprova');
          }
        }

        if (bomId) {
          finalRecipe = [{
            componentType: 'bom',
            componentId: bomId,
            quantity: 1,
            unit,
          }];
        }
      }

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
          await onReplaceRecipe(editItem.id, { recipe: finalRecipe });
        }
      } else {
        await onCreateMenuItem({
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          defaultContainerId: defaultContainerId || null,
          printAreas,
          price: Number(price),
          recipe: finalRecipe,
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

  /** Handle edit/remove of sub-components inside an expanded BoM */
  const handleBomComponentEdit = useCallback(async (
    bomId: string,
    action: 'update' | 'remove',
    payload: { componentType: string; componentId: string; quantity?: number; unit?: string },
  ) => {
    if (!onReplaceBomComponents) return;
    const bom = bomItems.find((b) => b.id === bomId);
    if (!bom) return;

    let updatedComponents: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }> = [...bom.components];
    if (action === 'remove') {
      updatedComponents = updatedComponents.filter(
        (c) => !(c.componentType === payload.componentType && c.componentId === payload.componentId),
      );
    } else if (action === 'update') {
      updatedComponents = updatedComponents.map((c) =>
        c.componentType === payload.componentType && c.componentId === payload.componentId
          ? { ...c, quantity: payload.quantity ?? c.quantity, unit: payload.unit ?? c.unit }
          : c,
      );
    }

    await onReplaceBomComponents(bomId, {
      components: updatedComponents.map((c) => ({
        componentType: c.componentType,
        componentId: c.componentId,
        quantity: c.quantity,
        unit: c.unit,
      })),
    });
  }, [bomItems, onReplaceBomComponents]);

  /** Promote flat recipe components to a reusable BoM */
  const canSaveAsBom = recipe.length >= 2 && !recipe.some((c) => c.componentType === 'bom');

  const handleSaveAsBom = async () => {
    if (!onCreateBomItem || !canSaveAsBom) return;
    const bomName = bomSaveName.trim() || `${name.trim() || 'Composto'} BoM`;
    const unit = bomSaveUnit || 'kg';
    const yieldQuantity = Number(bomSaveYield) || 1;

    setBomSaving(true);
    setError('');
    try {
      const components = recipe
        .filter((c) => {
          if (c.componentType === 'ingredient') {
            const ing = inventory.find((i) => i.id === c.componentId);
            return !ing || ing.isContainer !== 1;
          }
          return true;
        })
        .map((c) => ({
        componentType: c.componentType as 'ingredient' | 'bom' | 'prep',
        componentId: c.componentId,
        quantity: c.quantity,
        unit: c.unit,
      }));

      const bomId = await onCreateBomItem({
        name: bomName,
        unit,
        yieldQuantity,
        components,
        isContainer: 0,
      });

      if (!bomId) {
        throw new Error('BoM creato ma ID non trovato — aggiorna la pagina');
      }

      // Replace all flat components with a single BoM reference using the real ID
      setRecipe([{
        componentType: 'bom',
        componentId: bomId,
        quantity: 1,
        unit: bomSaveUnit || 'kg',
        componentName: bomName,
      }]);

      setShowBomSave(false);
      setBomSaveName('');
      setBomSaveUnit('');
      setBomSaveYield('1');
      // The parent will refresh bomItems on next render
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione BoM');
    } finally {
      setBomSaving(false);
    }
  };

  const dirty = useMemo(() => {
    if (!isEdit || !editItem) return name !== '' || price !== '' || recipe.length > 0;
    // In edit mode, compare against the flattened snapshot (originalResolved)
    const originalRecipe = originalResolved.length > 0 ? originalResolved : editItem.recipe;
    return (
      name !== editItem.name
      || categoryId !== (editItem.categoryId ?? '')
      || defaultContainerId !== (editItem.defaultContainerId ?? '')
      || price !== String(editItem.price)
      || JSON.stringify(printAreas) !== JSON.stringify(editItem.printAreas)
      || JSON.stringify(recipe) !== JSON.stringify(originalRecipe)
      || JSON.stringify(modifiers) !== JSON.stringify(editItem.modifiers)
      || JSON.stringify(modifierGroups) !== JSON.stringify(editItem.modifierGroups)
    );
  }, [isEdit, editItem, name, categoryId, defaultContainerId, price, printAreas, recipe, originalResolved, modifiers, modifierGroups]);

  return (
    <>
      <Modal
        open={open} onClose={onClose}
        title={isEdit ? `Modifica: ${editItem?.name}` : 'Prodotto food'}
        size="lg" dirty={dirty}
        footer={
          <SaveFooter
            onCancel={onClose}
            onSave={() => void handleSave()}
            saving={saving}
            label={isEdit ? 'Salva' : 'Crea prodotto'}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <FormField label="Nome" error={errors.name?.message}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.name)}`} />
            </FormField>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Categoria</label>
              <InlineCategoryPicker
                categories={menuCategories} selectedId={categoryId}
                onSelect={(id) => { setCategoryId(id); const c = menuCategories.find((cat) => cat.id === id); if (c) setCategoryName(c.name); }}
                onCreate={async (n) => { if (onCreateCategory) await onCreateCategory(n, 'menu'); }}
                label=""
              />
            </div>
            <FormField label={isBase ? 'Prezzo base (€)' : 'Prezzo (€)'} error={errors.price?.message}>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Prezzo" inputMode="decimal" min="0.01" step="0.10" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.price)}`} />
            </FormField>
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

          {/* BASE product toggle */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-bg/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBase}
                onChange={(e) => setIsBase(e.target.checked)}
                className="w-4 h-4 rounded accent-accent"
              />
              <div>
                <span className="text-sm font-medium text-primary">Prodotto BASE</span>
                <p className="text-[10px] text-text-muted">
                  Prezzo fisso senza componenti obbligatori. Aggiungi ingredienti solo se necessario.
                </p>
              </div>
            </label>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
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
              onBomComponentEdit={handleBomComponentEdit}
              onOpenBomTab={onOpenBomTab}
              conversionsMap={conversionsMap}
            />

            {/* Save as BoM — show only when no original BoM exists (create mode) */}
            {canSaveAsBom && onCreateBomItem && !showBomSave && !(isEdit && originalBomId) && (
              <div className="border-t border-dashed border-border pt-2 mt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBomSaveName(`${name.trim() || 'Composto'} BoM`);
                    setBomSaveUnit(recipe[0]?.unit || 'kg');
                    setBomSaveYield('1');
                    setShowBomSave(true);
                  }}
                  size="sm"
                >
                  <Layers size={14} />
                  Salva come BoM riutilizzabile
                </Button>
              </div>
            )}

            {showBomSave && (
              <div className="border border-accent/40 bg-accent/5 rounded-lg p-3 space-y-2 mt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                  <Layers size={12} />
                  Crea nuovo elemento composto
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">Nome BoM</label>
                    <input
                      value={bomSaveName}
                      onChange={(e) => setBomSaveName(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-border text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">Unità</label>
                    <input
                      value={bomSaveUnit}
                      onChange={(e) => setBomSaveUnit(e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-border text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">Resa</label>
                    <input
                      type="number"
                      value={bomSaveYield}
                      onChange={(e) => setBomSaveYield(e.target.value.replace(/[^0-9.]/g, ''))}
                      className="w-full px-2 py-1.5 rounded border border-border text-xs"
                      min="0.01"
                      step="0.1"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleSaveAsBom()}
                    disabled={bomSaving || !bomSaveName.trim()}
                  >
                    {bomSaving ? <RefreshCw size={12} className="animate-spin" /> : <Layers size={12} />}
                    {bomSaving ? 'Creazione...' : 'Crea BoM'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowBomSave(false)}
                  >
                    Annulla
                  </Button>
                  <p className="text-[9px] text-text-muted ml-auto">
                    Sostituirà i {recipe.length} componenti con un BoM
                  </p>
                </div>
              </div>
            )}
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
        conversionsMap={conversionsMap}
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
        conversionsMap={conversionsMap}
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
