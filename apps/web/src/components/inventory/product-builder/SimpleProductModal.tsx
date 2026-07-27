import { useState, useMemo, useEffect } from 'react';
import type { Category, Ingredient, MenuItemAdmin, MenuItemCreateRequest, MenuItemUpdateRequest, PrintArea, ModifierGroup, CategoryModifierPool } from '@gustopos/shared';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';
import InlineCategoryPicker from '../InlineCategoryPicker';
import ModifierGroupsEditor from '../ModifierGroupsEditor';
import { required, minLength, positiveNumber, getErrorClass, type ValidationErrors } from '../../../shared/ui/hooks/useFieldValidation';

const PRINT_AREA_LABELS: Record<string, string> = { kitchen: 'Cucina', bar: 'Bar', cashier: 'Cassa' };

interface SimpleProductModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
  inventory: Ingredient[];
  categoryModifierPools?: CategoryModifierPool[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreate: (payload: MenuItemCreateRequest) => Promise<void>;
  onUpdate?: (id: string, payload: MenuItemUpdateRequest) => Promise<void>;
  editItem?: MenuItemAdmin | null;
}

export default function SimpleProductModal({
  open, onClose, onSuccess, categories, inventory, categoryModifierPools = [], onCreateCategory, onCreate, onUpdate, editItem,
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
          defaultContainerId: editItem.defaultContainerId ?? null,
          price: priceNum,
          printAreas,
          modifierGroups,
        });
      } else {
        await onCreate({
          name: name.trim(),
          category: catName,
          categoryId: categoryId || undefined,
          defaultContainerId: null,
          printAreas,
          price: priceNum,
          recipe: [],
          modifiers: [],
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Modifica: ${editItem?.name}` : 'Prodotto semplice'}
      size="md"
      dirty={dirty}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Salvataggio...' : isEdit ? 'Salva' : 'Crea prodotto'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome prodotto" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.name)}`} />
            {errors.name && <p className="text-[9px] text-danger mt-0.5">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Categoria</label>
            <InlineCategoryPicker
              categories={menuCategories}
              selectedId={categoryId}
              onSelect={(id) => { setCategoryId(id); const c = menuCategories.find((cat) => cat.id === id); if (c) setCategoryName(c.name); }}
              onCreate={async (n) => { if (onCreateCategory) await onCreateCategory(n, 'menu'); }}
              label=""
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Prezzo (€)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Prezzo di vendita" inputMode="decimal" min="0.01" step="0.10" className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(errors.price)}`} />
            {errors.price && <p className="text-[9px] text-danger mt-0.5">{errors.price.message}</p>}
          </div>
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
            onChange={setModifierGroups}
            categoryPools={categoryId ? categoryModifierPools.filter((p) => p.categoryIds?.includes(categoryId) || p.categoryId === categoryId) : []}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
