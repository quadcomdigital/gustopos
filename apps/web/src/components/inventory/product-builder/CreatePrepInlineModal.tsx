import { useState, useMemo, useEffect } from 'react';
import type { Ingredient, PrepItem, UnitConversion } from '@gustopos/shared';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import SaveFooter from '../../../shared/ui/molecules/SaveFooter';
import Button from '../../../shared/ui/atoms/Button';
import SearchableSelect from '../../../shared/ui/molecules/SearchableSelect';
import UnitSelect from '../../../shared/ui/molecules/UnitSelect';
import UnitConversionManager from '../../inventory/UnitConversionManager';
import { fetchUnitConversions, createUnitConversion, deleteUnitConversion } from '../../../shared/api/client';

interface PrepVariant {
  id: string;
  name: string;
  quantityPerUnit: string;
  unit: string;
}

interface CreatePrepInlineModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (prepItems: PrepItem[]) => void;
  inventory: Ingredient[];
  onCreate: (payload: { ingredientId: string; name: string; quantityPerUnit: number; unit: string }) => Promise<PrepItem>;
}

let variantCounter = 0;

export default function CreatePrepInlineModal({
  open, onClose, onSuccess, inventory, onCreate,
}: CreatePrepInlineModalProps) {
  const [ingredientId, setIngredientId] = useState('');
  const [variants, setVariants] = useState<PrepVariant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conversions, setConversions] = useState<UnitConversion[]>([]);

  const selectedIngredient = useMemo(() => inventory.find((i) => i.id === ingredientId), [inventory, ingredientId]);

  useEffect(() => {
    if (!ingredientId) { setConversions([]); return; } // eslint-disable-line react-hooks/set-state-in-effect -- [async-fetch] resets conversions on ingredient change; setter receives constant primitive
    fetchUnitConversions(ingredientId)
      .then(setConversions)  
      .catch(() => setConversions([]));  
  }, [ingredientId]);

  const handleCreateConversion = async (fromUnit: string, factor: number) => {
    if (!ingredientId || !selectedIngredient) return;
    await createUnitConversion(ingredientId, { fromUnit, toUnit: selectedIngredient.unit, factor });
    const convs = await fetchUnitConversions(ingredientId);
    setConversions(convs);
  };

  const handleDeleteConversion = async (conversionId: string) => {
    if (!ingredientId) return;
    await deleteUnitConversion(ingredientId, conversionId);
    const convs = await fetchUnitConversions(ingredientId);
    setConversions(convs);
  };

  const handleClose = () => {
    setIngredientId('');
    setVariants([]);
    setSaving(false);
    setError('');
    setConversions([]);
    onClose();
  };

  const addVariant = () => {
    const ingName = selectedIngredient?.name ?? '';
    variantCounter++;
    setVariants((prev) => [
      ...prev,
      { id: `v_${Date.now()}_${variantCounter}`, name: `${ingName} ${prev.length + 1}`, quantityPerUnit: '', unit: selectedIngredient?.unit ?? 'g' },
    ]);
  };

  const updateVariant = (id: string, field: keyof PrepVariant, value: string) => {
    setVariants((prev) => prev.map((v) => v.id === id ? { ...v, [field]: value } : v));
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSave = async () => {
    if (!ingredientId || variants.length === 0 || !selectedIngredient) return;
    setSaving(true);
    setError('');
    try {
      const results: PrepItem[] = [];
      for (const v of variants) {
        const qty = Number(v.quantityPerUnit);
        if (!v.name.trim() || !qty || qty <= 0) continue;
        let finalQty = qty;
        let finalUnit = v.unit;
        if (v.unit !== selectedIngredient.unit) {
          const conv = conversions.find((c) => c.fromUnit === v.unit);
          if (!conv) {
            setError(`Nessuna conversione definita per "${v.unit}" → "${selectedIngredient.unit}"`);
            setSaving(false);
            return;
          }
          finalQty = qty * conv.factor;
          finalUnit = selectedIngredient.unit;
        }
        const item = await onCreate({ ingredientId, name: v.name.trim(), quantityPerUnit: finalQty, unit: finalUnit });
        results.push(item);
      }
      setSaving(false);
      onSuccess(results);
      handleClose();
    } catch (e: any) {
      setSaving(false);
      setError(e?.message ?? 'Errore durante la creazione');
    }
  };

  const canSave = ingredientId && variants.length > 0 && variants.every((v) => v.name.trim() && Number(v.quantityPerUnit) > 0);

  return (
    <Modal open={open} onClose={handleClose} title="Crea prep" size="md"
      footer={
        <SaveFooter
          onCancel={handleClose}
          onSave={() => void handleSave()}
          saving={saving}
          disabled={!canSave}
          label={`Crea ${variants.length > 0 ? variants.length : ''} prep`}
          loadingLabel="Creazione..."
        />
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Ingrediente base</label>
          <SearchableSelect
            items={inventory.filter((i) => i.isActive && i.isContainer !== 1)}
            getLabel={(i) => `${i.name} — ${i.quantity} ${i.unit}`}
            getValue={(i) => i.id}
            selectedValue={ingredientId}
            onSelect={(id) => { setIngredientId(id); setVariants([]); }}
            placeholder="Seleziona ingrediente..."
          />
        </div>

        {ingredientId && selectedIngredient && (
          <>
            <div className="bg-bg rounded-lg border border-border p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">Ingrediente selezionato</p>
              <p className="text-sm font-medium text-primary">{selectedIngredient.name}</p>
              <p className="text-xs text-text-muted">Stock: {selectedIngredient.quantity} {selectedIngredient.unit} | Costo: €{(selectedIngredient.unitCost ?? 0).toFixed(2)}/{selectedIngredient.unit}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Varianti</label>
                <Button variant="secondary" onClick={addVariant}>
                  <Plus size={14} />
                  Aggiungi variante
                </Button>
              </div>

              {variants.map((v) => (
                <div key={v.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded border border-border bg-white">
                  <input
                    value={v.name}
                    onChange={(e) => updateVariant(v.id, 'name', e.target.value)}
                    placeholder="Nome variante"
                    className="w-full sm:flex-1 px-2 py-1.5 rounded border border-border text-sm"
                  />
                  <input
                    type="number"
                    value={v.quantityPerUnit}
                    onChange={(e) => updateVariant(v.id, 'quantityPerUnit', e.target.value)}
                    placeholder="Qtà"
                    className="w-20 px-2 py-1.5 rounded border border-border text-sm text-right"
                    min="0.001"
                    step="0.001"
                  />
                  <div className="w-full sm:w-24">
                    <UnitSelect value={v.unit} onChange={(u) => updateVariant(v.id, 'unit', u)} placeholder="Unità" />
                  </div>
                  <button type="button" onClick={() => removeVariant(v.id)} className="p-2 text-text-muted hover:text-danger shrink-0" aria-label="Rimuovi variante">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {variants.length === 0 && (
                <p className="text-xs text-text-muted text-center py-4">Clicca "Aggiungi variante" per iniziare</p>
              )}
            </div>

            <UnitConversionManager
              ingredientName={selectedIngredient.name}
              ingredientUnit={selectedIngredient.unit}
              conversions={conversions}
              onCreateConversion={(fromUnit, factor) => handleCreateConversion(fromUnit, factor)}
              onDeleteConversion={(conversionId) => handleDeleteConversion(conversionId)}
            />
          </>
        )}
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </Modal>
  );
}
