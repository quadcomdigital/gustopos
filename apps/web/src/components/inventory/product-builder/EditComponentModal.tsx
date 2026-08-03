import { useState, useMemo } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent, UnitConversion } from '@gustopos/shared';
import { Package, ChefHat, Layers, Search } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';
import UnitSelect from '../../../shared/ui/molecules/UnitSelect';

interface EditComponentModalProps {
  open: boolean;
  onClose: () => void;
  component: MenuRecipeComponent | null;
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  onSave: (updated: MenuRecipeComponent) => void;
  onSwap: (newComponentType: 'ingredient' | 'prep' | 'bom', newComponentId: string) => void;
  onRemove: () => void;
  /** Map of ingredientId → unit conversions for the unit selector */
  conversionsMap?: Record<string, UnitConversion[]>;
}

export default function EditComponentModal({
  open, onClose, component, inventory, bomItems, prepItems, onSave, onSwap, onRemove, conversionsMap = {},
}: EditComponentModalProps) {
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [showSwap, setShowSwap] = useState(false);
  const [swapSearch, setSwapSearch] = useState('');

  useMemo(() => {
    if (component) {
      setQty(String(component.quantity));
      setUnit(component.unit);
    }
  }, [component]);

  // Get conversions for the current component's ingredient (if it's an ingredient)
  const componentConversions = useMemo(() => {
    if (!component || component.componentType !== 'ingredient') return [];
    return conversionsMap[component.componentId] ?? [];
  }, [component, conversionsMap]);

  const unitExtraOptions = useMemo(() => {
    return componentConversions.map((c) => ({
      value: c.fromUnit,
      label: c.fromUnit,
      category: 'Conversioni',
    }));
  }, [componentConversions]);

  const componentName = useMemo(() => {
    if (!component) return '';
    if (component.componentName) return component.componentName;
    if (component.componentType === 'ingredient') return inventory.find((i) => i.id === component.componentId)?.name ?? component.componentId;
    if (component.componentType === 'prep') return prepItems.find((p) => p.id === component.componentId)?.name ?? component.componentId;
    return bomItems.find((b) => b.id === component.componentId)?.name ?? component.componentId;
  }, [component, inventory, bomItems, prepItems]);

  const prep = component?.componentType === 'prep' ? prepItems.find((p) => p.id === component.componentId) : null;
  const ingredient = prep ? inventory.find((i) => i.id === prep.ingredientId) : null;

  const swapCandidates = useMemo(() => {
    if (!component || !swapSearch) return [];
    const q = swapSearch.toLowerCase();
    if (component.componentType === 'ingredient') {
      return inventory.filter((i) => i.id !== component.componentId && i.isContainer !== 1 && i.name.toLowerCase().includes(q))
        .map((i) => ({ type: 'ingredient' as const, id: i.id, name: i.name, unit: i.unit }));
    }
    if (component.componentType === 'prep') {
      return prepItems.filter((p) => p.id !== component.componentId && p.name.toLowerCase().includes(q))
        .map((p) => ({ type: 'prep' as const, id: p.id, name: p.name, unit: p.unit }));
    }
    return bomItems.filter((b) => b.id !== component.componentId && b.name.toLowerCase().includes(q))
      .map((b) => ({ type: 'bom' as const, id: b.id, name: b.name, unit: b.unit }));
  }, [component, swapSearch, inventory, bomItems, prepItems]);

  const handleSave = () => {
    if (!component) return;
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) return;
    onSave({ ...component, quantity: qtyNum, unit });
  };

  const icon = component?.componentType === 'prep'
    ? <ChefHat size={16} className="text-blue-600" />
    : component?.componentType === 'bom'
      ? <Layers size={16} className="text-purple-600" />
      : <Package size={16} className="text-green-600" />;

  return (
    <Modal
      open={open && !!component}
      onClose={onClose}
      title={`Modifica: ${componentName}`}
      size="md"
      footer={
        <div className="flex flex-wrap items-center gap-2 w-full">
          <Button variant="danger" onClick={() => { onRemove(); onClose(); }}>Rimuovi</Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={() => { handleSave(); onClose(); }}>Salva</Button>
        </div>
      }
    >
      {component && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-border">
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-primary truncate">{componentName}</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">{component.componentType}</p>
            </div>
            <button type="button" onClick={() => setShowSwap(!showSwap)} className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline">
              {showSwap ? 'Annulla swap' : 'Scambia'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Quantità</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full px-3 py-2 rounded border border-border text-sm"
                min="0.001"
                step="0.001"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1">Unità</label>
              <UnitSelect
                value={unit}
                onChange={setUnit}
                extraUnits={unitExtraOptions}
                placeholder="Unità"
              />
            </div>
          </div>

          {prep && ingredient && (
            <div className="p-3 rounded-lg bg-bg border border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">BoM (Prep)</p>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Package size={12} />
                <span className="font-medium">{ingredient.name}</span>
                <span>→</span>
                <span>{Number(prep.quantityPerUnit)} {prep.unit}</span>
              </div>
            </div>
          )}

          {showSwap && (
            <div className="p-3 rounded-lg border border-accent bg-accent/5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Scambia componente</p>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={swapSearch}
                  onChange={(e) => setSwapSearch(e.target.value)}
                  placeholder="Cerca nuovo componente..."
                  className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-[150px] overflow-y-auto space-y-1">
                {swapCandidates.map((c) => (
                  <button
                    key={`${c.type}:${c.id}`}
                    type="button"
                    onClick={() => { onSwap(c.type, c.id); onClose(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded border border-border hover:border-accent hover:bg-accent/5 text-left transition-colors"
                  >
                    {c.type === 'prep' ? <ChefHat size={14} className="text-blue-600" /> : c.type === 'bom' ? <Layers size={14} className="text-purple-600" /> : <Package size={14} className="text-green-600" />}
                    <span className="text-sm text-primary truncate">{c.name}</span>
                  </button>
                ))}
                {swapSearch && swapCandidates.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-2">Nessun risultato</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
