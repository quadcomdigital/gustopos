import { useState, useMemo, useEffect } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent, UnitConversion } from '@gustopos/shared';
import { Plus, Trash2, AlertTriangle, ChevronRight, ChevronUp, ChevronDown, Leaf, ChefHat, Layers, ExternalLink } from 'lucide-react';
import ComponentPicker from './ComponentPicker';
import UnitSelect from '../../shared/ui/molecules/UnitSelect';
import ConversionHint from './ConversionHint';
import RecipeTreeView from './RecipeTreeView';

interface RecipeBuilderProps {
  components: MenuRecipeComponent[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems?: PrepItem[];
  onChange: (components: MenuRecipeComponent[]) => void;
  showCost?: boolean;
  bomItemId?: string;
  /** Called when user clicks 'Apri in BoM' quick-link */
  onOpenBomTab?: (bomId: string) => void;
  /** Called to edit sub-components inside an expanded BoM */
  onReplaceBomComponents?: (bomId: string, payload: { components: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }> }) => Promise<void>;
  /** Map of ingredientId → unit conversions for the unit dropdown */
  conversionsMap?: Record<string, UnitConversion[]>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function quantityString(qty: number): string {
  return String(Number.isFinite(qty) ? qty : 0);
}

// ─── ComponentRow (extracted as proper React component to use hooks) ───────

interface ComponentRowProps {
  comp: MenuRecipeComponent;
  idx: number;
  totalComponents: number;
  inventoryById: Map<string, Ingredient>;
  bomNameById: Map<string, string>;
  prepNameById: Map<string, string>;
  ingredientById: Map<string, Ingredient>;
  bomItems: BomItem[];
  prepItems: PrepItem[];
  expandedBoms: Set<string>;
  showCost: boolean;
  onToggleExpand: (bomId: string) => void;
  onMoveComponent: (index: number, direction: -1 | 1) => void;
  onUpdateQty: (componentType: 'ingredient' | 'bom' | 'prep', componentId: string, qty: number) => void;
  onRemove: (componentType: 'ingredient' | 'bom' | 'prep', componentId: string) => void;
}

// ─── SubComponentRow for BoM sub-components (controlled input, no silent failures) ─

interface SubComponentRowProps {
  subComp: { componentType: string; componentId: string; quantity: number; unit: string };
  bomId: string;
  inventory: Ingredient[];
  prepItems: PrepItem[];
  bomItems: BomItem[];
  conversionsMap: Record<string, UnitConversion[]>;
  onUpdate: (bomId: string, action: 'update', payload: { componentType: string; componentId: string; quantity: number; unit: string }) => void;
  onRemove: (bomId: string, action: 'remove', payload: { componentType: string; componentId: string }) => void;
}

function SubComponentRow({
  subComp, bomId, inventory, prepItems, bomItems, conversionsMap,
  onUpdate, onRemove,
}: SubComponentRowProps) {
  const [localQty, setLocalQty] = useState<string>(quantityString(subComp.quantity));

  useEffect(() => {
    setLocalQty(quantityString(subComp.quantity));
  }, [subComp.quantity]);

  const subName =
    subComp.componentType === 'ingredient'
      ? inventory.find((i) => i.id === subComp.componentId)?.name ?? subComp.componentId
      : subComp.componentType === 'prep'
        ? prepItems.find((p) => p.id === subComp.componentId)?.name ?? subComp.componentId
        : bomItems.find((b) => b.id === subComp.componentId)?.name ?? subComp.componentId;

  const subIcon = subComp.componentType === 'prep'
    ? <ChefHat size={10} className="text-blue-600" />
    : subComp.componentType === 'bom'
      ? <Layers size={10} className="text-purple-600" />
      : <Leaf size={10} className="text-green-600" />;

  const commit = () => {
    const v = Number(localQty);
    if (Number.isFinite(v) && v > 0) {
      onUpdate(bomId, 'update', {
        componentType: subComp.componentType,
        componentId: subComp.componentId,
        quantity: v,
        unit: subComp.unit,
      });
    } else {
      setLocalQty(quantityString(subComp.quantity));
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white border border-border/70 hover:border-border transition-colors group">
      {subIcon}
      <span className="text-[11px] text-secondary truncate flex-1 min-w-0">{subName}</span>
      <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted px-1 py-0.5 rounded bg-bg/50 shrink-0">
        {subComp.componentType === 'prep' ? 'Prep' : subComp.componentType === 'bom' ? 'BoM' : 'Ingred'}
      </span>
      <input
        type="number"
        value={localQty}
        onChange={(e) => setLocalQty(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-14 px-1.5 py-0.5 rounded border border-border text-[10px] text-center"
        min="0.001"
        step="0.001"
      />
      <span className="text-[9px] text-text-muted shrink-0">{subComp.unit}</span>
      {subComp.componentType === 'ingredient' && (
        <ConversionHint
          conversions={conversionsMap[subComp.componentId] ?? []}
          canonicalUnit={subComp.unit}
        />
      )}
      <button
        type="button"
        onClick={() => onRemove(bomId, 'remove', {
          componentType: subComp.componentType,
          componentId: subComp.componentId,
        })}
        className="p-1 text-text-muted hover:text-danger hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Rimuovi componente"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function ComponentRow({
  comp, idx, totalComponents, inventoryById, bomNameById, prepNameById, ingredientById,
  bomItems, prepItems, expandedBoms, showCost,
  onToggleExpand, onMoveComponent, onUpdateQty, onRemove,
}: ComponentRowProps) {
  const [localQty, setLocalQty] = useState<string>(quantityString(comp.quantity));

  useEffect(() => {
    setLocalQty(quantityString(comp.quantity));
  }, [comp.quantity]);

  const ing = comp.componentType === 'ingredient' ? inventoryById.get(comp.componentId) : undefined;
  const isInactive = ing && !ing.isActive;
  const name = comp.componentType === 'ingredient'
    ? (ing?.name ?? comp.componentId)
    : comp.componentType === 'prep'
      ? (prepNameById.get(comp.componentId) ?? comp.componentId)
      : (bomNameById.get(comp.componentId) ?? comp.componentId);
  const isBom = comp.componentType === 'bom';
  const bom = isBom ? bomItems.find((b) => b.id === comp.componentId) : null;
  const isExpanded = isBom && expandedBoms.has(comp.componentId);
  const canExpand = isBom && !!bom && bom.components.length > 0;
  const visual = comp.componentType === 'ingredient'
    ? { Icon: Leaf, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Ingrediente' }
    : comp.componentType === 'prep'
      ? { Icon: ChefHat, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Preparato' }
      : { Icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', label: 'Composto' };
  const IconComponent = visual.Icon;

  const lineCost = showCost ? (
    comp.componentType === 'ingredient' && ing?.unitCost
      ? comp.quantity * ing.unitCost
      : comp.componentType === 'prep'
        ? (() => {
            const prep = prepItems.find((p) => p.id === comp.componentId);
            if (!prep) return undefined;
            const prepIng = ingredientById.get(prep.ingredientId);
            return prepIng?.unitCost ? comp.quantity * prep.quantityPerUnit * prepIng.unitCost : undefined;
          })()
        : undefined
  ) : undefined;

  return (
    <div className={`flex items-center justify-between rounded border px-3 py-2 ${isInactive ? 'border-amber-300 bg-amber-50' : visual.bg}`}>
      <div className="flex items-center gap-2 min-w-0">
        {canExpand ? (
          <button type="button" onClick={() => onToggleExpand(comp.componentId)} className="p-0.5 text-text-muted hover:text-primary">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {isInactive ? (
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
        ) : (
          <IconComponent size={14} className={`${visual.color} shrink-0`} />
        )}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMoveComponent(idx, -1)}
            disabled={idx === 0}
            className="text-text-muted hover:text-secondary disabled:opacity-30"
            aria-label="Sposta su"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onMoveComponent(idx, 1)}
            disabled={idx === totalComponents - 1}
            className="text-text-muted hover:text-secondary disabled:opacity-30"
            aria-label="Sposta giù"
          >
            <ChevronDown size={12} />
          </button>
        </div>
        <div>
          <span className={`text-[9px] font-bold uppercase ${visual.color}`}>{visual.label}</span>
          <p className="text-sm text-secondary truncate">
            {name} ·
            <input
              type="number"
              value={localQty}
              onChange={(e) => setLocalQty(e.target.value)}
              onBlur={(e) => {
                const newQty = Number(e.target.value);
                if (Number.isFinite(newQty) && newQty > 0) {
                  onUpdateQty(comp.componentType, comp.componentId, newQty);
                } else {
                  setLocalQty(quantityString(comp.quantity));
                }
              }}
              className="w-16 px-1 py-0.5 border border-border rounded text-sm inline-block ml-1"
              min="0.01"
              step="0.1"
            />
            {' '}{comp.unit}
            {lineCost !== undefined && <span className="ml-2 text-text-muted">€{lineCost.toFixed(2)}</span>}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(comp.componentType, comp.componentId)}
        disabled={totalComponents <= 1}
        className="text-xs font-bold uppercase tracking-wider text-danger disabled:opacity-50 shrink-0 ml-2"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── RecipeBuilder (main component) ────────────────────────────────────────

export default function RecipeBuilder({
  components,
  inventory,
  bomItems,
  prepItems = [],
  onChange,
  showCost = false,
  bomItemId,
  conversionsMap = {},
  onOpenBomTab, onReplaceBomComponents,
}: RecipeBuilderProps) {
  const [type, setType] = useState<'ingredient' | 'bom' | 'prep'>('ingredient');
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('kg');
  const [expandedBoms, setExpandedBoms] = useState<Set<string>>(new Set());

  // State for adding sub-components to an expanded BoM
  const [subAddBomId, setSubAddBomId] = useState<string | null>(null);
  const [subAddType, setSubAddType] = useState<'ingredient' | 'bom' | 'prep'>('ingredient');
  const [subAddSelectedId, setSubAddSelectedId] = useState('');
  const [subAddQty, setSubAddQty] = useState('1');
  const [subAddUnit, setSubAddUnit] = useState('kg');

  const inventoryById = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory]);
  const bomNameById = useMemo(() => new Map(bomItems.map((b) => [b.id, b.name])), [bomItems]);
  const prepNameById = useMemo(() => new Map(prepItems.map((p) => [p.id, p.name])), [prepItems]);
  const ingredientById = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory]);

  const candidates = useMemo(() => {
    if (type === 'ingredient') {
      return inventory
        .filter((item) => item.isContainer !== 1)
        .map((item) => ({
          id: item.id,
          label: item.name,
          unit: item.unit,
          stockLevel: item.quantity,
          unitCost: item.unitCost,
        }));
    }
    if (type === 'prep') {
      return prepItems.map((item) => ({
        id: item.id,
        label: item.name,
        unit: item.unit,
        stockLevel: item.stockQuantity,
      }));
    }
    return bomItems
      .filter((item) => item.id !== bomItemId)
      .map((item) => ({ id: item.id, label: item.name, unit: item.unit }));
  }, [type, inventory, bomItems, prepItems, bomItemId]);

  const addComponent = () => {
    const qtyNum = Number(qty);
    if (!selectedId || !Number.isFinite(qtyNum) || qtyNum <= 0) return;
    const duplicate = components.some(
      (c) => c.componentType === type && c.componentId === selectedId,
    );
    if (duplicate) return;
    const newComp: MenuRecipeComponent = {
      componentType: type as 'ingredient' | 'bom' | 'prep',
      componentId: selectedId,
      quantity: qtyNum,
      unit,
    };
    onChange([...components, newComp]);
    setSelectedId('');
    setQty('1');
  };

  const removeComponent = (componentType: 'ingredient' | 'bom' | 'prep', componentId: string) => {
    const updated = components.filter(
      (c) => !(c.componentType === componentType && c.componentId === componentId),
    );
    if (updated.length === 0) return;
    onChange(updated);
  };

  const updateComponentQty = (componentType: 'ingredient' | 'bom' | 'prep', componentId: string, newQty: number) => {
    if (!Number.isFinite(newQty) || newQty <= 0) return;
    const updated = components.map((c) =>
      c.componentType === componentType && c.componentId === componentId
        ? { ...c, quantity: newQty }
        : c,
    );
    onChange(updated);
  };

  const toggleExpandedBom = (bomId: string) => {
    setExpandedBoms((prev) => {
      const next = new Set(prev);
      if (next.has(bomId)) next.delete(bomId);
      else next.add(bomId);
      return next;
    });
  };

  /** Helper: filter out container ingredients from a component array */
  const filterContainers = (comps: Array<{ componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }>) =>
    comps.filter((c) => {
      if (c.componentType === 'ingredient') {
        const ing = inventory.find((i) => i.id === c.componentId);
        return !ing || ing.isContainer !== 1;
      }
      return true;
    });

  /** Handle edit/remove/add of sub-components inside an expanded BoM */
  const handleBomSubEdit = async (
    bomId: string,
    action: 'update' | 'remove' | 'add',
    payload: { componentType?: string; componentId?: string; quantity?: number; unit?: string },
  ) => {
    if (!onReplaceBomComponents) return;
    const bom = bomItems.find((b) => b.id === bomId);
    if (!bom) return;

    let updatedComponents: Array<{
      componentType: 'ingredient' | 'bom' | 'prep';
      componentId: string;
      quantity: number;
      unit: string;
    }> = [...bom.components];
    if (action === 'remove') {
      updatedComponents = updatedComponents.filter(
        (c) => !(c.componentType === payload.componentType && c.componentId === payload.componentId),
      );
    } else if (action === 'update') {
      updatedComponents = updatedComponents.map((c) =>
        c.componentType === payload.componentType && c.componentId === payload.componentId
          ? { ...c, quantity: payload.quantity ?? c.quantity, unit: payload.unit ?? c.unit }
          : c,
      );
    } else if (action === 'add' && payload.componentType && payload.componentId) {
      updatedComponents = [...updatedComponents, {
        componentType: payload.componentType as 'ingredient' | 'bom' | 'prep',
        componentId: payload.componentId,
        quantity: payload.quantity ?? 1,
        unit: payload.unit ?? 'kg',
      }];
    }

    // Exclude container ingredients from the saved BoM
    const filtered = filterContainers(updatedComponents);

    if (filtered.length === 0) {
      throw new Error('Nessun componente valido nel BoM dopo il filtraggio dei contenitori.');
    }

    await onReplaceBomComponents(bomId, {
      components: filtered.map((c) => ({
        componentType: c.componentType,
        componentId: c.componentId,
        quantity: c.quantity,
        unit: c.unit,
      })),
    });
  };

  /** Candidates for the sub-add form */
  const subAddCandidates = useMemo(() => {
    if (subAddType === 'ingredient') {
      return inventory
        .filter((item) => item.isContainer !== 1)
        .map((item) => ({
          id: item.id,
          label: item.name,
          unit: item.unit,
          stockLevel: item.quantity,
          unitCost: item.unitCost,
        }));
    }
    if (subAddType === 'prep') {
      return prepItems.map((item) => ({
        id: item.id,
        label: item.name,
        unit: item.unit,
        stockLevel: item.stockQuantity,
      }));
    }
    return bomItems
      .filter((item) => item.id !== bomItemId)
      .map((item) => ({ id: item.id, label: item.name, unit: item.unit }));
  }, [subAddType, inventory, bomItems, prepItems, bomItemId]);

  const moveComponent = (index: number, direction: -1 | 1) => {
    const all = components;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= all.length) return;
    const next = [...all];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
  };

  const estimatedCost = useMemo(() => {
    if (!showCost) return 0;
    let total = 0;
    for (const c of components) {
      if (c.componentType === 'ingredient') {
        const ing = inventoryById.get(c.componentId);
        if (ing?.unitCost) total += c.quantity * ing.unitCost;
      } else if (c.componentType === 'prep') {
        const prep = prepItems.find((p) => p.id === c.componentId);
        if (prep) {
          const ing = ingredientById.get(prep.ingredientId);
          if (ing?.unitCost) total += c.quantity * prep.quantityPerUnit * ing.unitCost;
        }
      } else if (c.componentType === 'bom') {
        const bom = bomItems.find((b) => b.id === c.componentId);
        if (bom && bom.yieldQuantity > 0) {
          let subCost = 0;
          for (const sc of bom.components) {
            if (sc.componentType === 'ingredient') {
              const ing = inventoryById.get(sc.componentId);
              if (ing?.unitCost) subCost += sc.quantity * ing.unitCost;
            } else if (sc.componentType === 'prep') {
              const prep = prepItems.find((p) => p.id === sc.componentId);
              if (prep) {
                const ing = ingredientById.get(prep.ingredientId);
                if (ing?.unitCost) subCost += sc.quantity * prep.quantityPerUnit * ing.unitCost;
              }
            }
          }
          total += c.quantity * (subCost / bom.yieldQuantity);
        }
      }
    }
    return total;
  }, [components, inventoryById, ingredientById, prepItems, bomItems, showCost]);

  return (
    <div className="space-y-3 rounded border border-border bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Ricetta</p>

      {/* Ingredient & Prep section */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1">
          <Leaf size={12} />
          Ingredienti & Preparati
        </p>
        <ComponentPicker
          candidates={candidates}
          type={type}
          onTypeChange={(t: 'ingredient' | 'bom' | 'prep') => { setType(t); setSelectedId(''); }}
          selectedId={selectedId}
          onSelect={setSelectedId}
          qty={qty}
          onQtyChange={setQty}
          unit={unit}
          onUnitChange={setUnit}
          onAdd={() => addComponent()}
          conversionsMap={conversionsMap}
        />
        {components.length === 0 && (
          <p className="text-xs text-text-muted italic text-center py-2">Nessun ingrediente aggiunto</p>
        )}
        <div className="space-y-1">
          {components.map((comp, idx) => (
            <div key={`${comp.componentType}-${comp.componentId}-${idx}`}>
              <ComponentRow
                comp={comp}
                idx={idx}
                totalComponents={components.length}
                inventoryById={inventoryById}
                bomNameById={bomNameById}
                prepNameById={prepNameById}
                ingredientById={ingredientById}
                bomItems={bomItems}
                prepItems={prepItems}
                expandedBoms={expandedBoms}
                showCost={showCost}
                onToggleExpand={toggleExpandedBom}
                onMoveComponent={moveComponent}
                onUpdateQty={updateComponentQty}
                onRemove={removeComponent}
              />
              {/* Expanded BoM sub-components — fully editable */}
              {comp.componentType === 'bom' && expandedBoms.has(comp.componentId) && (() => {
                const bom = bomItems.find((b) => b.id === comp.componentId);
                if (!bom || bom.components.length === 0) return null;
                return (
                  <div className="ml-8 pl-3 border-l-2 border-purple-200 py-2 space-y-1.5 bg-bg/30 rounded-b-lg border-x border-b border-border">
                    {bom.components
                      .filter((subComp) => {
                        // Hide container ingredients — they're managed separately
                        if (subComp.componentType === 'ingredient') {
                          const subIng = inventory.find((i) => i.id === subComp.componentId);
                          return !subIng || subIng.isContainer !== 1;
                        }
                        return true;
                      })
                      .map((subComp, subIdx) => (
                        <SubComponentRow
                          key={`sub-${subComp.componentType}-${subComp.componentId}-${subIdx}`}
                          subComp={subComp}
                          bomId={bom.id}
                          inventory={inventory}
                          prepItems={prepItems}
                          bomItems={bomItems}
                          conversionsMap={conversionsMap}
                          onUpdate={handleBomSubEdit}
                          onRemove={handleBomSubEdit}
                        />
                      ))}

                    {/* Add sub-component inline form */}
                    <div className="px-2 pt-1">
                      {subAddBomId === bom.id ? (
                        <div className="flex flex-wrap items-end gap-2 p-2 rounded border border-accent/40 bg-accent/5">
                          <select
                            value={subAddType}
                            onChange={(e) => { setSubAddType(e.target.value as 'ingredient' | 'bom' | 'prep'); setSubAddSelectedId(''); }}
                            className="px-2 py-1.5 rounded border border-border text-[10px]"
                          >
                            <option value="ingredient">Ingrediente</option>
                            <option value="prep">Preparato</option>
                            <option value="bom">BoM</option>
                          </select>
                          <div className="relative flex-1 min-w-[120px]">
                            <input
                              list="sub-add-candidates"
                              value={subAddSelectedId ? subAddCandidates.find((c) => c.id === subAddSelectedId)?.label ?? subAddSelectedId : ''}
                              onChange={(e) => {
                                const match = subAddCandidates.find((c) => c.label.toLowerCase() === e.target.value.toLowerCase());
                                if (match) setSubAddSelectedId(match.id);
                                else setSubAddSelectedId('');
                              }}
                              placeholder="Cerca..."
                              className="w-full px-2 py-1.5 rounded border border-border text-[10px]"
                            />
                            <datalist id="sub-add-candidates">
                              {subAddCandidates.map((c) => (
                                <option key={c.id} value={c.label} />
                              ))}
                            </datalist>
                          </div>
                          <input
                            type="number"
                            value={subAddQty}
                            onChange={(e) => setSubAddQty(e.target.value.replace(/[^0-9.]/g, ''))}
                            className="w-16 px-2 py-1.5 rounded border border-border text-[10px] text-center"
                            min="0.01"
                            step="0.1"
                          />
                          <UnitSelect
                            value={subAddUnit}
                            onChange={setSubAddUnit}
                            placeholder="unità"
                            className="w-20"
                            extraUnits={(() => {
                              if (subAddType !== 'ingredient' || !subAddSelectedId) return [];
                              const convs = conversionsMap[subAddSelectedId];
                              if (!convs) return [];
                              return convs.map((c) => ({
                                value: c.fromUnit,
                                label: c.fromUnit,
                                category: 'Conversioni',
                              }));
                            })()}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const qtyNum = Number(subAddQty);
                              if (!subAddSelectedId || !Number.isFinite(qtyNum) || qtyNum <= 0) return;
                              void handleBomSubEdit(bom.id, 'add', {
                                componentType: subAddType,
                                componentId: subAddSelectedId,
                                quantity: qtyNum,
                                unit: subAddUnit,
                              });
                              setSubAddSelectedId('');
                              setSubAddQty('1');
                            }}
                            disabled={!subAddSelectedId}
                            className="px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubAddBomId(null)}
                            className="px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider text-text-muted hover:text-danger transition-colors"
                          >
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSubAddBomId(bom.id);
                            setSubAddType('ingredient');
                            setSubAddSelectedId('');
                            setSubAddQty('1');
                            setSubAddUnit('kg');
                          }}
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
                        >
                          <Plus size={10} />
                          Aggiungi componente al BoM
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-2 pt-0.5">
                      <p className="text-[9px] text-text-muted italic">
                        Resa: {bom.yieldQuantity} {bom.unit}
                      </p>
                      {onOpenBomTab && (
                        <button
                          type="button"
                          onClick={() => onOpenBomTab(bom.id)}
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
                        >
                          <ExternalLink size={10} />
                          Apri in BoM
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>

      {showCost && components.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Costo stimato</span>
          <span className="text-sm font-bold text-primary">€{estimatedCost.toFixed(2)}</span>
        </div>
      )}

      <RecipeTreeView recipe={components} bomItems={bomItems} inventory={inventory} prepItems={prepItems} />
    </div>
  );
}
