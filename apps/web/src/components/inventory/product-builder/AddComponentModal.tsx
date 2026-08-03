import { useState, useMemo } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent, UnitConversion } from '@gustopos/shared';
import { Search, Package, ChefHat, Layers, Plus, Check } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';
import UnitSelect from '../../../shared/ui/molecules/UnitSelect';

interface AddComponentModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (component: MenuRecipeComponent) => void;
  onCreateIngredient: () => void;
  onCreatePrep: () => void;
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  existingComponents: MenuRecipeComponent[];
  /** Map of ingredientId → unit conversions for the unit selector */
  conversionsMap?: Record<string, UnitConversion[]>;
}

export default function AddComponentModal({
  open, onClose, onAdd, onCreateIngredient, onCreatePrep, inventory, bomItems, prepItems, existingComponents, conversionsMap = {},
}: AddComponentModalProps) {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<{ type: 'ingredient' | 'prep' | 'bom'; id: string; name: string; unit: string } | null>(null);
  const [configQty, setConfigQty] = useState('1');
  const [configUnit, setConfigUnit] = useState('');

  const existingSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of existingComponents) s.add(`${c.componentType}:${c.componentId}`);
    return s;
  }, [existingComponents]);

  const filteredIngredients = useMemo(() => {
    const q = search.toLowerCase();
    return inventory
      .filter((i) => i.isActive && i.isContainer !== 1 && (i.name.toLowerCase().includes(q)))
      .map((i) => ({
        type: 'ingredient' as const,
        id: i.id,
        name: i.name,
        unit: i.unit,
        stock: i.quantity,
        unitCost: i.unitCost,
        existing: existingSet.has(`ingredient:${i.id}`),
      }));
  }, [inventory, search, existingSet]);

  const filteredPreps = useMemo(() => {
    const q = search.toLowerCase();
    return prepItems
      .filter((p) => p.name.toLowerCase().includes(q))
      .map((p) => ({
        type: 'prep' as const,
        id: p.id,
        name: p.name,
        unit: p.unit,
        stock: p.stockQuantity,
        existing: existingSet.has(`prep:${p.id}`),
      }));
  }, [prepItems, search, existingSet]);

  const filteredBoms = useMemo(() => {
    const q = search.toLowerCase();
    return bomItems
      .filter((b) => b.name.toLowerCase().includes(q))
      .map((b) => ({
        type: 'bom' as const,
        id: b.id,
        name: b.name,
        unit: b.unit,
        stock: null,
        existing: existingSet.has(`bom:${b.id}`),
      }));
  }, [bomItems, search, existingSet]);

  const allResults = useMemo(() => [...filteredIngredients, ...filteredPreps, ...filteredBoms], [filteredIngredients, filteredPreps, filteredBoms]);

  /* eslint-disable react-hooks/exhaustive-deps -- itemConversions is conditional on selectedItem.type + selectedItem.id + conversionsMap; the conditional expression re-evaluates deterministically when any of those inputs change, so no extra deps are needed */
  const itemConversions = selectedItem?.type === 'ingredient' ? conversionsMap[selectedItem.id] ?? [] : [];

  const unitExtraOptions = useMemo(() => {
    return itemConversions.map((c) => ({
      value: c.fromUnit,
      label: c.fromUnit,
      category: 'Conversioni',
    }));
  }, [itemConversions]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleItemClick = (type: 'ingredient' | 'prep' | 'bom', id: string, name: string, unit: string) => {
    if (selectedItem?.id === id && selectedItem?.type === type) {
      // Toggle off
      setSelectedItem(null);
      return;
    }
    setSelectedItem({ type, id, name, unit });
    setConfigQty('1');
    setConfigUnit(unit);
  };

  const handleConfirmAdd = () => {
    if (!selectedItem) return;
    const qtyNum = Number(configQty);
    if (!qtyNum || qtyNum <= 0) return;
    onAdd({ componentType: selectedItem.type, componentId: selectedItem.id, quantity: qtyNum, unit: configUnit });
    onClose();
    setSearch('');
    setSelectedItem(null);
    setConfigQty('1');
    setConfigUnit('');
  };

  const handleClose = () => {
    onClose();
    setSearch('');
    setSelectedItem(null);
    setConfigQty('1');
    setConfigUnit('');
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Aggiungi componente"
      size="md"
      footer={<Button variant="secondary" onClick={handleClose}>Chiudi</Button>}
    >
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca ingrediente, prep o BoM..."
            className="w-full pl-8 pr-3 py-2 rounded border border-border text-sm"
            autoFocus
          />
        </div>

        {allResults.length > 0 ? (
          <div className="max-h-[220px] overflow-y-auto space-y-1">
            {allResults.map((item) => {
              const isSelected = selectedItem?.id === item.id && selectedItem?.type === item.type;
              return (
                <button
                  key={`${item.type}:${item.id}`}
                  type="button"
                  disabled={item.existing}
                  onClick={() => handleItemClick(item.type, item.id, item.name, item.unit)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-left transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent/5 ring-1 ring-accent'
                      : item.existing
                        ? 'border-border bg-bg/50 opacity-50 cursor-not-allowed'
                        : 'border-border hover:border-accent hover:bg-accent/5 cursor-pointer'
                  }`}
                >
                  {isSelected && <Check size={14} className="text-accent shrink-0" />}
                  {item.type === 'prep' ? (
                    <ChefHat size={14} className="text-blue-600 shrink-0" />
                  ) : item.type === 'bom' ? (
                    <Layers size={14} className="text-purple-600 shrink-0" />
                  ) : (
                    <Package size={14} className="text-green-600 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-primary truncate flex-1">{item.name}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded bg-bg shrink-0">
                    {item.type === 'prep' ? 'Prep' : item.type === 'bom' ? 'BoM' : 'Ingrediente'}
                  </span>
                  {item.stock != null && (
                    <span className="text-[10px] text-text-muted shrink-0">{item.stock} {item.unit}</span>
                  )}
                  {item.existing && (
                    <span className="text-[9px] text-text-muted shrink-0">aggiunto</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-text-muted">
            {search ? 'Nessun risultato' : 'Inizia a digitare per cercare...'}
          </div>
        )}

        {/* Configuration panel for selected item */}
        {selectedItem && (
          <div className="border border-accent/40 bg-accent/5 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
              <Package size={12} className={selectedItem.type === 'prep' ? 'text-blue-600' : selectedItem.type === 'bom' ? 'text-purple-600' : 'text-green-600'} />
              {selectedItem.name}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">Quantità</label>
                <input
                  type="number"
                  value={configQty}
                  onChange={(e) => setConfigQty(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full px-2 py-1.5 rounded border border-border text-sm"
                  min="0.001"
                  step="0.001"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-0.5">Unità</label>
                <UnitSelect
                  value={configUnit}
                  onChange={setConfigUnit}
                  extraUnits={unitExtraOptions}
                  placeholder="Unità"
                />
              </div>
              <Button variant="primary" size="sm" onClick={handleConfirmAdd} className="w-full sm:w-auto">
                <Plus size={14} />
                Aggiungi
              </Button>
            </div>
            {itemConversions.length > 0 && (
              <p className="text-[9px] text-text-muted">
                Conversioni disponibili: {itemConversions.map((c) => c.fromUnit).join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Oppure crea nuovo</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => { onCreateIngredient(); handleClose(); }}>
              <Package size={14} />
              Crea ingrediente
            </Button>
            <Button variant="secondary" className="w-full sm:w-auto" onClick={() => { onCreatePrep(); handleClose(); }}>
              <ChefHat size={14} />
              Crea prep
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
