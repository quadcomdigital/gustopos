import type { Ingredient, BomItem, Category, BomCreateRequest, PrepItem } from '@gustopos/shared';
import { RotateCcw, Save, AlertTriangle, Search, Plus, ChevronDown, Layers } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../../shared/ui/molecules/Modal';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import UnitSelect from '../../shared/ui/molecules/UnitSelect';
import Button from '../../shared/ui/atoms/Button';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import Skeleton from '../../shared/ui/atoms/Skeleton';
import SegmentedChips from '../../shared/ui/atoms/SegmentedChips';
import { useScopedCategories, explodeBomCost } from './useInventoryShared';
import InlineCategoryPicker from './InlineCategoryPicker';
import RecipeBuilder from './RecipeBuilder';
import BomCards from './BomCards';
import { required, minLength, validNumber, getErrorClass, type ValidationErrors } from '../../shared/ui/hooks/useFieldValidation';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';
import EmptyState from '../../shared/ui/atoms/EmptyState';

const componentTypeLabel = (componentType: 'ingredient' | 'bom' | 'prep' | undefined) =>
  componentType === 'ingredient' ? 'Ingrediente' : componentType === 'prep' ? 'Preparato' : 'BoM';

interface BomTabProps {
  bomItems: BomItem[];
  prepItems: PrepItem[];
  inventory: Ingredient[];
  categories: Category[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onCreate?: (payload: BomCreateRequest) => Promise<void>;
  onUpdate?: (id: string, payload: { name?: string; unit?: string; yieldQuantity?: number; categoryId?: string; isActive?: boolean }) => Promise<void>;
  onReplaceComponents?: (id: string, payload: { components: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
  onAddComponent?: (id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }) => Promise<void>;
  onRemoveComponent?: (id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreateCategory?: (payload: { name: string; scope: 'ingredient' | 'bom' | 'menu'; printAreas: Array<'kitchen' | 'bar' | 'cashier'> }) => Promise<void>;
}

export default function BomTab({
  bomItems,
  prepItems,
  inventory,
  categories,
  loading = false,
  onRefresh,
  onCreate,
  onUpdate,
  onAddComponent,
  onRemoveComponent,
  onReplaceComponents,
  onDelete,
  onCreateCategory,
}: BomTabProps) {
  const [selectedBomId, setSelectedBomId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [bomEditName, setBomEditName] = useState('');
  const [bomEditCategoryId, setBomEditCategoryId] = useState('');
  const [bomEditUnit, setBomEditUnit] = useState('kg');
  const [bomEditYield, setBomEditYield] = useState('1');

  const [newBomName, setNewBomName] = useState('');
  const [newBomCategoryId, setNewBomCategoryId] = useState('');
  const [newBomUnit, setNewBomUnit] = useState('kg');
  const [newBomYield, setNewBomYield] = useState('1');
  const [newBomComponents, setNewBomComponents] = useState<Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }>>([]);

  const [createComponentType, setCreateComponentType] = useState<'ingredient' | 'bom' | 'prep'>('ingredient');
  const [createComponentId, setCreateComponentId] = useState('');
  const [createComponentQty, setCreateComponentQty] = useState('1');
  const [createComponentUnit, setCreateComponentUnit] = useState('kg');
  const [createErrors, setCreateErrors] = useState<ValidationErrors>({});
  const [showCreateForm, setShowCreateForm] = useState(false);

  const bomCategories = useScopedCategories(categories, 'bom');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const { confirm, requestConfirm, handleConfirm, handleCancel } = useConfirm();

  const chipOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of bomItems) {
      const catId = item.categoryId ?? '__none__';
      counts.set(catId, (counts.get(catId) ?? 0) + 1);
    }
    return [
      { value: '', label: 'Tutte', badge: bomItems.length },
      ...bomCategories.map((c) => ({ value: c.id, label: c.name, badge: counts.get(c.id) ?? 0 })),
    ];
  }, [bomItems, bomCategories]);

  const filteredBomItems = useMemo(() => {
    let result = filterCategoryId ? bomItems.filter((b) => b.categoryId === filterCategoryId) : bomItems;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q));
    }
    return result;
  }, [bomItems, filterCategoryId, searchQuery]);

  const selectedBom = useMemo(
    () => bomItems.find((item) => item.id === selectedBomId) ?? null,
    [bomItems, selectedBomId],
  );

  const editModalDirty = useMemo(() => {
    if (!selectedBom) return false;
    // Note: recipe changes auto-save via onReplaceComponents, not tracked here
    return (
      bomEditName.trim() !== selectedBom.name
      || bomEditCategoryId !== (selectedBom.categoryId ?? '')
      || bomEditUnit !== selectedBom.unit
      || bomEditYield !== String(selectedBom.yieldQuantity)
    );
  }, [selectedBom, bomEditName, bomEditCategoryId, bomEditUnit, bomEditYield]);

  const ingredientNameById = useMemo(() => new Map(inventory.map((i) => [i.id, i.name])), [inventory]);
  const bomNameById = useMemo(() => new Map(bomItems.map((b) => [b.id, b.name])), [bomItems]);
  const prepNameById = useMemo(() => new Map(prepItems.map((p) => [p.id, p.name])), [prepItems]);

  const componentName = (componentType: string, componentId: string) => {
    if (componentType === 'ingredient') return ingredientNameById.get(componentId) ?? componentId;
    if (componentType === 'prep') return prepNameById.get(componentId) ?? componentId;
    return bomNameById.get(componentId) ?? componentId;
  };

  const createComponentCandidates = useMemo(() => {
    if (createComponentType === 'ingredient') {
      return inventory.map((item) => ({ id: item.id, label: item.name, unit: item.unit, stockLevel: item.quantity, unitCost: item.unitCost }));
    }
    if (createComponentType === 'prep') {
      return prepItems.map((item) => ({ id: item.id, label: item.name, unit: item.unit, stockLevel: item.stockQuantity }));
    }
    return bomItems.map((item) => ({ id: item.id, label: item.name, unit: item.unit }));
  }, [createComponentType, inventory, bomItems, prepItems]);

  useEffect(() => {
    if (!selectedBom) return;
    setBomEditName(selectedBom.name);
    setBomEditCategoryId(selectedBom.categoryId ?? '');
    setBomEditUnit(selectedBom.unit);
    setBomEditYield(String(selectedBom.yieldQuantity));
  }, [selectedBom]);

  const addCreateComponent = () => {
    const qty = Number(createComponentQty);
    if (!createComponentId || !Number.isFinite(qty) || qty <= 0) return;
    setNewBomComponents((prev) => [
      ...prev,
      { componentType: createComponentType, componentId: createComponentId, quantity: qty, unit: createComponentUnit },
    ]);
    setCreateComponentId('');
    setCreateComponentQty('1');
  };

  const removeCreateComponent = (index: number) => {
    setNewBomComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const createBom = async (): Promise<boolean> => {
    if (!onCreate) return false;
    const errors: ValidationErrors = {};
    errors.name = required(newBomName, 'Nome') ?? minLength(newBomName, 2, 'Nome');
    errors.yield = validNumber(newBomYield);
    setCreateErrors(errors);
    if (Object.values(errors).some(Boolean)) return false;
    if (newBomComponents.length === 0) return false;
    const yieldQuantity = Number(newBomYield);
    try {
      await onCreate({
        name: newBomName.trim(),
        unit: newBomUnit,
        yieldQuantity,
        categoryId: newBomCategoryId || undefined,
        isContainer: 0,
        isPreBatched: 0,
        components: newBomComponents,
// CASCADE_BOMTAB_PAYLOAD_DONE
      });
      setNewBomName('');
      setNewBomYield('1');
      setNewBomCategoryId('');
      setNewBomComponents([]);
      setCreateErrors({});
      setShowCreateForm(false);
      void onRefresh?.();
      return true;
    } catch {
      return false;
    }
  };

  const [editErrors, setEditErrors] = useState<ValidationErrors>({});

  const saveBomMetadata = async () => {
    if (!selectedBom || !onUpdate) return;
    const errors: ValidationErrors = {};
    errors.name = required(bomEditName, 'Nome') ?? minLength(bomEditName, 2, 'Nome');
    errors.yield = validNumber(bomEditYield);
    setEditErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const yieldQuantity = Number(bomEditYield);
    await onUpdate(selectedBom.id, {
      name: bomEditName.trim(),
      unit: bomEditUnit,
      yieldQuantity,
      categoryId: bomEditCategoryId || undefined,
    });
    void onRefresh?.();
  };

  const removeBom = async (id: string) => {
    if (!onDelete) return;
    requestConfirm('Eliminare questo elemento composto?', async () => {
      await onDelete(id);
      if (selectedBomId === id) setSelectedBomId('');
      void onRefresh?.();
    });
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[400px]">
      <SectionHeader
        title="Elementi Composti (BoM)"
        actions={
          <Button variant="secondary" onClick={() => void onRefresh?.()}>
            <RotateCcw size={14} />
            Refresh
          </Button>
        }
      />
      <div className="px-4 py-2 border-b border-border bg-bg/20">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca elemento..."
            className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
          />
        </div>
      </div>

      {bomCategories.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-bg/20">
          <SegmentedChips
            ariaLabel="Filtra BoM per categoria"
            value={filterCategoryId}
            onChange={setFilterCategoryId}
            options={chipOptions}
            size="sm"
          />
        </div>
      )}

      {/* Mobile Cards */}
      <div className="md:hidden overflow-auto flex-1">
        {filteredBomItems.length === 0 ? (
          <div className="p-8 text-sm text-text-muted text-center">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <EmptyState
                icon={<Layers size={24} />}
                title={searchQuery ? 'Nessun elemento corrisponde alla ricerca.' : 'Nessun elemento composto configurato.'}
                description={!searchQuery ? 'Crea il primo elemento composto per iniziare.' : undefined}
              />
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            <BomCards
              items={filteredBomItems}
              inventory={inventory}
              prepItems={prepItems}
              onEdit={(id) => setSelectedBomId(id)}
              onDelete={(id) => void removeBom(id)}
              onToggleActive={(id, active) => void onUpdate?.(id, { isActive: active })}
            />
          </div>
        )}
      </div>

      <div className="overflow-auto flex-1 hidden md:block">
        {/* Create Form Toggle */}
        <div className="border-b border-border bg-bg/20">
          <button
            onClick={() => setShowCreateForm((p) => !p)}
            className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-bg/30 transition-colors"
          >
            <Plus size={16} className="text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">Nuovo elemento composto</span>
            <ChevronDown size={14} className={`ml-auto text-text-muted transition-transform ${showCreateForm ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
        <div className="px-4 py-3 border-b border-border bg-bg/20 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <input
                value={newBomName}
                onChange={(e) => setNewBomName(e.target.value)}
                placeholder="Nome composto (es: Impasto Pizza)"
                className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(createErrors.name)}`}
              />
              {createErrors.name && <p className="text-[9px] text-danger mt-0.5">{createErrors.name.message}</p>}
            </div>
            <UnitSelect
              value={newBomUnit}
              onChange={setNewBomUnit}
              placeholder="Unità"
            />
            <div>
              <input
                value={newBomYield}
                onChange={(e) => setNewBomYield(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Quantità prodotta (reso)"
                inputMode="decimal"
                min="0.01"
                step="0.1"
                aria-label="Quantità prodotta"
                className={`px-3 py-2 rounded border border-border text-sm w-full ${getErrorClass(createErrors.yield)}`}
              />
              {createErrors.yield && <p className="text-[9px] text-danger mt-0.5">{createErrors.yield.message}</p>}
            </div>
            <SearchableSelect
              items={bomCategories}
              getLabel={(cat) => cat.name}
              getValue={(cat) => cat.id}
              selectedValue={newBomCategoryId}
              onSelect={setNewBomCategoryId}
              placeholder="Categoria BoM"
            />
            <Button
              variant="primary"
              onClick={() => void createBom()}
              disabled={newBomComponents.length === 0}
            >
              <Save size={14} />
              Crea BoM
            </Button>
          </div>

          {/* Component Picker for creation */}
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={createComponentType}
              onChange={(e) => { setCreateComponentType(e.target.value as 'ingredient' | 'bom' | 'prep'); setCreateComponentId(''); }}
              className="px-3 py-2 rounded border border-border text-sm"
            >
              <option value="ingredient">Ingrediente</option>
              <option value="bom">BoM</option>
              <option value="prep">Preparato</option>
            </select>
            <SearchableSelect
              items={createComponentCandidates}
              getLabel={(c) => c.label}
              getValue={(c) => c.id}
              selectedValue={createComponentId}
              onSelect={(id) => {
                setCreateComponentId(id);
                const candidate = createComponentCandidates.find((c) => c.id === id);
                if (candidate) setCreateComponentUnit(candidate.unit);
              }}
              placeholder="Seleziona..."
              className="flex-1 min-w-[150px]"
            />
            <input
              value={createComponentQty}
              onChange={(e) => setCreateComponentQty(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Qty"
              className="w-20 px-3 py-2 rounded border border-border text-sm"
            />
            <UnitSelect
              value={createComponentUnit}
              onChange={setCreateComponentUnit}
              placeholder="Unità"
              className="w-28"
            />
            <Button
              variant="secondary"
              onClick={addCreateComponent}
              disabled={!createComponentId}
            >
              Aggiungi
            </Button>
          </div>

          {newBomComponents.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newBomComponents.map((comp, idx) => {
                const candidate = createComponentCandidates.find((c) => c.id === comp.componentId);
                const ing = comp.componentType === 'ingredient' ? inventory.find((i) => i.id === comp.componentId) : undefined;
                const isInactive = ing && !ing.isActive;
                return (
                  <span key={`${comp.componentId}-${idx}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium text-secondary ${isInactive ? 'bg-amber-50 border-amber-300' : 'bg-bg border-border'}`}>
                    {isInactive && <AlertTriangle size={10} className="text-amber-600" />}
                    <span className="font-bold uppercase text-[9px]">{componentTypeLabel(comp.componentType)}</span>
                    {candidate?.label ?? comp.componentId} · {comp.quantity} {comp.unit}
                    <button onClick={() => removeCreateComponent(idx)} className="ml-1 px-2 py-1.5 text-danger font-bold text-xs">x</button>
                  </span>
                );
              })}
            </div>
          )}
          {newBomComponents.length === 0 && (
            <p className="text-[10px] text-text-muted">Aggiungi almeno un componente prima di creare il BoM.</p>
          )}

        </div>
        )}

        {/* BoM List */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg/50 border-b border-border">
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Elemento</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Resa</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Componenti</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Costo</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Stato</th>
              <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredBomItems.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-text-muted text-center" colSpan={6}>
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Layers size={24} />}
                      title={searchQuery ? 'Nessun elemento corrisponde alla ricerca.' : 'Nessun elemento composto configurato.'}
                      description={!searchQuery ? 'Crea il primo elemento composto per iniziare.' : undefined}
                    />
                  )}
                </td>
              </tr>
            )}
            {filteredBomItems.map((item) => {
              const totalCost = explodeBomCost(item.components, inventory, bomItems, prepItems);
              const costPerUnit = item.yieldQuantity > 0 ? totalCost / item.yieldQuantity : 0;
              const inactiveCount = item.components.filter(
                (c) => c.componentType === 'ingredient' && !inventory.find((i) => i.id === c.componentId)?.isActive
              ).length;
              return (
                <tr key={item.id} className="hover:bg-bg/30 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-secondary text-sm">{item.name}</p>
                    {inactiveCount > 0 && (
                      <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={10} />
                        {inactiveCount} componente/i inattivo/i
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary">
                    {item.yieldQuantity} {item.unit}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {item.components.map((component) => (
                        <p key={component.id} className="text-xs text-secondary">
                          <span className="font-bold uppercase text-[10px] mr-2">{componentTypeLabel(component.componentType)}</span>
                          {componentName(component.componentType, component.componentId)} · {component.quantity} {component.unit}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-secondary">€{costPerUnit.toFixed(2)}/{item.unit}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {item.isActive ? (
                        <StatusPill label="Attivo" tone="success" />
                      ) : (
                        <StatusPill label="Disattivo" tone="neutral" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => void onUpdate?.(item.id, { isActive: !item.isActive })}
                      >
                        {item.isActive ? 'Disattiva' : 'Attiva'}
                      </Button>
                      <Button variant="secondary" onClick={() => setSelectedBomId(item.id)}>
                        Modifica
                      </Button>
                      <Button variant="danger" onClick={() => void removeBom(item.id)}>
                        Elimina
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!selectedBom}
        onClose={() => setSelectedBomId('')}
        title={selectedBom ? `Editor BoM: ${selectedBom.name}` : ''}
        size="lg"
        dirty={editModalDirty}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedBomId('')}>
              Chiudi
            </Button>
          </>
        }
      >
        {selectedBom && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Nome</label>
                <input
                  value={bomEditName}
                  onChange={(e) => setBomEditName(e.target.value)}
                  className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.name)}`}
                />
                {editErrors.name && <p className="text-[9px] text-danger">{editErrors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Unità</label>
                <UnitSelect
                  value={bomEditUnit}
                  onChange={setBomEditUnit}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Resa</label>
                <input
                  value={bomEditYield}
                  onChange={(e) => setBomEditYield(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  min="0.01"
                  step="0.1"
                  aria-label="Resa"
                  className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.yield)}`}
                />
                {editErrors.yield && <p className="text-[9px] text-danger">{editErrors.yield.message}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Categoria</label>
                <InlineCategoryPicker
                  categories={bomCategories}
                  selectedId={bomEditCategoryId}
                  onSelect={setBomEditCategoryId}
                  onCreate={async (name) => {
                    if (onCreateCategory) await onCreateCategory({ name, scope: 'bom', printAreas: ['kitchen'] });
                  }}
                  label=""
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={() => void saveBomMetadata()}>
                <Save size={14} />
                Salva dettagli
              </Button>
              <Button
                variant="ghost"
                onClick={() => void onUpdate?.(selectedBom.id, { isActive: !selectedBom.isActive })}
              >
                {selectedBom.isActive ? 'Disattiva' : 'Attiva'}
              </Button>
              <Button variant="danger" onClick={() => void removeBom(selectedBom.id)}>
                Elimina
              </Button>
            </div>

            <RecipeBuilder
              components={selectedBom.components.map((c) => ({
                componentType: c.componentType as 'ingredient' | 'bom' | 'prep',
                componentId: c.componentId,
                quantity: c.quantity,
                unit: c.unit,
              }))}
              inventory={inventory}
              bomItems={bomItems.filter((b) => b.id !== selectedBom.id)}
              prepItems={prepItems}
              onChange={(updated) => {
                if (!onReplaceComponents) return;
                void onReplaceComponents(selectedBom.id, { components: updated });
              }}
              showCost
              bomItemId={selectedBom.id}
            />
          </>
        )}
      </Modal>

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
