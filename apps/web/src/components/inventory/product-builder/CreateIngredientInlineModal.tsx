import { useState, useMemo } from 'react';
import type { Category, Ingredient, IngredientCreateRequest, CanonicalUnit } from '@gustopos/shared';
import Modal from '../../../shared/ui/molecules/Modal';
import SaveFooter from '../../../shared/ui/molecules/SaveFooter';
import SearchableSelect from '../../../shared/ui/molecules/SearchableSelect';
import UnitSelect from '../../../shared/ui/molecules/UnitSelect';
import Field from '../../../shared/ui/atoms/Field';
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
  open, onClose, onSuccess, categories, onCreateCategory: _onCreateCategory, onCreate,
}: CreateIngredientInlineModalProps) {
  const ingredientCategories = useMemo(() => categories.filter((c) => !c.scope || c.scope === 'ingredient'), [categories]);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<CanonicalUnit>('kg');
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
        <SaveFooter
          onCancel={handleClose}
          onSave={() => void handleSave()}
          saving={saving}
          label="Crea ingrediente"
        />
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome" error={errors.name?.message}>
          {(props) => (
            <input
              id={props.id}
              aria-describedby={errors.name?.message ? props.errorId : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome ingrediente"
              className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(errors.name)}`}
            />
          )}
        </Field>
        <Field label="Categoria">
          {(props) => (
            <SearchableSelect
              id={props.id}
              ariaLabel="Categoria"
              items={ingredientCategories}
              getLabel={(c) => c.name}
              getValue={(c) => c.id}
              selectedValue={categoryId}
              onSelect={setCategoryId}
              placeholder="Seleziona categoria..."
            />
          )}
        </Field>
        <Field label="Quantità" error={errors.qty?.message}>
          {(props) => (
            <input
              id={props.id}
              aria-describedby={errors.qty?.message ? props.errorId : undefined}
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Quantità"
              inputMode="decimal"
              className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(errors.qty)}`}
            />
          )}
        </Field>
        <Field label="Unità">
          {(props) => (
            <UnitSelect
              id={props.id}
              ariaLabel="Unità"
              value={unit}
              onChange={(value) => setUnit(value as CanonicalUnit)}
              placeholder="Seleziona unità..."
            />
          )}
        </Field>
        <Field label="Soglia minima">
          {(props) => (
            <input
              id={props.id}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Soglia minima"
              inputMode="decimal"
              className="w-full px-3 py-2 rounded border border-border text-sm"
            />
          )}
        </Field>
        <Field label="Costo unità (€)">
          {(props) => (
            <input
              id={props.id}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Costo unità"
              inputMode="decimal"
              className="w-full px-3 py-2 rounded border border-border text-sm"
            />
          )}
        </Field>
        <Field label="Prezzo vendita (€)">
          {(props) => (
            <input
              id={props.id}
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Prezzo vendita"
              inputMode="decimal"
              className="w-full px-3 py-2 rounded border border-border text-sm"
            />
          )}
        </Field>
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
