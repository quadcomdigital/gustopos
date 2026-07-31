import { useState, useEffect, useMemo, useId } from 'react';
import type { PrepItem, Ingredient, UnitConversion } from '@gustopos/shared';
import { ChefHat, Loader2, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import Button from '../../shared/ui/atoms/Button';
import Field from '../../shared/ui/atoms/Field';
import Modal from '../../shared/ui/molecules/Modal';
import SaveFooter from '../../shared/ui/molecules/SaveFooter';
import ToastContainer from '../../shared/ui/molecules/Toast';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import UnitSelect from '../../shared/ui/molecules/UnitSelect';
import ConfirmDialog from '../ConfirmDialog';
import UnitConversionManager from './UnitConversionManager';
import { useToast } from '../../shared/ui/hooks/useToast';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import {
  createPrepItem,
  updatePrepItem,
  deletePrepItem,
  preparePrepItem,
  fetchUnitConversions,
  createUnitConversion,
} from '../../shared/api/client';

interface PrepViewProps {
  inventory: Ingredient[];
  prepItems: PrepItem[];
  onRefresh?: () => Promise<void>;
  initialIngredientId?: string | null;
  onClearInitial?: () => void;
}

export default function PrepView({ inventory, prepItems, onRefresh, initialIngredientId, onClearInitial }: PrepViewProps) {
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const searchId = useId();
  const prepareQtyId = (id: string) => `prep-qty-${id}`;
  const [searchTerm, setSearchTerm] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [preparingId, setPreparingId] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createIngredientId, setCreateIngredientId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createQtyPerUnit, setCreateQtyPerUnit] = useState('');
  const [createUnit, setCreateUnit] = useState('');
  const [createConversions, setCreateConversions] = useState<UnitConversion[]>([]);
  const [creating, setCreating] = useState(false);



  // Edit modal state
  const [editingItem, setEditingItem] = useState<PrepItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQtyPerUnit, setEditQtyPerUnit] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [saving, setSaving] = useState(false);

  const { confirm, requestConfirm, handleConfirm, handleCancel } = useConfirm();

  // Handle navigation from Ingredients tab (Crea Variante)
  /* eslint-disable react-hooks/exhaustive-deps -- [prop-callback] handleCreateIngredientSelect + onClearInitial are prop callbacks recreated each render by parent; intentionally omitted to avoid retrigger loop on identity churn */
  useEffect(() => {
    if (initialIngredientId && inventory.find((i) => i.id === initialIngredientId)) {
      void handleCreateIngredientSelect(initialIngredientId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] showCreateModal set in effect triggered by initialIngredientId prop; safe because setter receives constant primitive
      setShowCreateModal(true);
      onClearInitial?.();
    }
  }, [initialIngredientId, inventory]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Group items by ingredient
  const groupedItems = useMemo(() => {
    const filtered = searchTerm
      ? prepItems.filter((item) => {
          const ing = inventory.find((i) => i.id === item.ingredientId);
          return ing?.name.toLowerCase().includes(searchTerm.toLowerCase());
        })
      : prepItems;

    const groups: Record<string, { ingredient: Ingredient; items: PrepItem[] }> = {};
    for (const item of filtered) {
      const ing = inventory.find((i) => i.id === item.ingredientId);
      if (!ing) continue;
      if (!groups[item.ingredientId]) {
        groups[item.ingredientId] = { ingredient: ing, items: [] };
      }
      groups[item.ingredientId].items.push(item);
    }
    return Object.values(groups);
  }, [prepItems, inventory, searchTerm]);

  const handlePrepare = async (id: string) => {
    const qty = Number(quantities[id] || '0');
    if (!qty || qty <= 0) return;
    setPreparingId(id);
    try {
      const res = await preparePrepItem(id, qty);
      showToast(`${res.name}: stock ${res.previousStock.toFixed(2)} → ${res.newStock.toFixed(2)}`, { type: 'success', duration: 4000 });
      setQuantities((prev) => ({ ...prev, [id]: '' }));
      await onRefresh?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Preparazione fallita', { type: 'error', duration: 5000 });
    } finally {
      setPreparingId(null);
    }
  };

  const handleCreateIngredientSelect = async (ingredientId: string) => {
    setCreateIngredientId(ingredientId);
    setCreateConversions([]);
    setCreateUnit('');
    if (ingredientId) {
      try {
        const convs = await fetchUnitConversions(ingredientId);
        setCreateConversions(convs);
      } catch {
        setCreateConversions([]);
      }
    }
  };

  const handleCreate = async () => {
    const qtyPerUnit = Number(createQtyPerUnit);
    if (!createIngredientId || !createName.trim() || !qtyPerUnit || qtyPerUnit <= 0 || !createUnit) return;
    const ing = inventory.find((i) => i.id === createIngredientId);
    if (!ing) return;
    let finalQty = qtyPerUnit;
    let finalUnit = createUnit;
    if (createUnit !== ing.unit) {
      const conv = createConversions.find((c) => c.fromUnit === createUnit);
      if (!conv) {
        showToast(`Nessuna conversione definita per "${createUnit}" → "${ing.unit}"`, { type: 'error', duration: 5000 });
        return;
      }
      finalQty = qtyPerUnit * conv.factor;
      finalUnit = ing.unit;
    }
    setCreating(true);
    try {
      await createPrepItem({
        ingredientId: createIngredientId,
        name: createName.trim(),
        quantityPerUnit: finalQty,
        unit: finalUnit,
      });
      setShowCreateModal(false);
      setCreateIngredientId('');
      setCreateName('');
      setCreateQtyPerUnit('');
      setCreateUnit('');
      setCreateConversions([]);
      await onRefresh?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore creazione prep item', { type: 'error', duration: 5000 });
    } finally {
      setCreating(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateIngredientId('');
    setCreateName('');
    setCreateQtyPerUnit('');
    setCreateUnit('');
    setCreateConversions([]);
  };

  const handleCreateConversion = async (fromUnit: string, factor: number) => {
    if (!createIngredientId) return;
    const ing = inventory.find((i) => i.id === createIngredientId);
    if (!ing) return;
    await createUnitConversion(createIngredientId, { fromUnit, toUnit: ing.unit, factor });
    const convs = await fetchUnitConversions(createIngredientId);
    setCreateConversions(convs);
  };

  const openEditModal = (item: PrepItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQtyPerUnit(String(item.quantityPerUnit));
    setEditUnit(item.unit);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditName('');
    setEditQtyPerUnit('');
    setEditUnit('');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const qtyPerUnit = Number(editQtyPerUnit);
    if (!editName.trim() || !qtyPerUnit || qtyPerUnit <= 0 || !editUnit) return;
    setSaving(true);
    try {
      await updatePrepItem(editingItem.id, {
        name: editName.trim(),
        quantityPerUnit: qtyPerUnit,
        unit: editUnit,
      });
      closeEditModal();
      await onRefresh?.();
      showToast('Variante aggiornata', { type: 'success', duration: 3000 });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore aggiornamento', { type: 'error', duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: PrepItem) => {
    requestConfirm(`Eliminare la variante "${item.name}"?`, async () => {
      try {
        await deletePrepItem(item.id);
        await onRefresh?.();
        showToast('Variante eliminata', { type: 'success', duration: 3000 });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Errore eliminazione', { type: 'error', duration: 5000 });
      }
    });
  };

  const selectedCreateIngredient = inventory.find((i) => i.id === createIngredientId);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <SectionHeader
        title="Preparazioni"
        actions={
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            Nuova Variante
          </Button>
        }
      />
      <div className="p-4 space-y-4">

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <label htmlFor={searchId} className="sr-only">Cerca ingrediente</label>
        <input
          id={searchId}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca ingrediente..."
          aria-label="Cerca ingrediente"
          className="w-full pl-9 pr-3 py-2 rounded border border-border text-sm"
        />
      </div>

      {/* Prep items list */}
      {groupedItems.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-sm">
          <ChefHat size={24} className="mx-auto mb-2 opacity-50" />
          <p>Nessuna preparazione configurata.</p>
          <p className="text-xs mt-1">Clicca "Nuova Variante" per crearne una.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedItems.map(({ ingredient, items: groupItems }) => (
            <div key={ingredient.id} className="border border-border rounded-lg overflow-hidden">
              {/* Ingredient header */}
              <div className="bg-bg px-4 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ChefHat size={14} className="text-text-muted" />
                  <span className="text-sm font-bold text-primary">{ingredient.name}</span>
                </div>
                <span className="text-[10px] text-text-muted">
                  Stock: <span className="font-bold text-secondary">{ingredient.quantity} {ingredient.unit}</span>
                </span>
              </div>

              {/* Variants */}
              <div className="divide-y divide-border">
                {groupItems.map((item) => {
                  const qty = Number(quantities[item.id] || '0');
                  const needed = item.quantityPerUnit > 0 ? qty * item.quantityPerUnit : 0;
                  const isPreparing = preparingId === item.id;
                  const hasStock = ingredient.quantity >= needed;
                  const showCheck = qty > 0;

                  return (
                    <div key={item.id} className="px-4 py-3">
                      {/* Variant name + actions */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-primary">{item.name}</p>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(item)} aria-label="Modifica variante">
                            <Pencil size={12} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(item)} aria-label="Elimina variante">
                            <Trash2 size={12} className="text-danger" />
                          </Button>
                        </div>
                      </div>

                      {/* 3-column layout */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        {/* Stock Raw */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                            Stock Raw
                          </p>
                          <p className="text-sm font-bold text-primary">
                            {ingredient.quantity} {ingredient.unit}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            1 {item.unit} = {item.quantityPerUnit} {ingredient.unit}
                          </p>
                        </div>

                        {/* Stock Lavorato */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                            Stock Lavorato
                          </p>
                          <p className="text-sm font-bold text-secondary">
                            {item.stockQuantity} {item.unit}
                          </p>
                        </div>

                        {/* Prepara */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                            Prepara
                          </p>
                          <div className="flex items-center gap-2">
                            <label htmlFor={prepareQtyId(item.id)} className="sr-only">
                              Quantità da preparare per {item.name}
                            </label>
                            <input
                              id={prepareQtyId(item.id)}
                              type="number"
                              value={quantities[item.id] || ''}
                              onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Qtà"
                              aria-label={`Quantità da preparare per ${item.name}`}
                              className="flex-1 px-3 py-2 rounded border border-border text-sm"
                              min="1"
                              step="1"
                            />
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void handlePrepare(item.id)}
                              disabled={isPreparing || !qty || qty <= 0}
                            >
                              {isPreparing ? <Loader2 size={12} className="animate-spin" /> : null}
                              Prepara
                            </Button>
                          </div>
                          {showCheck && (
                            <p className={`text-[10px] mt-1 ${hasStock ? 'text-green-600' : 'text-red-600'}`}>
                              {hasStock ? '✓' : '✗'} {needed.toFixed(3)} {ingredient.unit} necessari
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="Nuova Variante"
        size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={closeCreateModal}>
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCreate()}
              disabled={creating || !createName.trim() || !createQtyPerUnit || !createUnit}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : null}
              Crea Variante
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Existing variants for selected ingredient */}
          {createIngredientId && (() => {
            const existingVariants = prepItems.filter((i) => i.ingredientId === createIngredientId);
            if (existingVariants.length === 0) return null;
            return (
              <div className="bg-bg rounded-lg border border-border p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">
                  Varianti esistenti per {inventory.find((i) => i.id === createIngredientId)?.name}
                </p>
                <div className="space-y-1.5">
                  {existingVariants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-secondary">{v.name}</span>
                      <span className="text-text-muted">{v.stockQuantity} {v.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Ingredient select */}
          <Field label="Ingrediente">
            {({ id }) => (
              <SearchableSelect
                id={id}
                ariaLabel="Ingrediente"
                items={inventory.filter((i) => i.isActive)}
                getLabel={(i) => `${i.name} — Stock: ${i.quantity} ${i.unit}`}
                getValue={(i) => i.id}
                selectedValue={createIngredientId}
                onSelect={(v) => void handleCreateIngredientSelect(v)}
                placeholder="Cerca ingrediente..."
              />
            )}
          </Field>

          {/* Name */}
          <Field label="Nome variante">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="es. Burger 150g"
                className="w-full px-3 py-2 rounded border border-border text-sm"
              />
            )}
          </Field>

          {/* Quantity per unit + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantità per unità">
              {({ id }) => (
                <input
                  id={id}
                  type="number"
                  value={createQtyPerUnit}
                  onChange={(e) => setCreateQtyPerUnit(e.target.value)}
                  placeholder="es. 150"
                  className="w-full px-3 py-2 rounded border border-border text-sm"
                  step="0.001"
                  min="0.001"
                />
              )}
            </Field>
            <Field label="Unità">
              {({ id }) => (
                <UnitSelect
                  id={id}
                  ariaLabel="Unità"
                  value={createUnit}
                  onChange={setCreateUnit}
                  placeholder="Seleziona unità..."
                />
              )}
            </Field>
          </div>

          {/* Conversion preview + management */}
          {selectedCreateIngredient && (
            <UnitConversionManager
              ingredientName={selectedCreateIngredient.name}
              ingredientUnit={selectedCreateIngredient.unit}
              conversions={createConversions}
              onCreateConversion={(fromUnit, factor) => handleCreateConversion(fromUnit, factor)}
              selectedUnit={createUnit}
              quantityPerUnit={Number(createQtyPerUnit)}
            />
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editingItem}
        onClose={closeEditModal}
        title="Modifica Variante"
        size="sm"
        footer={
          <SaveFooter
            onCancel={closeEditModal}
            onSave={() => void handleSaveEdit()}
            saving={saving}
            disabled={!editName.trim() || !editQtyPerUnit || !editUnit}
          />
        }
      >
        <div className="space-y-4">
          <Field label="Nome variante">
            {({ id }) => (
              <input
                id={id}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-border text-sm"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantità per unità">
              {({ id }) => (
                <input
                  id={id}
                  type="number"
                  value={editQtyPerUnit}
                  onChange={(e) => setEditQtyPerUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border text-sm"
                  step="0.001"
                  min="0.001"
                />
              )}
            </Field>
            <Field label="Unità">
              {({ id }) => (
                <UnitSelect
                  id={id}
                  ariaLabel="Unità"
                  value={editUnit}
                  onChange={setEditUnit}
                />
              )}
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title="Conferma"
        message={confirm?.message ?? ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
