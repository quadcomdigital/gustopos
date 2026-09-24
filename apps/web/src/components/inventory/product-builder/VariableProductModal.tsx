import { useState, useMemo, useEffect } from 'react';
import type { Category, Ingredient, BomItem, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest, CanonicalCreateMenuProductRequest, ModifierGroup, CategoryModifierPool } from '@gustopos/shared';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import { usePrintStations } from '../usePrintStations';
import { useProductionReferences } from '../useProductionReferences';
import SaveFooter from '../../../shared/ui/molecules/SaveFooter';
import Button from '../../../shared/ui/atoms/Button';
import SearchableSelect from '../../../shared/ui/molecules/SearchableSelect';
import InlineCategoryPicker from '../InlineCategoryPicker';
import ModifierGroupsEditor from '../ModifierGroupsEditor';
import FormField from '../../../shared/ui/molecules/FormField';
import { required, minLength, getErrorClass, type ValidationErrors } from '../../../shared/ui/hooks/useFieldValidation';


interface Variant {
  id: string;
  name: string;
  price: string;
  ingredientId: string;
  quantity: string;
  unit: string;
}

interface VariableProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  categoryModifierPools?: CategoryModifierPool[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreateMenuItem?: (payload: MenuItemCreateRequest) => Promise<void>;
  onCreateMenuProduct?: (payload: CanonicalCreateMenuProductRequest) => Promise<void>;
  onUpdateMenuItem?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  editItem?: MenuItemAdmin | null;
}

let variantSeq = 0;

export default function VariableProductModal({
  open, onClose, onSuccess, categories, inventory, bomItems: _bomItems, categoryModifierPools = [], onCreateCategory, onCreateMenuItem, onCreateMenuProduct, onUpdateMenuItem, editItem,
}: VariableProductModalProps) {
  const isEdit = !!editItem;
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [stationId, setStationId] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [additionalModifierGroups, setAdditionalModifierGroups] = useState<ModifierGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');

  const { stations } = usePrintStations();
  const { references } = useProductionReferences();
  const activeReferences = references.filter((r) => r.isActive);
  const menuCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'menu'), [categories]);
  const rawIngredients = useMemo(() => inventory.filter((i) => i.isActive).map((i) => ({ id: i.id, name: i.name, unit: i.unit })), [inventory]);

  useEffect(() => {
    if (editItem && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] initializes form fields from editItem prop on modal open
      setName(editItem.name);
      setCategoryId(editItem.categoryId ?? '');
      setCategoryName(editItem.category);
      setStationId(editItem.stationId ?? '');
      setReferenceId(editItem.referenceId ?? '');
      const additional = (editItem.modifierGroups ?? []).filter((g) => g.name !== 'Formato');
      setAdditionalModifierGroups(additional);
    } else if (!open) {
      setName(''); setCategoryId(''); setCategoryName(''); setStationId(''); setReferenceId(''); setVariants([]); setAdditionalModifierGroups([]); setErrors({}); setError('');
    }
  }, [editItem, open]);

  const addVariant = () => {
    variantSeq++;
    setVariants((prev) => [...prev, { id: `var_${Date.now()}_${variantSeq}`, name: '', price: '', ingredientId: '', quantity: '', unit: 'g' }]);
  };

  const updateVariant = (id: string, field: keyof Variant, value: string) => {
    setVariants((prev) => prev.map((v) => v.id === id ? { ...v, [field]: value } : v));
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSave = async () => {
    const errs: ValidationErrors = {};
    errs.name = required(name, 'Nome') ?? minLength(name, 2, 'Nome');
    errs.price = variants.length === 0 ? required('1', 'Aggiungi almeno una variante') : undefined;
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    if (variants.length === 0) { setError('Aggiungi almeno una variante.'); return; }
    for (const v of variants) {
      if (!v.name.trim() || !v.price || !v.ingredientId || !v.quantity) {
        setError('Compila tutti i campi delle varianti.'); return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const catName = categoryId ? (menuCategories.find((c) => c.id === categoryId)?.name ?? categoryName.trim()) : categoryName.trim();

      const modifierGroup = {
        name: 'Formato',
        required: true,
        minSelections: 1,
        maxSelections: 1,
        multiSelectPriceMode: 'max' as const,
        sortOrder: 0,
        options: variants.map((v, idx) => ({
          name: v.name.trim(),
          componentType: 'ingredient' as const,
          componentId: v.ingredientId,
          quantity: 1,
          unit: 'pz' as const,
          priceDelta: Number(v.price),
          isDefault: idx === 0,
          isActive: true,
          sortOrder: idx,
          ingredientOverrides: [],
        })),
      };

      const allModifierGroups = [modifierGroup, ...additionalModifierGroups];

      if (isEdit && onUpdateMenuItem && editItem) {
        await onUpdateMenuItem(editItem.id, {
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          stationId: stationId || undefined,
          referenceId: referenceId || undefined,
          printAreas: [],
          modifierGroups: allModifierGroups,
        });
      } else if (onCreateMenuProduct) {
        if (!catName || catName.trim().length < 2) {
          throw new Error('Seleziona o crea una categoria per il prodotto.');
        }
        await onCreateMenuProduct({
          name: name.trim(),
          price: 0,
          category: catName.trim(),
          categoryId: categoryId || undefined,
          stationId: stationId || undefined,
          referenceId: referenceId || undefined,
          printAreas: [],
          components: [],
          inlineIngredients: [],
          inlinePreps: [],
          modifierGroups: allModifierGroups,
        });
      } else if (onCreateMenuItem) {
        await onCreateMenuItem({
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          stationId: stationId || undefined,
          referenceId: referenceId || undefined,
          printAreas: [],
          price: 0,
          recipe: [],
          modifiers: [],
          modifierGroups: allModifierGroups,
        });
      } else {
        throw new Error('Nessun canale di creazione disponibile.');
      }
      setSaving(false);
      onSuccess();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? 'Errore durante il salvataggio');
    }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title={isEdit ? `Modifica: ${editItem?.name}` : 'Prodotto variabile'}
      size="lg" dirty={!!name || variants.length > 0} zIndex={1200}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Stazione di stampa</label>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="px-3 py-2 rounded border border-border text-sm w-full min-h-[44px] bg-white"
          >
            <option value="">Stazione predefinita (dalla categoria)</option>
            {stations.filter((s) => s.isActive && s.kind !== 'cashier').map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (predefinita)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Referenza conteggio (contenitore)</label>
          <select value={referenceId} onChange={(e) => setReferenceId(e.target.value)} className="px-3 py-2 rounded border border-border text-sm w-full min-h-[44px] bg-white">
            <option value="">Nessuna (eredita dalla categoria)</option>
            {activeReferences.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
          </select>
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Varianti</label>
            <Button variant="secondary" onClick={addVariant}><Plus size={14} /> Aggiungi variante</Button>
          </div>

          {variants.map((v) => (
            <div key={v.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-stretch sm:items-center p-2 rounded border border-border bg-white mb-1.5">
              <input value={v.name} onChange={(e) => updateVariant(v.id, 'name', e.target.value)} placeholder="Es. 33cl" className="w-full min-w-0 px-2 py-1.5 rounded border border-border text-sm" />
              <input value={v.price} onChange={(e) => updateVariant(v.id, 'price', e.target.value.replace(/[^0-9.-]/g, ''))} placeholder="Prezzo €" inputMode="decimal" className="w-full min-w-0 px-2 py-1.5 rounded border border-border text-sm text-right" />
              <div className="min-w-0 w-full">
                <SearchableSelect items={rawIngredients} getLabel={(i) => i.name} getValue={(i) => i.id} selectedValue={v.ingredientId} onSelect={(id) => { updateVariant(v.id, 'ingredientId', id); const ing = rawIngredients.find((i) => i.id === id); if (ing) updateVariant(v.id, 'unit', ing.unit); }} placeholder="Ingrediente" />
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" value={v.quantity} onChange={(e) => updateVariant(v.id, 'quantity', e.target.value)} placeholder="Qtà" className="w-full min-w-0 flex-1 sm:flex-none sm:w-16 px-2 py-1.5 rounded border border-border text-sm text-right" min="0.001" />
                <span className="text-[10px] text-text-muted shrink-0">{v.unit}</span>
                <button type="button" onClick={() => removeVariant(v.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-text-muted hover:text-danger hover:bg-danger-50 rounded shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1" aria-label="Rimuovi variante"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}

          {variants.length === 0 && <p className="text-xs text-text-muted text-center py-4">Aggiungi varianti per definire i formati</p>}
          {errors.price && <p className="text-[9px] text-danger mt-1">{errors.price.message}</p>}
        </div>

        <div className="border-t border-border pt-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2">Modificatori aggiuntivi</label>
          <ModifierGroupsEditor
            value={additionalModifierGroups}
            inventory={inventory}
            bomItems={_bomItems}
            onChange={setAdditionalModifierGroups}
            categoryPools={categoryId ? categoryModifierPools.filter((p) => p.categoryIds?.includes(categoryId) || p.categoryId === categoryId) : []}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
