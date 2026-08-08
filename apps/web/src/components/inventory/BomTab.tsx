import type { Ingredient, BomItem, Category, BomCreateRequest, PrepItem, UnitConversion } from '@gustopos/shared';
import { RotateCcw, Save, AlertTriangle, Plus, Layers } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Modal from '../../shared/ui/molecules/Modal';
import TabTemplate from '../../shared/ui/molecules/TabTemplate';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import UnitSelect from '../../shared/ui/molecules/UnitSelect';
import Button from '../../shared/ui/atoms/Button';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import { useAppStore } from '../../store/app-store';
import { useScopedCategories, explodeBomCost } from './useInventoryShared';
import InlineCategoryPicker from './InlineCategoryPicker';
import RecipeBuilder from './RecipeBuilder';
import BomCards from './BomCards';
import Field from '../../shared/ui/atoms/Field';
import { required, minLength, validNumber, getErrorClass, type ValidationErrors } from '../../shared/ui/hooks/useFieldValidation';
import LoadingOrEmpty from '../../shared/ui/molecules/LoadingOrEmpty';
import { useConfirm } from '../../shared/ui/hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';

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
  onUpdate?: (id: string, payload: { name?: string; outputUnit?: string; yieldQuantity?: number; categoryId?: string; isActive?: boolean }) => Promise<void>;
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
  onAddComponent: _onAddComponent,
  onRemoveComponent: _onRemoveComponent,
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

  // ─── Conversions cache for unit selectors ────────────────────────────────
  const fetchUnitConversionsStore = useAppStore((s) => s.fetchUnitConversions);
  const [conversionsMap, setConversionsMap] = useState<Record<string, UnitConversion[]>>({});
  useEffect(() => {
    if (inventory.length === 0) { setConversionsMap({}); /* eslint-disable-line react-hooks/set-state-in-effect -- [literal-reset] reset conversions when inventory empties */ return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        inventory.map(async (ing) => {
          const convs = await fetchUnitConversionsStore(ing.id).catch(() => [] as UnitConversion[]);
          return [ing.id, convs] as [string, UnitConversion[]];
        }),
      );
      if (!cancelled) setConversionsMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [inventory, fetchUnitConversionsStore]);

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
      ||       bomEditUnit !== selectedBom.outputUnit
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
      return prepItems.map((item) => ({ id: item.id, label: item.name, unit: item.outputUnit, stockLevel: item.stockQuantity }));
    }
    return bomItems.map((item) => ({ id: item.id, label: item.name, unit: item.outputUnit }));
  }, [createComponentType, inventory, bomItems, prepItems]);

  useEffect(() => {
    if (!selectedBom) return;
    setBomEditName(selectedBom.name); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize BoM edit fields from selected item; all values are primitives
    setBomEditCategoryId(selectedBom.categoryId ?? '');  
    setBomEditUnit(selectedBom.outputUnit);  
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
    setSaving(true);
    try {
      await onCreate({
        name: newBomName.trim(),
        outputUnit: newBomUnit,
        yieldQuantity,            categoryId: newBomCategoryId || undefined,
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
    } finally {
      setSaving(false);
    }
  };

  const [editErrors, setEditErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);

  const saveBomMetadata = async () => {
    if (!selectedBom || !onUpdate) return;
    const errors: ValidationErrors = {};
    errors.name = required(bomEditName, 'Nome') ?? minLength(bomEditName, 2, 'Nome');
    errors.yield = validNumber(bomEditYield);
    setEditErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    const yieldQuantity = Number(bomEditYield);
    setSaving(true);
    try {
      await onUpdate(selectedBom.id, {
        name: bomEditName.trim(),
        outputUnit: bomEditUnit,
        yieldQuantity,
        categoryId: bomEditCategoryId || undefined,
      });
      void onRefresh?.();
    } catch {
      // Error already handled by store
    } finally {
      setSaving(false);
    }
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
    <>
      <TabTemplate
        title="Elementi Composti (BoM)"
        headerActions={
          <>
            <Button variant="secondary" onClick={() => setShowCreateForm(true)}>
              <Plus size={14} />
              Nuovo BoM
            </Button>
            <Button variant="secondary" onClick={() => void onRefresh?.()}>
              <RotateCcw size={14} />
              Refresh
            </Button>
          </>
        }
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Cerca elemento..."
        chips={{
          ariaLabel: 'Filtra BoM per categoria',
          value: filterCategoryId,
          onChange: setFilterCategoryId,
          options: chipOptions,
        }}
        noScroll
      >

      {/* Mobile Cards */}
      <div className="md:hidden overflow-auto flex-1">
        {filteredBomItems.length === 0 ? (
          <div className="p-8 text-sm text-text-muted text-center">
            <LoadingOrEmpty
              loading={loading}
              icon={<Layers size={24} />}
              title={searchQuery ? 'Nessun elemento corrisponde alla ricerca.' : 'Nessun elemento composto configurato.'}
              description={!searchQuery ? 'Crea il primo elemento composto per iniziare.' : undefined}
            />
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
                  <LoadingOrEmpty
                    loading={loading}
                    icon={<Layers size={24} />}
                    title={searchQuery ? 'Nessun elemento corrisponde alla ricerca.' : 'Nessun elemento composto configurato.'}
                    description={!searchQuery ? 'Crea il primo elemento composto per iniziare.' : undefined}
                  />
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
                      <p className="text-[9px] text-warning-600 font-bold flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={10} />
                        {inactiveCount} componente/i inattivo/i
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-primary">
                    {item.yieldQuantity} {item.outputUnit}
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
                    <span className="text-xs font-medium text-secondary">€{costPerUnit.toFixed(2)}/{item.outputUnit}</span>
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
      </TabTemplate>

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
              <Field label="Nome" error={editErrors.name?.message}>
                {(props) => (
                  <input
                    id={props.id}
                    aria-describedby={editErrors.name?.message ? props.errorId : undefined}
                    value={bomEditName}
                    onChange={(e) => setBomEditName(e.target.value)}
                    className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.name)}`}
                  />
                )}
              </Field>
              <Field label="Unità">
                {(props) => (
                  <UnitSelect
                    id={props.id}
                    ariaLabel="Unità"
                    value={bomEditUnit}
                    onChange={setBomEditUnit}
                  />
                )}
              </Field>
              <Field label="Resa" error={editErrors.yield?.message}>
                {(props) => (
                  <input
                    id={props.id}
                    aria-label="Resa"
                    aria-describedby={editErrors.yield?.message ? props.errorId : undefined}
                    value={bomEditYield}
                    onChange={(e) => setBomEditYield(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    min="0.01"
                    step="0.1"
                    className={`px-3 py-2 rounded border border-border text-sm ${getErrorClass(editErrors.yield)}`}
                  />
                )}
              </Field>
              <InlineCategoryPicker
                categories={bomCategories}
                selectedId={bomEditCategoryId}
                onSelect={setBomEditCategoryId}
                onCreate={async (name) => {
                  if (onCreateCategory) await onCreateCategory({ name, scope: 'bom', printAreas: ['kitchen'] });
                }}
                label="Categoria"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={() => void saveBomMetadata()} disabled={saving}>
                <Save size={14} />
                {saving ? 'Salvataggio...' : 'Salva dettagli'}
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
              onReplaceBomComponents={onReplaceComponents}
              showCost
              bomItemId={selectedBom.id}
              conversionsMap={conversionsMap}
            />
          </>
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        open={showCreateForm}
        onClose={() => { setShowCreateForm(false); setNewBomComponents([]); setCreateErrors({}); }}
        title="Nuovo elemento composto (BoM)"
        size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setShowCreateForm(false); setNewBomComponents([]); setCreateErrors({}); }}>
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => void createBom()}
              disabled={saving || newBomComponents.length === 0}
            >
              <Save size={14} />
              {saving ? 'Creazione...' : 'Crea BoM'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Nome" error={createErrors.name?.message} className="w-full">
              {(props) => (
                <input
                  id={props.id}
                  aria-describedby={createErrors.name?.message ? props.errorId : undefined}
                  value={newBomName}
                  onChange={(e) => setNewBomName(e.target.value)}
                  placeholder="es: Impasto Pizza"
                  className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.name)}`}
                />
              )}
            </Field>
            <Field label="Unità">
              {(props) => (
                <UnitSelect
                  id={props.id}
                  ariaLabel="Unità"
                  value={newBomUnit}
                  onChange={setNewBomUnit}
                />
              )}
            </Field>
            <Field label="Resa" error={createErrors.yield?.message} className="w-full">
              {(props) => (
                <input
                  id={props.id}
                  aria-describedby={createErrors.yield?.message ? props.errorId : undefined}
                  value={newBomYield}
                  onChange={(e) => setNewBomYield(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Quantità prodotta"
                  inputMode="decimal"
                  min="0.01"
                  step="0.1"
                  className={`w-full px-3 py-2 rounded border border-border text-sm ${getErrorClass(createErrors.yield)}`}
                />
              )}
            </Field>
            <Field label="Categoria">
              {(props) => (
                <SearchableSelect
                  id={props.id}
                  ariaLabel="Categoria"
                  items={bomCategories}
                  getLabel={(cat) => cat.name}
                  getValue={(cat) => cat.id}
                  selectedValue={newBomCategoryId}
                  onSelect={setNewBomCategoryId}
                  placeholder="Seleziona..."
                />
              )}
            </Field>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Componenti</p>

            <div className="flex flex-wrap items-end gap-2 mb-3">
              <select
                value={createComponentType}
                onChange={(e) => { setCreateComponentType(e.target.value as 'ingredient' | 'bom' | 'prep'); setCreateComponentId(''); }}
                aria-label="Tipo Componente"
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
                placeholder="Seleziona componente..."
                ariaLabel="Seleziona componente"
                className="flex-1 min-w-[150px]"
              />
              <input
                value={createComponentQty}
                onChange={(e) => setCreateComponentQty(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Qty"
                aria-label="Quantità componente"
                className="w-20 px-3 py-2 rounded border border-border text-sm"
              />
              <UnitSelect
                value={createComponentUnit}
                onChange={setCreateComponentUnit}
                placeholder="Unità"
                ariaLabel="Unità componente"
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
              <div className="flex flex-wrap gap-2 mb-2">
                {newBomComponents.map((comp, idx) => {
                  const candidate = createComponentCandidates.find((c) => c.id === comp.componentId);
                  const ing = comp.componentType === 'ingredient' ? inventory.find((i) => i.id === comp.componentId) : undefined;
                  const isInactive = ing && !ing.isActive;
                  return (
                    <span key={`${comp.componentId}-${idx}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium text-secondary ${isInactive ? 'bg-warning-50 border-warning-300' : 'bg-bg border-border'}`}>
                      {isInactive && <AlertTriangle size={10} className="text-warning-600" />}
                      <span className="font-bold uppercase text-[9px]">{componentTypeLabel(comp.componentType)}</span>
                      {candidate?.label ?? comp.componentId} · {comp.quantity} {comp.unit}
                      <button onClick={() => removeCreateComponent(idx)} className="ml-1 text-danger font-bold text-xs">✕</button>
                    </span>
                  );
                })}
              </div>
            )}
            {newBomComponents.length === 0 && (
              <p className="text-xs text-text-muted italic">Aggiungi almeno un componente prima di creare il BoM.</p>
            )}
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
    </>
  );
}
