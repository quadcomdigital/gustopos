import { useState, useMemo } from 'react';
import type { Category, Ingredient, IngredientCreateRequest } from '@gustopos/shared';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';
import SearchableSelect from '../../../shared/ui/molecules/SearchableSelect';
import UnitSelect from '../../../shared/ui/molecules/UnitSelect';
import { required, minLength, positiveNumber, getErrorClass, type ValidationErrors } from '../../../shared/ui/hooks/useFieldValidation';

interface CreateIngredientInlineModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (ingredient: Ingredient) => void;
  categories: Category[];
  onCreateCategory?: (name: string, scope: Category['scope']) => Promise<void>;
  onCreate: (payload: IngredientCreateRequest) => Promise<Ingredient>;
}

export default function CreateIngredientInlineModal({
  open, onClose, onSuccess, categories, onCreateCategory, onCreate,
}: CreateIngredientInlineModalProps) {
  const ingredientCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'ingredient'), [categories]);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [threshold, setThreshold] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [isContainer, setIsContainer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [error, setError] = useState('');

  const handleClose = () => {
    setName('');
    setCategoryId('');
    setQty('');
    setUnit('kg');
    setThreshold('');
    setUnitCost('');
    setSalePrice('');
    setIsContainer(false);
    setErrors({});
    setError('');
    onClose();
  };

  const handleSave = async () => {
    const errs: ValidationErrors = {};
    errs.name = required(name, 'Nome') ?? minLength(name, 2, 'Nome');
    errs.qty = positiveNumber(qty, 'Quantità');
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSaving(true);
    setError('');
    try {
      const result = await onCreate({
        name: name.trim(),
        categoryId: categoryId || undefined,
        quantity: Number(qty),
        unit,
        minThreshold: threshold ? Number(threshold) : 0,
        unitCost: unitCost ? Number(unitCost) : 0,
        salePrice: salePrice ? Number(salePrice) : undefined,
        isContainer: isContainer ? 1 : 0,
      });
      setSaving(false);
      onSuccess(result);
      handleClose();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? 'Errore durante la creazione');
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nuovo ingrediente" size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Annulla</Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>Crea ingrediente</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome ingrediente" className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(errors.name)}`} />
          {errors.name && <p className="text-[9px] text-danger mt-0.5">{errors.name.message}</p>}
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Categoria</label>
          <SearchableSelect
            items={ingredientCategories}
            getLabel={(c) => c.name}
            getValue={(c) => c.id}
            selectedValue={categoryId}
            onSelect={setCategoryId}
            placeholder="Seleziona categoria..."
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Quantità</label>
          <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Quantità" inputMode="decimal" className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(errors.qty)}`} />
          {errors.qty && <p className="text-[9px] text-danger mt-0.5">{errors.qty.message}</p>}
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Unità</label>
          <UnitSelect value={unit} onChange={setUnit} placeholder="Seleziona unità..." />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Soglia minima</label>
          <input value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Soglia minima" inputMode="decimal" className="w-full px-3 py-2 rounded border border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Costo unità (€)</label>
          <input value={unitCost} onChange={(e) => setUnitCost(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Costo unità" inputMode="decimal" className="w-full px-3 py-2 rounded border border-border text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Prezzo vendita (€)</label>
          <input value={salePrice} onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Prezzo vendita" inputMode="decimal" className="w-full px-3 py-2 rounded border border-border text-sm" />
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2 px-3 py-2 rounded border border-border text-xs font-bold cursor-pointer select-none">
            <input type="checkbox" checked={isContainer} onChange={(e) => setIsContainer(e.target.checked)} className="accent-accent" />
            Contenitore (packaging)
          </label>
        </div>
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </Modal>
  );
}
