import type { ModifierGroup, Ingredient, CategoryModifierPool } from '@gustopos/shared';
import { Plus, Trash2, Lock } from 'lucide-react';
import { generateId } from '../../lib/id';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';

interface ModifierGroupsEditorProps {
  value: ModifierGroup[];
  onChange: (next: ModifierGroup[]) => void;
  inventory: Ingredient[];
  categoryPools?: CategoryModifierPool[];
}

function createGroup(): ModifierGroup {
  return {
    id: generateId(),
    name: 'Nuovo gruppo',
    required: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 0,
    options: [],
  };
}

function createOption() {
  return {
    id: generateId(),
    name: 'Nuova opzione',
    inventoryItemId: undefined,
    priceDelta: 0,
    isDefault: false,
    sortOrder: 0,
    isActive: true,
    ingredientOverrides: [],
  };
}

export default function ModifierGroupsEditor({ value, onChange, inventory, categoryPools = [] }: ModifierGroupsEditorProps) {
  const inventoryById = new Map(inventory.map((i) => [i.id, i]));

  const updateOption = (groupId: string, optionId: string, patch: Record<string, unknown>) =>
    onChange(
      value.map((entry) =>
        entry.id === groupId
          ? {
              ...entry,
              options: entry.options.map((opt) =>
                opt.id === optionId ? { ...opt, ...patch } : opt,
              ),
            }
          : entry,
      ),
    );

  return (
    <div className="space-y-3">
      {categoryPools.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1">
            <Lock size={10} />
            Pool categoria (ereditato)
          </p>
          {categoryPools.map((pool) => (
            <div key={pool.id} className="rounded border border-border/50 bg-bg/30 p-2 space-y-1">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{pool.name}</p>
              <div className="flex flex-wrap gap-1">
                {pool.options.map((opt) => {
                  const invItem = opt.inventoryItemId ? inventoryById.get(opt.inventoryItemId) : undefined;
                  return (
                    <span key={opt.id} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-bg border border-border/50 text-text-muted">
                      {opt.name ?? invItem?.name ?? opt.inventoryItemId}
                      {opt.priceDelta !== 0 && (
                        <span className={opt.priceDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {' '}{opt.priceDelta > 0 ? '+' : ''}€{opt.priceDelta.toFixed(2)}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
              <p className="text-[9px] text-text-muted italic">Modificatori dalla categoria — gestiti nel tab Pool Mod.</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {categoryPools.length > 0 ? 'Modificatori aggiuntivi per prodotto' : 'Modificatori vendita'}
        </p>
        <button
          type="button"
          onClick={() => onChange([...value, createGroup()])}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider"
        >
          <Plus size={12} />
          Gruppo
        </button>
      </div>

      {value.length === 0 && categoryPools.length > 0 && (
        <p className="text-[10px] text-text-muted italic">
          Nessun modificatore aggiuntivo per questo prodotto. Usa il pool della categoria o aggiungi gruppi specifici.
        </p>
      )}

      {value.map((group) => (
        <div key={group.id} className="rounded border border-border bg-white p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              value={group.name}
              onChange={(e) =>
                onChange(
                  value.map((entry) => (entry.id === group.id ? { ...entry, name: e.target.value } : entry)),
                )
              }
              className="px-3 py-2 rounded border border-border text-sm"
              placeholder="Nome gruppo (es: Extra, Salse)"
            />
            <input
              value={String(group.minSelections)}
              onChange={(e) =>
                onChange(
                  value.map((entry) =>
                    entry.id === group.id
                      ? { ...entry, minSelections: Number(e.target.value.replace(/[^0-9]/g, '') || '0') }
                      : entry,
                  ),
                )
              }
              className="px-3 py-2 rounded border border-border text-sm"
              placeholder="Min selezioni"
            />
            <input
              value={String(group.maxSelections)}
              onChange={(e) =>
                onChange(
                  value.map((entry) =>
                    entry.id === group.id
                      ? { ...entry, maxSelections: Number(e.target.value.replace(/[^0-9]/g, '') || '1') }
                      : entry,
                  ),
                )
              }
              className="px-3 py-2 rounded border border-border text-sm"
              placeholder="Max selezioni"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  onChange(
                    value.map((entry) => (entry.id === group.id ? { ...entry, required: !entry.required } : entry)),
                  )
                }
                className="px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider"
              >
                {group.required ? 'Obbligatorio' : 'Opzionale'}
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((entry) => entry.id !== group.id))}
                className="px-2 py-2 rounded border border-danger text-danger"
                aria-label="Rimuovi gruppo modificatore"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {group.options.map((option) => {
              const isIngredientMode = !!option.inventoryItemId;
              return (
                <div key={option.id} className="rounded border border-border bg-bg/30 p-2 space-y-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (isIngredientMode) {
                          updateOption(group.id, option.id, { inventoryItemId: undefined });
                        } else {
                          const first = inventory[0];
                          updateOption(group.id, option.id, { inventoryItemId: first?.id, name: first?.name ?? option.name });
                        }
                      }}
                      className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border ${isIngredientMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                    >
                      {isIngredientMode ? 'Ingrediente' : 'Testo libero'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {isIngredientMode ? (
                      <SearchableSelect
                        items={inventory}
                        getLabel={(inv) => `${inv.name} (${inv.unit})`}
                        getValue={(inv) => inv.id}
                        selectedValue={option.inventoryItemId}
                        onSelect={(invId) => {
                          const invItem = inventory.find((i) => i.id === invId);
                          updateOption(group.id, option.id, { inventoryItemId: invId, name: invItem?.name ?? option.name });
                        }}
                        placeholder="Seleziona ingrediente..."
                      />
                    ) : (
                      <input
                        value={option.name}
                        onChange={(e) => updateOption(group.id, option.id, { name: e.target.value })}
                        className="px-3 py-2 rounded border border-border text-sm"
                        placeholder="Nome opzione (es: Formato grande)"
                      />
                    )}
                    <input
                      type="number"
                      value={option.priceDelta}
                      onChange={(e) =>
                        updateOption(group.id, option.id, { priceDelta: Number(e.target.value) || 0 })
                      }
                      step="0.5"
                      className="px-3 py-2 rounded border border-border text-sm"
                      placeholder="Delta prezzo (€)"
                    />
                    <button
                      type="button"
                      onClick={() => updateOption(group.id, option.id, { isDefault: !option.isDefault })}
                      className="px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider"
                    >
                      {option.isDefault ? 'Default' : 'Non default'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOption(group.id, option.id, { isActive: !option.isActive })}
                      className="px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider"
                    >
                      {option.isActive ? 'Attiva' : 'Disattiva'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          value.map((entry) =>
                            entry.id === group.id
                              ? { ...entry, options: entry.options.filter((opt) => opt.id !== option.id) }
                              : entry,
                          ),
                        )
                      }
                      className="px-2 py-2 rounded border border-danger text-danger text-[10px] font-bold uppercase tracking-wider"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                onChange(
                  value.map((entry) =>
                    entry.id === group.id ? { ...entry, options: [...entry.options, createOption()] } : entry,
                  ),
                )
              }
              className="px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider"
            >
              + Opzione
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
