import { useState, useMemo } from 'react';
import type { Ingredient, MenuItemModifier } from '@gustopos/shared';
import { Plus, Trash2, Euro } from 'lucide-react';
import { generateId } from '../../lib/id';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';

interface ModifierEditorProps {
  modifiers: MenuItemModifier[];
  inventory: Ingredient[];
  onChange: (modifiers: MenuItemModifier[]) => void;
}

export default function ModifierEditor({ modifiers, inventory, onChange }: ModifierEditorProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [priceDelta, setPriceDelta] = useState('0');

  const addModifier = () => {
    if (!selectedIngredientId) return;
    const alreadyExists = modifiers.some((m) => m.inventoryItemId === selectedIngredientId);
    if (alreadyExists) return;
    const inv = inventory.find((i) => i.id === selectedIngredientId);
    const delta = priceDelta ? Number(priceDelta) : 0;
    onChange([
      ...modifiers,
      {
        id: generateId(),
        inventoryItemId: selectedIngredientId,
        name: inv?.name ?? '',
        priceDelta: delta,
        effectivePrice: delta || (inv?.salePrice ?? 0),
      },
    ]);
    setSelectedIngredientId('');
    setPriceDelta('0');
  };

  const removeModifier = (inventoryItemId: string) => {
    onChange(modifiers.filter((m) => m.inventoryItemId !== inventoryItemId));
  };

  const updateDelta = (inventoryItemId: string, delta: number) => {
    onChange(modifiers.map((m) =>
      m.inventoryItemId === inventoryItemId ? { ...m, priceDelta: delta, effectivePrice: delta } : m,
    ));
  };

  const availableIngredients = useMemo(
    () => inventory.filter((i) => i.isActive && !modifiers.some((m) => m.inventoryItemId === i.id)),
    [inventory, modifiers],
  );

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        Extra disponibili per il cliente
      </p>
      <p className="text-[9px] text-text-muted italic">
        Seleziona gli ingredienti che il cliente può aggiungere come extra (es. "Mozzarella extra +€1,50").
      </p>

      {modifiers.length > 0 && (
        <div className="space-y-1.5">
          {modifiers.map((mod) => {
            const inv = inventory.find((i) => i.id === mod.inventoryItemId);
            return (
              <div key={mod.id} className="flex items-center gap-2 rounded border border-border px-3 py-2 bg-white">
                <p className="flex-1 text-sm font-semibold text-secondary truncate">{inv?.name ?? mod.name ?? mod.inventoryItemId}</p>
                <div className="flex items-center gap-1">
                  <Euro size={12} className="text-text-muted" />
                  <input
                    type="number"
                    value={mod.priceDelta}
                    onChange={(e) => updateDelta(mod.inventoryItemId, Number(e.target.value.replace(/[^0-9.-]/g, '') || '0'))}
                    className="w-16 px-1.5 py-1 rounded border border-border text-[10px] font-bold text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder="0"
                    step="0.5"
                  />
                  <span className="text-[10px] text-text-muted font-bold w-6">€</span>
                </div>
                <span className="text-[10px] text-text-muted">
                  Cliente vede: +€{((mod.effectivePrice ?? mod.priceDelta) ?? (inv?.salePrice ?? 0)).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => removeModifier(mod.inventoryItemId)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-danger hover:text-danger/80 rounded hover:bg-danger-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  aria-label="Rimuovi extra"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Ingrediente</label>
          <div className="mt-0.5">
            <SearchableSelect
              items={availableIngredients}
              getLabel={(inv) => inv.name}
              getValue={(inv) => inv.id}
              selectedValue={selectedIngredientId}
              onSelect={setSelectedIngredientId}
              placeholder="Seleziona..."
            />
          </div>
        </div>
        <div className="w-20">
          <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Extra €</label>
          <input
            type="number"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full px-2 py-1.5 rounded border border-border text-sm mt-0.5"
            placeholder="0"
            step="0.5"
          />
        </div>
        <button
          type="button"
          onClick={addModifier}
          disabled={!selectedIngredientId}
          className="inline-flex items-center gap-1 px-3 py-2 rounded border border-accent text-[10px] font-bold uppercase tracking-wider text-accent disabled:opacity-50"
        >
          <Plus size={12} />
          Aggiungi
        </button>
      </div>
    </div>
  );
}
