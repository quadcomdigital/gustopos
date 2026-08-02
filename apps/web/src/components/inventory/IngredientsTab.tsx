import type { Ingredient, Category, IngredientCreateRequest, IngredientUpdateRequest, UnitConversion } from '@gustopos/shared';
import { AlertTriangle, RotateCcw, ToggleRight, ToggleLeft, Eye, Search, ChevronUp, ChevronDown, ChevronRight, Plus, Trash2, Package, ChefHat, ArrowLeftRight } from 'lucide-react';
import { Fragment, useMemo, useState, useEffect, useCallback } from 'react';
import Button from '../../shared/ui/atoms/Button';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import Modal from '../../shared/ui/molecules/Modal';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import UnitSelect from '../../shared/ui/molecules/UnitSelect';
import { useScopedCategories } from './useInventoryShared';
import InlineCategoryPicker from './InlineCategoryPicker';
import StockMovementsDrawer from './StockMovementsDrawer';
import { useAppStore } from '../../store/app-store';
import { useDebounce } from '../../hooks/useDebounce';
import Field from '../../shared/ui/atoms/Field';
import { required, minLength, validNumber, getErrorClass, type ValidationErrors } from '../../shared/ui/hooks/useFieldValidation';
import LoadingOrEmpty from '../../shared/ui/molecules/LoadingOrEmpty';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import UnitConversionManager from './UnitConversionManager';

interface IngredientsTabProps {
  inventory: Ingredient[];
  categories: Category[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onCreate?: (payload: IngredientCreateRequest) => Promise<void>;
  onUpdate?: (id: string, payload: IngredientUpdateRequest) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onAdjust?: (id: string, payload: { quantity: number; notes?: string }) => Promise<void>;
  onCreateCategory?: (payload: { name: string; scope: 'ingredient' | 'bom' | 'menu'; printAreas: Array<'kitchen' | 'bar' | 'cashier'> }) => Promise<void>;
  onFetchMovements?: (id: string) => Promise<{ movements: any[] }>;
  onCreateVariant?: (ingredientId: string) => void;
}

export default function IngredientsTab({
  inventory,
  categories,
  loading = false,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onAdjust,
  onCreateCategory,
  onFetchMovements,
  onCreateVariant,
}: IngredientsTabProps) {
  const enabledModules = useAppStore((s) => s.enabledModules);
  const isSuppliersEnabled = enabledModules.includes('purchasing_suppliers');
  const { confirm, requestConfirm, handleConfirm, handleCancel } = useConfirm();
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [ingredientEditName, setIngredientEditName] = useState('');
  const [ingredientEditCategoryId, setIngredientEditCategoryId] = useState('');
  const [ingredientEditQty, setIngredientEditQty] = useState('0');
  const [ingredientEditUnit, setIngredientEditUnit] = useState('kg');
  const [ingredientEditThreshold, setIngredientEditThreshold] = useState('0');
  const [ingredientEditUnitCost, setIngredientEditUnitCost] = useState('0');
  const [ingredientEditSalePrice, setIngredientEditSalePrice] = useState('');
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientCategoryId, setNewIngredientCategoryId] = useState('');
  const [newIngredientQty, setNewIngredientQty] = useState('0');
  const [newIngredientUnit, setNewIngredientUnit] = useState('kg');
  const [newIngredientThreshold, setNewIngredientThreshold] = useState('0');
  const [newIngredientUnitCost, setNewIngredientUnitCost] = useState('0');
  const [newIngredientSalePrice, setNewIngredientSalePrice] = useState('');
  const [newIngredientIsContainer, setNewIngredientIsContainer] = useState(false);
  const [ingredientEditIsContainer, setIngredientEditIsContainer] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  type SortKey = 'name' | 'quantity' | 'status';
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [adjustTargetId, setAdjustTargetId] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('0');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [movementsIngredientId, setMovementsIngredientId] = useState('');
  const [movements, setMovements] = useState<any[]>([]);
  const [_movementsLoading, setMovementsLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const fetchUnitConversions = useAppStore((s) => s.fetchUnitConversions);
  const createUnitConversion = useAppStore((s) => s.createUnitConversion);
  const deleteUnitConversion = useAppStore((s) => s.deleteUnitConversion);
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredInventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredInventory.map((i) => i.id)));
    }
  };

  const bulkDeactivate = async () => {
    if (!onUpdate) return;
    for (const id of selectedItems) {
      await onUpdate(id, { isActive: false });
    }
    setSelectedItems(new Set());
    void onRefresh?.();
  };

  const bulkDelete = async () => {
    if (!onDelete) return;
    requestConfirm(`Eliminare ${selectedItems.size} ingrediente/i?`, async () => {
      for (const id of selectedItems) {
        await onDelete(id);
      }
      setSelectedItems(new Set());
      void onRefresh?.();
    });
  };

  const ingredientCategories = useScopedCategories(categories, 'ingredient');

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.quantity <= i.minThreshold).length,
    [inventory],
  );

  const filteredInventory = useMemo(() => {
    let result = filterCategoryId
      ? inventory.filter((i) => i.categoryId === filterCategoryId)
      : inventory;
    if (filterLowStock) {
      result = result.filter((i) => i.quantity <= i.minThreshold);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'quantity') return (a.quantity - b.quantity) * dir;
      return (Number(a.isActive) - Number(b.isActive)) * dir;
    });
    return result;
  }, [inventory, filterCategoryId, filterLowStock, debouncedSearch, sortKey, sortAsc]);

  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of inventory) {
      const catId = item.categoryId ?? '__none__';
      counts.set(catId, (counts.get(catId) ?? 0) + 1);
    }
    return [
      { value: '', label: 'Tutte', badge: inventory.length },
      ...ingredientCategories.map((c) => ({
        value: c.id,
        label: c.name,
        badge: counts.get(c.id) ?? 0,
      })),
    ];
  }, [inventory, ingredientCategories]);

  const selectedIngredient = useMemo(
    () => inventory.find((item) => item.id === selectedIngredientId) ?? null,
    [inventory, selectedIngredientId],
  );

  const editModalDirty = useMemo(() => {
    if (!selectedIngredient) return false;
    return (
      ingredientEditName.trim() !== selectedIngredient.name
      || ingredientEditCategoryId !== (selectedIngredient.categoryId ?? '')
      || ingredientEditQty !== String(selectedIngredient.quantity)
      || ingredientEditUnit !== selectedIngredient.unit
      || ingredientEditThreshold !== String(selectedIngredient.minThreshold)
      || ingredientEditUnitCost !== String(selectedIngredient.unitCost ?? 0)
      || ingredientEditSalePrice !== (selectedIngredient.salePrice != null ? String(selectedIngredient.salePrice) : '')
      || ingredientEditIsContainer !== (selectedIngredient.isContainer === 1)
    );
  }, [
    selectedIngredient,
    ingredientEditName,
    ingredientEditCategoryId,
    ingredientEditQty,
    ingredientEditUnit,
    ingredientEditThreshold,
    ingredientEditUnitCost,
    ingredientEditSalePrice,
    ingredientEditIsContainer,
  ]);

  useEffect(() => {
    if (!selectedIngredientId) return;
    if (!inventory.some((item) => item.id === selectedIngredientId)) {
      setSelectedIngredientId(''); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] reset selection when ingredient is removed; setter receives literal empty string
    }
  }, [inventory, selectedIngredientId]);

  useEffect(() => {
    if (!selectedIngredient) return;
    setIngredientEditName(selectedIngredient.name); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize edit fields from selected ingredient; safe because all values are primitives
    setIngredientEditCategoryId(selectedIngredient.categoryId ?? '');  
    setIngredientEditQty(String(selectedIngredient.quantity));  
    setIngredientEditUnit(selectedIngredient.unit);  
    setIngredientEditThreshold(String(selectedIngredient.minThreshold));  
    setIngredientEditUnitCost(String(selectedIngredient.unitCost ?? 0));  
    setIngredientEditSalePrice(selectedIngredient.salePrice != null ? String(selectedIngredient.salePrice) : '');
    setIngredientEditIsContainer(selectedIngredient.isContainer === 1);

    // Load unit conversions for this ingredient
    void fetchUnitConversions(selectedIngredient.id).then(setConversions);
  }, [selectedIngredient, fetchUnitConversions]);

  // Keyboard navigation
  const listRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      // Skip if inside an input/textarea/select or modal
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.closest('[role="dialog"]')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const list = filteredInventory;
        const currentIdx = list.findIndex((i) => i.id === selectedIngredientId);
        const nextIdx = currentIdx < list.length - 1 ? currentIdx + 1 : 0;
        setSelectedIngredientId(list[nextIdx]?.id ?? '');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const list = filteredInventory;
        const currentIdx = list.findIndex((i) => i.id === selectedIngredientId);
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : list.length - 1;
        setSelectedIngredientId(list[prevIdx]?.id ?? '');
      } else if (e.key === 'Enter' && selectedIngredientId) {
        e.preventDefault();
        // Open edit modal for selected item
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowCreateModal(true);
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, [filteredInventory, selectedIngredientId]);

  const validateCreateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    errors.name = required(newIngredientName, 'Nome') ?? minLength(newIngredientName, 2, 'Nome');
    errors.qty = validNumber(newIngredientQty);
    errors.threshold = validNumber(newIngredientThreshold);
    errors.unitCost = validNumber(newIngredientUnitCost);
    errors.salePrice = validNumber(newIngredientSalePrice);
    return errors;
  };

  const createIngredient = async (): Promise<boolean> => {
    if (!onCreate) return false;
    const errors = validateCreateForm();
    setCreateErrors(errors);
    const hasError = Object.values(errors).some(Boolean);
    if (hasError) return false;

    const name = newIngredientName.trim();
    const quantity = Number(newIngredientQty);
    const minThreshold = Number(newIngredientThreshold);
    const unitCost = Number(newIngredientUnitCost);

    try {
      await onCreate({
        name,
        quantity,
        unit: newIngredientUnit,
        minThreshold,
        categoryId: newIngredientCategoryId || undefined,
        unitCost,
        salePrice: newIngredientSalePrice ? Number(newIngredientSalePrice) : null,
        isContainer: newIngredientIsContainer ? 1 : 0,
      });
      setNewIngredientName('');
      setNewIngredientQty('0');
      setNewIngredientThreshold('0');
      setNewIngredientUnitCost('0');
      setNewIngredientSalePrice('');
      setNewIngredientCategoryId('');
      setNewIngredientIsContainer(false);
      setCreateErrors({});
      return true;
    } catch {
      return false;
    }
  };

  const saveIngredient = async () => {
    if (!selectedIngredient || !onUpdate) return;
    setSaveError('');
    const errors: ValidationErrors = {};
    errors.name = required(ingredientEditName, 'Nome') ?? minLength(ingredientEditName, 2, 'Nome');
    errors.qty = validNumber(ingredientEditQty);
    errors.threshold = validNumber(ingredientEditThreshold);
    errors.unitCost = validNumber(ingredientEditUnitCost);
    errors.salePrice = validNumber(ingredientEditSalePrice);
    setEditErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const quantity = Number(ingredientEditQty);
    const minThreshold = Number(ingredientEditThreshold);
    const unitCost = Number(ingredientEditUnitCost);

    try {
      await onUpdate(selectedIngredient.id, {
        name: ingredientEditName.trim(),
        quantity,
        unit: ingredientEditUnit,
        minThreshold,
        categoryId: ingredientEditCategoryId || undefined,
        unitCost,
        salePrice: ingredientEditSalePrice ? Number(ingredientEditSalePrice) : null,
        isContainer: ingredientEditIsContainer ? 1 : 0,
      });
      void onRefresh?.();
    } catch (err) {
      setSaveError(`Errore salvataggio: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const toggleIngredientActive = async (ingredient: Ingredient) => {
    if (!onUpdate) return;
    await onUpdate(ingredient.id, { isActive: !ingredient.isActive });
    void onRefresh?.();
  };

  const toggleContainer = async (ingredient: Ingredient) => {
    if (!onUpdate) return;
    await onUpdate(ingredient.id, { isContainer: ingredient.isContainer === 1 ? 0 : 1 });
    void onRefresh?.();
  };

  const removeIngredient = async (id: string) => {
    if (!onDelete) return;
    requestConfirm('Eliminare questo ingrediente?', async () => {
      await onDelete(id);
      if (selectedIngredientId === id) {
        setSelectedIngredientId('');
      }
      void onRefresh?.();
    });
  };

  const submitAdjust = async () => {
    if (!adjustTargetId || !onAdjust) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) return;
    await onAdjust(adjustTargetId, {
      quantity: delta,
      notes: adjustNotes || undefined,
    });
    setAdjustTargetId('');
    setAdjustDelta('0');
    setAdjustNotes('');
    void onRefresh?.();
  };

  const openMovements = async (id: string) => {
    setMovements([]);
    setMovementsIngredientId(id);
    if (!onFetchMovements) return;
    setMovementsLoading(true);
    try {
      const res = await onFetchMovements(id);
      setMovements(res.movements);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  const movementsIngredient = useMemo(
    () => inventory.find((i) => i.id === movementsIngredientId),
    [inventory, movementsIngredientId],
  );

  return (
    <div ref={listRef} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[400px]" tabIndex={-1}>
      <SectionHeader
        title="Ingredienti Singoli"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} />
              Nuovo ingrediente
            </Button>
            <Button variant="secondary" onClick={() => void onRefresh?.()}>
              <RotateCcw size={14} />
              Refresh
            </Button>
          </>
        }
      />

      {lowStockCount > 0 && (
        <button
          onClick={() => setFilterLowStock((prev) => !prev)}
          className={`w-full border-b px-4 py-3 flex items-center gap-2 sm:gap-3 shrink-0 text-left transition-colors ${
            filterLowStock
              ? 'bg-amber-100 border-amber-400'
              : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
          }`}
        >
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold text-amber-800">
              {lowStockCount} sotto soglia
              {filterLowStock && <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-600">(filtrato)</span>}
            </p>
            <p className="text-[10px] sm:text-xs text-amber-600">
              {filterLowStock ? 'Clicca per mostrare tutti' : 'Clicca per filtrare'}
            </p>
          </div>
        </button>
      )}

      {ingredientCategories.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-bg/20">
          <SegmentedChips
            ariaLabel="Filtra ingredienti per categoria"
            value={filterCategoryId}
            onChange={setFilterCategoryId}
            options={chipOptions}
            size="sm"
          />
        </div>
      )}

      <div className="px-4 py-2 border-b border-border bg-bg/20">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca ingrediente..."
            className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
          />
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuovo ingrediente"
        size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => void createIngredient().then((ok) => { if (ok) { void onRefresh?.(); setShowCreateModal(false); } })}
            >
              Crea ingrediente
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome" error={createErrors.name?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={createErrors.name?.message ? props.errorId : undefined}
                value={newIngredientName}
                onChange={(e) => setNewIngredientName(e.target.value)}
                placeholder="Nome ingrediente"
                className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.name)}`}
              />
            )}
          </Field>

          <Field label="Categoria">
            {(props) => (
              <SearchableSelect
                id={props.id}
                ariaLabel="Categoria"
                items={ingredientCategories}
                getLabel={(cat) => cat.name}
                getValue={(cat) => cat.id}
                selectedValue={newIngredientCategoryId}
                onSelect={setNewIngredientCategoryId}
                placeholder="Seleziona categoria..."
              />
            )}
          </Field>

          <Field label="Quantità" error={createErrors.qty?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={createErrors.qty?.message ? props.errorId : undefined}
                value={newIngredientQty}
                onChange={(e) => setNewIngredientQty(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Quantità"
                inputMode="decimal"
                min="0"
                className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.qty)}`}
              />
            )}
          </Field>

          <Field label="Unità">
            {(props) => (
              <UnitSelect
                id={props.id}
                ariaLabel="Unità"
                value={newIngredientUnit}
                onChange={setNewIngredientUnit}
                placeholder="Seleziona unità..."
              />
            )}
          </Field>

          <Field label="Soglia minima" error={createErrors.threshold?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={createErrors.threshold?.message ? props.errorId : undefined}
                value={newIngredientThreshold}
                onChange={(e) => setNewIngredientThreshold(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Soglia minima"
                inputMode="decimal"
                min="0"
                className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.threshold)}`}
              />
            )}
          </Field>

          <Field label="Costo unità (€)" error={createErrors.unitCost?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={createErrors.unitCost?.message ? props.errorId : undefined}
                value={newIngredientUnitCost}
                onChange={(e) => setNewIngredientUnitCost(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Costo unità"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.unitCost)}`}
              />
            )}
          </Field>

          <Field label="Prezzo vendita (€)" error={createErrors.salePrice?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={createErrors.salePrice?.message ? props.errorId : undefined}
                value={newIngredientSalePrice}
                onChange={(e) => setNewIngredientSalePrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Prezzo vendita"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.salePrice)}`}
              />
            )}
          </Field>

          <label className="flex items-center gap-2 px-3 py-2 rounded border border-border text-xs font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newIngredientIsContainer}
              onChange={(e) => setNewIngredientIsContainer(e.target.checked)}
              className="accent-accent"
            />
            Contenitore
          </label>
        </div>
      </Modal>

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <div className="px-4 py-2 border-b border-border bg-accent/10 flex items-center gap-3">
          <span className="text-xs font-bold text-accent">{selectedItems.size} selezionati</span>
          <Button variant="secondary" onClick={() => void bulkDeactivate()}>
            Disattiva
          </Button>
          <Button variant="danger" onClick={() => void bulkDelete()}>
            <Trash2 size={12} className="inline mr-1" />
            Elimina
          </Button>
          <Button variant="secondary" onClick={() => setSelectedItems(new Set())} className="ml-auto">
            Deseleziona
          </Button>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg/50 border-b border-border">
              <th className="px-3 py-4 w-8">
                <input
                  type="checkbox"
                  checked={filteredInventory.length > 0 && selectedItems.size === filteredInventory.length}
                  onChange={toggleSelectAll}
                  className="accent-accent"
                  aria-label="Seleziona tutti gli ingredienti"
                />
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest w-8"></th>
              <th
                className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer select-none hover:text-secondary transition-colors"
                onClick={() => { setSortKey('name'); setSortAsc((p) => sortKey === 'name' ? !p : true); }}
              >
                <span className="inline-flex items-center gap-1">
                  Ingrediente
                  {sortKey === 'name' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </span>
              </th>
              {isSuppliersEnabled && (
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Fornitore</th>
              )}
              <th
                className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer select-none hover:text-secondary transition-colors"
                onClick={() => { setSortKey('quantity'); setSortAsc((p) => sortKey === 'quantity' ? !p : false); }}
              >
                <span className="inline-flex items-center gap-1">
                  Giacenza
                  {sortKey === 'quantity' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </span>
              </th>
              <th
                className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest cursor-pointer select-none hover:text-secondary transition-colors"
                onClick={() => { setSortKey('status'); setSortAsc((p) => sortKey === 'status' ? !p : false); }}
              >
                <span className="inline-flex items-center gap-1">
                  Stato
                  {sortKey === 'status' && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </span>
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredInventory.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-text-muted text-center" colSpan={isSuppliersEnabled ? 7 : 6}>
                  <LoadingOrEmpty
                    loading={loading}
                    icon={<Package size={24} />}
                    title={searchQuery ? 'Nessun ingrediente corrisponde alla ricerca.' : filterCategoryId ? 'Nessun ingrediente in questa categoria.' : 'Nessun ingrediente configurato.'}
                    description={!searchQuery && !filterCategoryId ? 'Crea il primo ingrediente per iniziare.' : undefined}
                  />
                </td>
              </tr>
            )}
            {filteredInventory.map((item) => {
              const isLow = item.quantity <= item.minThreshold;
              const isExpanded = expandedItems.has(item.id);
              return (
                <Fragment key={item.id}>
                  {/* Collapsed row — always visible */}
                  <tr
                    onClick={() => toggleExpanded(item.id)}
                    className={`transition-colors cursor-pointer group ${!item.isActive ? 'opacity-50' : 'hover:bg-bg/30'}`}
                  >
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="accent-accent"
                      />
                    </td>
                    <td className="px-3 py-4">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-text-muted" />
                      ) : (
                        <ChevronRight size={14} className="text-text-muted" />
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-bold text-secondary text-sm">{item.name}</p>
                      {item.salePrice != null && (
                        <p className="text-[10px] text-accent font-bold">€{item.salePrice.toFixed(2)} vendita</p>
                      )}
                    </td>
                    {isSuppliersEnabled && (
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-text-muted">
                          {item.supplierName ?? '-'}
                        </span>
                        {item.brandName && (
                          <p className="text-[10px] text-text-muted">{item.brandName}</p>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="font-bold text-primary text-sm">{item.quantity}</span>
                      <span className="text-[10px] text-text-muted ml-1 uppercase font-bold">{item.unit}</span>
                      <div className="mt-1 w-full bg-bg rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isLow ? 'bg-danger' : item.quantity <= item.minThreshold * 1.5 ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${Math.min(100, (item.quantity / (item.minThreshold * 2)) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isLow ? (
                        <StatusPill label="Scorta Bassa" tone="pending" />
                      ) : (
                        <StatusPill label="Ottimale" tone="success" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setAdjustTargetId(item.id); setAdjustDelta('0'); setAdjustNotes(''); }}>
                          Regola scorta
                        </Button>
                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); onCreateVariant?.(item.id); }}>
                          <ChefHat size={14} className="inline mr-1" />
                          Variante
                        </Button>
                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); setSelectedIngredientId(item.id); }}>
                          Modifica
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded details row */}
                  {isExpanded && (
                    <tr className="bg-bg/60 border-l-2 border-accent/30">
                      <td colSpan={isSuppliersEnabled ? 7 : 6} className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div>
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Soglia</p>
                            <p className="font-medium text-secondary text-sm">{item.minThreshold} {item.unit}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Costo</p>
                            <p className="font-medium text-secondary text-sm">€{(item.unitCost ?? 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Attivo</p>
                            <button
                              onClick={() => void toggleIngredientActive(item)}
                              className="inline-flex items-center gap-1 text-xs font-bold"
                              aria-label={`Attivo: ${item.isActive ? 'Si' : 'No'}`}
                            >
                              {item.isActive ? (
                                <ToggleRight size={18} className="text-accent" />
                              ) : (
                                <ToggleLeft size={18} className="text-text-muted" />
                              )}
                              <span className={item.isActive ? 'text-accent' : 'text-text-muted'}>
                                {item.isActive ? 'Si' : 'No'}
                              </span>
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Contenitore</p>
                            <button
                              onClick={() => void toggleContainer(item)}
                              className="inline-flex items-center gap-1 text-xs font-bold"
                              aria-label={`Contenitore: ${item.isContainer === 1 ? 'Si' : 'No'}`}
                            >
                              {item.isContainer === 1 ? (
                                <ToggleRight size={18} className="text-accent" />
                              ) : (
                                <ToggleLeft size={18} className="text-text-muted" />
                              )}
                              <span className={item.isContainer === 1 ? 'text-accent' : 'text-text-muted'}>
                                {item.isContainer === 1 ? 'Si' : 'No'}
                              </span>
                            </button>
                          </div>
                          <div className="flex gap-2 ml-auto">
                            <Button variant="secondary" onClick={() => openMovements(item.id)}>
                              <Eye size={14} className="inline mr-1" />
                              Movimenti
                            </Button>
                            <Button variant="danger" onClick={() => void removeIngredient(item.id)}>
                              Elimina
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border overflow-y-auto flex-1">
        {filteredInventory.length === 0 && (
          <div className="p-8 text-sm text-text-muted text-center">
            <LoadingOrEmpty
              loading={loading}
              icon={<Package size={24} />}
              title={searchQuery ? 'Nessun ingrediente corrisponde alla ricerca.' : filterCategoryId ? 'Nessun ingrediente in questa categoria.' : 'Nessun ingrediente configurato.'}
              description={!searchQuery && !filterCategoryId ? 'Crea il primo ingrediente per iniziare.' : undefined}
            />
          </div>
        )}
        {filteredInventory.map((item) => {
          const isLow = item.quantity <= item.minThreshold;
          const isExpanded = expandedItems.has(item.id);
          return (
            <div key={item.id} className={`${!item.isActive ? 'opacity-50' : ''}`}>
              {/* Collapsed header — always visible */}
              <button
                onClick={() => toggleExpanded(item.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-text-muted shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-primary text-sm truncate">{item.name}</p>
                    {item.salePrice != null && (
                      <p className="text-[9px] text-accent font-bold">€{item.salePrice.toFixed(2)} vendita</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-accent text-sm">{item.quantity} <span className="text-[10px] text-text-muted font-medium">{item.unit}</span></p>
                    <div className="mt-1 w-full bg-bg rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isLow ? 'bg-danger' : item.quantity <= item.minThreshold * 1.5 ? 'bg-warning' : 'bg-success'
                        }`}
                        style={{ width: `${Math.min(100, (item.quantity / (item.minThreshold * 2)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {isLow ? (
                    <StatusPill label="Bassa" tone="pending" />
                  ) : (
                    <StatusPill label="Ok" tone="success" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50 border-l-2 border-accent/30 ml-7">
                  <div className="flex gap-4 pt-3">
                    <div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Soglia</p>
                      <p className="font-medium text-secondary text-sm">{item.minThreshold} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Costo</p>
                      <p className="font-medium text-secondary text-sm">€{(item.unitCost ?? 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="secondary" onClick={() => openMovements(item.id)}>
                      Movimenti
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setAdjustTargetId(item.id);
                        setAdjustDelta('0');
                        setAdjustNotes('');
                      }}
                    >
                      Regola scorta
                    </Button>
                    <Button variant="secondary" onClick={() => setSelectedIngredientId(item.id)}>
                      Modifica
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => void toggleIngredientActive(item)}
                    >
                      {item.isActive ? (
                        <ToggleRight size={14} className="text-accent" />
                      ) : (
                        <ToggleLeft size={14} className="text-text-muted" />
                      )}
                      {item.isActive ? 'Attivo' : 'Inattivo'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!selectedIngredient}
        onClose={() => { setSelectedIngredientId(''); setSaveError(''); }}
        title={selectedIngredient ? `Editor: ${selectedIngredient.name}` : ''}
        size="md"
        dirty={editModalDirty}
        footer={
          <div className="flex items-center gap-2 w-full">
            {saveError && <p className="text-xs text-danger mr-auto">{saveError}</p>}
            <Button variant="primary" onClick={() => void saveIngredient()}>
              Salva ingrediente
            </Button>              {selectedIngredient && (
              <Button variant="danger" onClick={() => void removeIngredient(selectedIngredient.id)}>
                Elimina
              </Button>
            )}
            <Button variant="secondary" onClick={() => { setSelectedIngredientId(''); setConversions([]); }}>
              Annulla
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome" error={editErrors.name?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={editErrors.name?.message ? props.errorId : undefined}
                value={ingredientEditName}
                onChange={(e) => setIngredientEditName(e.target.value)}
                className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.name)}`}
              />
            )}
          </Field>
          <Field label="Quantità" error={editErrors.qty?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={editErrors.qty?.message ? props.errorId : undefined}
                value={ingredientEditQty}
                onChange={(e) => setIngredientEditQty(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                min="0"
                className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.qty)}`}
              />
            )}
          </Field>
          <Field label="Soglia minima" error={editErrors.threshold?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={editErrors.threshold?.message ? props.errorId : undefined}
                value={ingredientEditThreshold}
                onChange={(e) => setIngredientEditThreshold(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                min="0"
                className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.threshold)}`}
              />
            )}
          </Field>
          <Field label="Unità di misura">
            {(props) => (
              <UnitSelect
                id={props.id}
                ariaLabel="Unità di misura"
                value={ingredientEditUnit}
                onChange={setIngredientEditUnit}
              />
            )}
          </Field>
          <Field label="Costo unità (€)" error={editErrors.unitCost?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={editErrors.unitCost?.message ? props.errorId : undefined}
                value={ingredientEditUnitCost}
                onChange={(e) => setIngredientEditUnitCost(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                min="0"
                step="0.01"
                className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.unitCost)}`}
              />
            )}
          </Field>
          <Field label="Prezzo vendita (€)" error={editErrors.salePrice?.message}>
            {(props) => (
              <input
                id={props.id}
                aria-describedby={editErrors.salePrice?.message ? props.errorId : undefined}
                value={ingredientEditSalePrice}
                onChange={(e) => setIngredientEditSalePrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Opzionale"
                inputMode="decimal"
                min="0"
                step="0.01"
                className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.salePrice)}`}
              />
            )}
          </Field>
          <div className="md:col-span-2">
            <InlineCategoryPicker
              categories={ingredientCategories}
              selectedId={ingredientEditCategoryId}
              onSelect={setIngredientEditCategoryId}
              onCreate={async (name) => {
                if (onCreateCategory) await onCreateCategory({ name, scope: 'ingredient', printAreas: ['kitchen'] });
              }}
              label="Categoria"
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 rounded border border-border text-xs font-bold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ingredientEditIsContainer}
              onChange={(e) => setIngredientEditIsContainer(e.target.checked)}
              className="accent-accent"
            />
            Container
          </label>
          <div className="md:col-span-2 flex items-center gap-3 pt-2 border-t border-border">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Stato</span>
            {selectedIngredient && (
              <button
                onClick={() => void toggleIngredientActive(selectedIngredient)}
                className="inline-flex items-center gap-1 text-xs font-bold"
              >
                {selectedIngredient.isActive ? (
                  <ToggleRight size={20} className="text-accent" />
                ) : (
                  <ToggleLeft size={20} className="text-text-muted" />
                )}
                <span className={selectedIngredient.isActive ? 'text-accent' : 'text-text-muted'}>
                  {selectedIngredient.isActive ? 'Attivo' : 'Inattivo'}
                </span>
              </button>
            )}
          </div>
        </div>
          {selectedIngredient && (
            <div className="md:col-span-2 border-t border-border pt-3 mt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowLeftRight size={12} className="text-text-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  Conversioni unità di misura
                </p>
              </div>
              <UnitConversionManager
                ingredientName={selectedIngredient.name}
                ingredientUnit={ingredientEditUnit}
                conversions={conversions}
                onCreateConversion={async (fromUnit, factor) => {
                  const created = await createUnitConversion(selectedIngredient.id, {
                    fromUnit,
                    toUnit: ingredientEditUnit,
                    factor,
                  });
                  if (created) {
                    setConversions((prev) => [...prev, created]);
                  }
                }}
                onDeleteConversion={async (conversionId) => {
                  await deleteUnitConversion(selectedIngredient.id, conversionId);
                  setConversions((prev) => prev.filter((c) => c.id !== conversionId));
                }}
              />
            </div>
          )}

      </Modal>

      {/* Adjust Stock Modal */}
      <Modal
        open={!!adjustTargetId}
        onClose={() => setAdjustTargetId('')}
        title="Regolazione manuale stock"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => void submitAdjust()}
              disabled={adjustDelta === '0' || adjustDelta === ''}
            >
              Conferma
            </Button>
            <Button variant="secondary" onClick={() => setAdjustTargetId('')}>
              Annulla
            </Button>
          </div>
        }
      >
        {(() => {
          const item = inventory.find((i) => i.id === adjustTargetId);
          if (!item) return null;
          const delta = Number(adjustDelta) || 0;
          const newQty = item.quantity + delta;
          return (
            <>
              <div className="rounded-lg bg-bg/50 p-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Ingrediente</p>
                  <p className="text-sm font-bold text-primary">{item.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Stock attuale</p>
                  <p className="text-lg font-bold text-primary">{item.quantity} <span className="text-xs text-text-muted">{item.unit}</span></p>
                </div>
              </div>
              <Field label="Quantità (segno: + o −)">
                {(props) => (
                  <input
                    id={props.id}
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value.replace(/[^0-9.\-]/g, ''))}
                    className="px-3 py-2 rounded border border-border text-sm"
                    type="number"
                    step="any"
                    autoFocus
                  />
                )}
              </Field>
              {delta !== 0 && (
                <div className="rounded-lg border border-border p-2 flex items-center justify-between text-sm">
                  <span className="text-text-muted">{item.quantity} {item.unit}</span>
                  <span className="font-bold">{delta > 0 ? '+' : ''}{delta}</span>
                  <span className="font-bold text-primary">= {newQty} {item.unit}</span>
                </div>
              )}
              <Field label="Note (opzionale)">
                {(props) => (
                  <input
                    id={props.id}
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="px-3 py-2 rounded border border-border text-sm"
                  />
                )}
              </Field>
            </>
          );
        })()}
      </Modal>

      {/* Stock Movements Drawer */}
      <StockMovementsDrawer
        open={!!movementsIngredientId}
        ingredientName={movementsIngredient?.name ?? ''}
        movements={movements}
        onClose={() => setMovementsIngredientId('')}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirm}
        title="Conferma"
        message={confirm?.message ?? ''}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
