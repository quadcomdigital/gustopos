import { useState, useMemo, useCallback } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent } from '@gustopos/shared';
import { Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown, Leaf, ChefHat, Layers } from 'lucide-react';
import ComponentPicker from './ComponentPicker';
import RecipeTreeView from './RecipeTreeView';

interface RecipeBuilderProps {
  components: MenuRecipeComponent[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems?: PrepItem[];
  onChange: (components: MenuRecipeComponent[]) => void;
  showCost?: boolean;
  bomItemId?: string;
}

export default function RecipeBuilder({
  components,
  inventory,
  bomItems,
  prepItems = [],
  onChange,
  showCost = false,
  bomItemId,
}: RecipeBuilderProps) {
  const [type, setType] = useState<'ingredient' | 'bom' | 'prep'>('ingredient');
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('kg');

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

  const renderComponentRow = useCallback(
    (comp: MenuRecipeComponent, idx: number) => {
      const ing = comp.componentType === 'ingredient' ? inventoryById.get(comp.componentId) : undefined;
      const isInactive = ing && !ing.isActive;
      const name = comp.componentType === 'ingredient'
        ? (ing?.name ?? comp.componentId)
        : comp.componentType === 'prep'
          ? (prepNameById.get(comp.componentId) ?? comp.componentId)
          : (bomNameById.get(comp.componentId) ?? comp.componentId);
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
        <div key={`${comp.componentType}-${comp.componentId}-${idx}`} className={`flex items-center justify-between rounded border px-3 py-2 ${isInactive ? 'border-amber-300 bg-amber-50' : visual.bg}`}>
          <div className="flex items-center gap-2 min-w-0">
            {isInactive ? (
              <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            ) : (
              <IconComponent size={14} className={`${visual.color} shrink-0`} />
            )}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => moveComponent(idx, -1)}
                disabled={idx === 0}
                className="text-text-muted hover:text-secondary disabled:opacity-30"
                aria-label="Sposta su"
              >
                <ChevronUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => moveComponent(idx, 1)}
                disabled={idx === components.length - 1}
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
                  value={comp.quantity}
                  onChange={(e) => {
                    const newQty = Number(e.target.value);
                    updateComponentQty(comp.componentType, comp.componentId, newQty);
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
            onClick={() => removeComponent(comp.componentType, comp.componentId)}
            disabled={components.length <= 1}
            className="text-xs font-bold uppercase tracking-wider text-danger disabled:opacity-50 shrink-0 ml-2"
          >
            <Trash2 size={14} />
          </button>
        </div>
      );
    },
    [inventoryById, prepNameById, bomNameById, ingredientById, prepItems, components, showCost, moveComponent, removeComponent, updateComponentQty],
  );

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
        />
        {components.length === 0 && (
          <p className="text-xs text-text-muted italic text-center py-2">Nessun ingrediente aggiunto</p>
        )}
        <div className="space-y-1">
          {components.map((comp, idx) => renderComponentRow(comp, idx))}
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
