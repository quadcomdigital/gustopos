import { useState, useMemo, useEffect } from 'react';
import type { Category, Ingredient, PrepItem, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest, CanonicalCreateMenuProductRequest, PrintArea, ModifierGroup, CategoryModifierPool } from '@gustopos/shared';
import Modal from '../../../shared/ui/molecules/Modal';
import SaveFooter from '../../../shared/ui/molecules/SaveFooter';
import InlineCategoryPicker from '../InlineCategoryPicker';
import ModifierGroupsEditor from '../ModifierGroupsEditor';
import FormField from '../../../shared/ui/molecules/FormField';
import { required, minLength, positiveNumber, getErrorClass, type ValidationErrors } from '../../../shared/ui/hooks/useFieldValidation';

const PRINT_AREA_LABELS: Record<string, string> = { kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' };

interface SimpleProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  inventory: Ingredient[];
  prepItems?: PrepItem[];
  bomItems?: import('@gustopos/shared').BomItem[];
  categoryModifierPools?: CategoryModifierPool[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreate?: (payload: MenuItemCreateRequest) => Promise<void>;
  onCreateMenuProduct?: (payload: CanonicalCreateMenuProductRequest) => Promise<void>;
  onUpdate?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  editItem?: MenuItemAdmin | null;
}

export default function SimpleProductModal({
  open, onClose, onSuccess, categories, inventory, prepItems = [], bomItems = [], categoryModifierPools = [], onCreateCategory, onCreate, onCreateMenuProduct, onUpdate, editItem,
}: SimpleProductModalProps) {
  const isEdit = !!editItem;
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [price, setPrice] = useState('');
  const [printAreas, setPrintAreas] = useState<PrintArea[]>(['kitchen']);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');

  const menuCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'menu'), [categories]);

  useEffect(() => {
    if (editItem && open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] initializes form fields from editItem prop on modal open
      setName(editItem.name);
      setCategoryId(editItem.categoryId ?? '');
      setCategoryName(editItem.category);
      setPrice(String(editItem.price));
      setPrintAreas(editItem.printAreas?.length ? editItem.printAreas : ['kitchen']);
      setModifierGroups(editItem.modifierGroups ?? []);
    } else if (!open) {
      setName('');
      setCategoryId('');
      setCategoryName('');
      setPrice('');
      setPrintAreas(['kitchen']);
      setModifierGroups([]);
      setErrors({});
      setError('');
    }
  }, [editItem, open]);

  const dirty = useMemo(() => {
    if (!isEdit || !editItem) return name !== '' || price !== '' || categoryId !== '' || printAreas.length !== 1;
    return (
      name !== editItem.name
      || categoryId !== (editItem.categoryId ?? '')
      || price !== String(editItem.price)
      || JSON.stringify(printAreas) !== JSON.stringify(editItem.printAreas)
      || JSON.stringify(modifierGroups) !== JSON.stringify(editItem.modifierGroups)
    );
  }, [isEdit, editItem, name, categoryId, price, printAreas, modifierGroups]);

  const handleSave = async () => {
    const errs: ValidationErrors = {};
    errs.name = required(name, 'Nome') ?? minLength(name, 2, 'Nome');
    errs.price = positiveNumber(price, 'Prezzo');
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    setError('');
    try {
      const priceNum = Number(price);
      const catName = categoryId ? (menuCategories.find((c) => c.id === categoryId)?.name ?? categoryName.trim()) : categoryName.trim();
      if (isEdit && onUpdate && editItem) {
        await onUpdate(editItem.id, {
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          price: priceNum,
          printAreas,
          modifierGroups,
        });
      } else if (onCreateMenuProduct) {
        if (!catName || catName.trim().length < 2) {
          throw new Error('Seleziona o crea una categoria per il prodotto.');
        }
        await onCreateMenuProduct({
          name: name.trim(),
          price: priceNum,
          category: catName.trim(),
          categoryId: categoryId || undefined,
          printAreas,
          components: [],
          inlineIngredients: [],
          inlinePreps: [],
          modifierGroups,
        });
      } else if (onCreate) {
        await onCreate({
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          printAreas,
          price: priceNum,
          recipe: [],
          modifiers: [],
          modifierGroups,
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
      open={open}
      onClose={onClose}
      title={isEdit ? `Modifica: ${editItem?.name}` : 'Prodotto semplice'}
      size="md"
      dirty={dirty}
      footer={
        <SaveFooter
          onCancel={onClose}
          onSave={() => void handleSave()}
          saving={saving}
          label={isEdit ? 'Salva' : 'Crea prodotto'}
        />
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <FormField label="Nome" error={errors.name?.message}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.name)}`} />
          </FormField>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">Categoria</label>
            <InlineCategoryPicker
              categories={menuCategories}
              selectedId={categoryId}
              onSelect={(id) => { setCategoryId(id); const c = menuCategories.find((cat) => cat.id === id); if (c) setCategoryName(c.name); }}
              onCreate={async (n) => { if (onCreateCategory) await onCreateCategory(n, 'menu'); }}
              label=""
            />
          </div>
          <FormField label="Prezzo (€)" error={errors.price?.message}>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Prezzo di vendita" inputMode="decimal" min="0.01" step="0.10" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.price)}`} />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['kitchen', 'bar', 'cashier'] as const).map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setPrintAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area])}
              className={`px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${printAreas.includes(area) ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'}`}
            >
              stampa {PRINT_AREA_LABELS[area]}
            </button>
          ))}
        </div>

        <div className="border-t border-border pt-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-2">Modificatori</label>
          <ModifierGroupsEditor
            value={modifierGroups}
            inventory={inventory}
            prepItems={prepItems}
            bomItems={bomItems}
            onChange={setModifierGroups}
            categoryPools={categoryId ? categoryModifierPools.filter((p) => p.categoryIds?.includes(categoryId) || p.categoryId === categoryId) : []}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
