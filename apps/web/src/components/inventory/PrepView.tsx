import { useState, useEffect, useMemo, useId } from 'react';
import type { PrepItem, Ingredient, BomItem, UnitConversion } from '@gustopos/shared';
import { ChefHat, Loader2, Plus, Search, Pencil, Trash2, Layers } from 'lucide-react';
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
  deleteUnitConversion,
} from '../../shared/api/client';

interface PrepViewProps {
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  onRefresh?: () => Promise<void>;
  initialIngredientId?: string | null;
  onClearInitial?: () => void;
}

type PrepGroup = {
  key: string;
  kind: 'ingredient' | 'bom';
  label: string;
  unit: string;
  stockQty: number | null;
  bomYield?: number;
  items: PrepItem[];
};

export default function PrepView({ inventory, bomItems, prepItems, onRefresh, initialIngredientId, onClearInitial }: PrepViewProps) {
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const searchId = useId();
  const prepareQtyId = (id: string) => `prep-qty-${id}`;
  const [searchTerm, setSearchTerm] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [preparingId, setPreparingId] = useState<string | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSource, setCreateSource] = useState<'ingredient' | 'bom'>('ingredient');
  const [createIngredientId, setCreateIngredientId] = useState('');
  const [createBomId, setCreateBomId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createQtyPerUnit, setCreateQtyPerUnit] = useState('');
  const [createUnit, setCreateUnit] = useState('');
  const [createConversions, setCreateConversions] = useState<UnitConversion[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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

  // Prep items are not part of the bootstrap payload (unlike inventory/BoM):
  // fetch them the first time the tab mounts so the list populates even
  // before any mutation. Subsequent refreshes happen via onRefresh after
  // create/update/delete/prepare.
  useEffect(() => {
    if (prepItems.length === 0) {
      void onRefresh?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- [mount-once] intentionally runs only when the tab first opens with an empty list
  }, []);

  // Group items by their source: ingredient (classic variants) or BoM (prepared recipes)
  const groupedItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? prepItems.filter((item) => {
          if (item.sourceType === 'bom') {
            const bom = bomItems.find((b) => b.id === item.sourceId);
            return bom?.name.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
          }
          const ing = inventory.find((i) => i.id === item.sourceId);
          return ing?.name.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
        })
      : prepItems;

    const groups = new Map<string, PrepGroup>();
    for (const item of filtered) {
      if (item.sourceType === 'bom') {
        const bom = bomItems.find((b) => b.id === item.sourceId);
        if (!bom) continue;
        const key = `bom:${item.sourceId}`;
        const existing = groups.get(key) ?? {
          key,
          kind: 'bom' as const,
          label: bom.name,
          unit: bom.outputUnit,
          stockQty: null,
          bomYield: Number(bom.yieldQuantity ?? 1),
          items: [],
        };
        existing.items.push(item);
        groups.set(key, existing);
      } else {
        const ing = inventory.find((i) => i.id === item.sourceId);
        if (!ing) continue;
        const key = `ing:${item.sourceId}`;
        const existing = groups.get(key) ?? {
          key,
          kind: 'ingredient' as const,
          label: ing.name,
          unit: ing.unit,
          stockQty: ing.quantity,
          items: [],
        };
        existing.items.push(item);
        groups.set(key, existing);
      }
    }
    return [...groups.values()];
  }, [prepItems, inventory, bomItems, searchTerm]);

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
    setCreateSource('ingredient');
    setCreateIngredientId(ingredientId);
    setCreateBomId('');
    setCreateConversions([]);
    setCreateError('');
    // Auto-populate the unit from the ingredient so the form is immediately
    // valid (the conversion list then lets the user switch to another unit).
    const ing = inventory.find((i) => i.id === ingredientId);
    setCreateUnit(ing?.unit ?? '');
    if (ingredientId) {
      try {
        const convs = await fetchUnitConversions(ingredientId);
        setCreateConversions(convs);
      } catch {
        setCreateConversions([]);
      }
    }
  };

  const handleBomSelect = (bomId: string) => {
    setCreateSource('bom');
    setCreateBomId(bomId);
    setCreateIngredientId('');
    setCreateConversions([]);
    setCreateError('');
    const bom = bomItems.find((b) => b.id === bomId);
    if (bom) {
      setCreateName((prev) => (prev.trim() ? prev : bom.name));
      setCreateUnit(bom.outputUnit);
      setCreateQtyPerUnit('1');
    }
  };

  const resetCreateModal = () => {
    setShowCreateModal(false);
    setCreateSource('ingredient');
    setCreateIngredientId('');
    setCreateBomId('');
    setCreateName('');
    setCreateQtyPerUnit('');
    setCreateUnit('');
    setCreateConversions([]);
    setCreateError('');
  };

  const closeCreateModal = () => resetCreateModal();

  const handleCreate = async () => {
    const qtyPerUnit = Number(createQtyPerUnit);
    // Inline validation — the create button never silently no-ops. Each failure
    // path sets a visible Italian message instead of a bare `return`.
    if (!createName.trim()) {
      setCreateError('Inserisci un nome per la variante.');
      return;
    }
    if (!createUnit) {
      setCreateError('Seleziona un\'unità di misura per la variante.');
      return;
    }
    if (!Number.isFinite(qtyPerUnit) || qtyPerUnit <= 0) {
      setCreateError('La quantità per unità deve essere un numero maggiore di 0.');
      return;
    }

    if (createSource === 'ingredient') {
      if (!createIngredientId) {
        setCreateError('Seleziona un ingrediente.');
        return;
      }
      const ing = inventory.find((i) => i.id === createIngredientId);
      if (!ing) {
        setCreateError('Ingrediente non trovato.');
        return;
      }
      let finalQty = qtyPerUnit;
      let finalUnit = createUnit;
      if (createUnit !== ing.unit) {
        const conv = createConversions.find((c) => c.fromUnit === createUnit);
        if (!conv) {
          setCreateError(`Nessuna conversione definita per "${createUnit}" → "${ing.unit}". Aggiungila qui sotto o usa "${ing.unit}".`);
          return;
        }
        // The user typed the quantity in the selected unit: convert it to the
        // ingredient's base unit before persisting.
        finalQty = qtyPerUnit * conv.factor;
        finalUnit = ing.unit;
      }
      setCreateError('');
      setCreating(true);
      try {
        await createPrepItem({
          name: createName.trim(),
          source: {
            sourceType: 'ingredient',
            sourceId: createIngredientId,
            inputQuantity: finalQty,
            inputUnit: finalUnit as PrepItem['inputUnit'],
            outputQuantity: 1,
            outputUnit: 'pz',
          },
        });
        resetCreateModal();
        await onRefresh?.();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Errore creazione prep item');
      } finally {
        setCreating(false);
      }
      return;
    }

    if (!createBomId) {
      setCreateError('Seleziona una ricetta BoM.');
      return;
    }
    setCreateError('');
    setCreating(true);
    try {
      await createPrepItem({
        name: createName.trim(),
        source: {
          sourceType: 'bom',
          sourceId: createBomId,
          inputQuantity: 1,
          inputUnit: createUnit as PrepItem['inputUnit'],
          outputQuantity: 1,
          outputUnit: 'pz',
        },
      });
      resetCreateModal();
      await onRefresh?.();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Errore creazione prep item');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateConversion = async (fromUnit: string, factor: number) => {
    if (!createIngredientId) return;
    const ing = inventory.find((i) => i.id === createIngredientId);
    if (!ing) return;
    try {
      await createUnitConversion(createIngredientId, { fromUnit, toUnit: ing.unit, factor });
      const convs = await fetchUnitConversions(createIngredientId);
      setCreateConversions(convs);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore creazione conversione', { type: 'error', duration: 5000 });
    }
  };

  const openEditModal = (item: PrepItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditQtyPerUnit(String(item.inputQuantity));
    setEditUnit(item.inputUnit);
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
        inputQuantity: qtyPerUnit,
        inputUnit: editUnit as PrepItem['inputUnit'],
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
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[400px] tabular-nums">
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
        <label htmlFor={searchId} className="sr-only">Cerca ingrediente o BoM</label>
        <input
          id={searchId}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cerca ingrediente o BoM..."
          aria-label="Cerca ingrediente o BoM"
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
          {groupedItems.map((group) => (
            <div key={group.key} className="border border-border rounded-lg overflow-hidden">
              {/* Source header */}
              <div className="bg-bg px-4 py-2 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {group.kind === 'bom' ? <Layers size={14} className="text-text-muted" /> : <ChefHat size={14} className="text-text-muted" />}
                  <span className="text-sm font-bold text-primary">{group.label}</span>
                  {group.kind === 'bom' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-bold uppercase tracking-wider">Da BoM</span>
                  )}
                </div>
                <span className="text-[10px] text-text-muted">
                  {group.kind === 'bom'
                    ? <>Resa: <span className="font-bold text-secondary">{group.bomYield} {group.unit}</span></>
                    : <>Stock: <span className="font-bold text-secondary">{group.stockQty} {group.unit}</span></>}
                </span>
              </div>

              {/* Variants */}
              <div className="divide-y divide-border">
                {group.items.map((item) => {
                  const qty = Number(quantities[item.id] || '0');
                  const isPreparing = preparingId === item.id;
                  const isBomItem = item.sourceType === 'bom';
                  const needed = !isBomItem && item.inputQuantity > 0 ? qty * item.inputQuantity : 0;
                  const hasStock = !isBomItem && group.stockQty != null ? group.stockQty >= needed : false;
                  const showCheck = qty > 0 && !isBomItem;

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
                        {/* Stock Raw / Ricetta */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                            {isBomItem ? 'Ricetta BoM' : 'Stock Raw'}
                          </p>
                          {isBomItem ? (
                            <>
                              <p className="text-sm font-bold text-primary">{group.label}</p>
                              <p className="text-[10px] text-text-muted">
                                Deduce gli ingredienti dalla ricetta alla preparazione
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold text-primary">
                                {group.stockQty} {group.unit}
                              </p>
                              <p className="text-[10px] text-text-muted">
                                1 {item.outputUnit} = {item.inputQuantity} {item.inputUnit}
                              </p>
                            </>
                          )}
                        </div>

                        {/* Stock Lavorato */}
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                            Stock Lavorato
                          </p>
                          <p className="text-sm font-bold text-secondary">
                            {item.stockQuantity} {item.outputUnit}
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
                            <p className={`text-[10px] mt-1 ${hasStock ? 'text-success-600' : 'text-danger-600'}`}>
                              {hasStock ? '✓' : '✗'} {needed.toFixed(3)} {group.unit} necessari
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
              disabled={creating}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : null}
              Crea Variante
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {createError && (
            <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2" role="alert">
              {createError}
            </p>
          )}
          {/* Source type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCreateSource('ingredient');
                setCreateBomId('');
                setCreateError('');
                if (!createIngredientId) setCreateName('');
              }}
              className={`px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors ${
                createSource === 'ingredient'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-text-muted hover:text-secondary'
              }`}
            >
              <ChefHat size={14} className="inline mr-1" />
              Da Ingrediente
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateSource('bom');
                setCreateIngredientId('');
                setCreateConversions([]);
                setCreateError('');
              }}
              className={`px-3 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors ${
                createSource === 'bom'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-text-muted hover:text-secondary'
              }`}
            >
              <Layers size={14} className="inline mr-1" />
              Da BoM
            </button>
          </div>

          {createSource === 'ingredient' ? (
            <>
              {/* Existing variants for selected ingredient */}
              {createIngredientId && (() => {
                const existingVariants = prepItems.filter((i) => i.sourceType === 'ingredient' && i.sourceId === createIngredientId);
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
                          <span className="text-text-muted">{v.stockQuantity} {v.outputUnit}</span>
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
                <Field label="Quantità per 1 unità finita">
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
                <Field label="Unità della quantità">
                  {({ id }) => (
                    <UnitSelect
                      id={id}
                      ariaLabel="Unità"
                      value={createUnit}
                      onChange={(e) => { setCreateUnit(e); setCreateError(''); }}
                      placeholder="Seleziona unità..."
                      extraUnits={createConversions.map((c) => ({ value: c.fromUnit, label: c.fromUnit, category: 'Conversioni' }))}
                    />
                  )}
                </Field>
              </div>

              {/* Live conversion preview: quantity typed in the selected unit → base unit */}
              {(() => {
                if (!selectedCreateIngredient || !createUnit || createUnit === selectedCreateIngredient.unit) return null;
                const conv = createConversions.find((c) => c.fromUnit === createUnit);
                const qty = Number(createQtyPerUnit);
                const hasQty = Number.isFinite(qty) && qty > 0;
                if (!conv) {
                  return (
                    <p className="text-[11px] text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
                      L'unità "{createUnit}" è diversa dall'unità base di {selectedCreateIngredient.name} ({selectedCreateIngredient.unit}).
                      Definisci una conversione qui sotto per poter creare la variante, oppure usa "{selectedCreateIngredient.unit}".
                    </p>
                  );
                }
                return (
                  <p className="text-[11px] text-accent bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                    {hasQty
                      ? <>1 unità finita = {qty} {createUnit} → <b>{qty * conv.factor} {selectedCreateIngredient.unit}</b> di {selectedCreateIngredient.name}</>
                      : <>1 {createUnit} = {conv.factor} {selectedCreateIngredient.unit} (inserisci la quantità per il calcolo)</>}
                  </p>
                );
              })()}

              {/* Conversion preview + management */}
              {selectedCreateIngredient && (
                <UnitConversionManager
                  ingredientName={selectedCreateIngredient.name}
                  ingredientUnit={selectedCreateIngredient.unit}
                  conversions={createConversions}
                  onCreateConversion={(fromUnit, factor) => handleCreateConversion(fromUnit, factor)}
                  onDeleteConversion={async (conversionId) => {
                    if (!createIngredientId) return;
                    try {
                      await deleteUnitConversion(createIngredientId, conversionId);
                      const convs = await fetchUnitConversions(createIngredientId);
                      setCreateConversions(convs);
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : 'Errore eliminazione conversione', { type: 'error', duration: 5000 });
                    }
                  }}
                  selectedUnit={createUnit}
                  quantityPerUnit={Number(createQtyPerUnit)}
                />
              )}
            </>
          ) : (
            <>
              {/* BoM select */}
              <Field label="Ricetta BoM">
                {({ id }) => (
                  <SearchableSelect
                    id={id}
                    ariaLabel="Ricetta BoM"
                    items={bomItems.filter((b) => b.isActive)}
                    getLabel={(b) => `${b.name} — resa ${b.yieldQuantity} ${b.outputUnit} (${b.components.length} componenti)`}
                    getValue={(b) => b.id}
                    selectedValue={createBomId}
                    onSelect={handleBomSelect}
                    placeholder="Cerca BoM..."
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
                    placeholder="es. Cartoccio preparato"
                    className="w-full px-3 py-2 rounded border border-border text-sm"
                  />
                )}
              </Field>

              <p className="text-xs text-text-muted bg-bg border border-border rounded-lg p-3">
                Preparando questa variante il sistema dedurrà automaticamente <b>tutti gli ingredienti</b> della ricetta
                ({createBomId ? bomItems.find((b) => b.id === createBomId)?.components.length ?? 0 : 0} componenti) e aggiungerà
                le unità finite allo stock lavorato. Per consumare questo stock in un ordine, collega la variante alla ricetta
                di un piatto come componente <b>Preparazione</b>.
              </p>
            </>
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
