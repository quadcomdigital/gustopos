import type { ModifierGroup, Ingredient, CategoryModifierPool, ModifierOption, BomItem, PrepItem } from '@gustopos/shared';
import { Plus, Trash2, Lock } from 'lucide-react';
import { generateId } from '../../lib/id';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import { useProductionReferences } from './useProductionReferences';
import EmptyState from '../../shared/ui/atoms/EmptyState';

const UNIT_OPTIONS = ['mg', 'g', 'kg', 'ml', 'L', 'pz'] as const;

interface ModifierGroupsEditorProps {
  value: ModifierGroup[];
  onChange: (next: ModifierGroup[]) => void;
  inventory: Ingredient[];
  prepItems?: PrepItem[];
  bomItems?: BomItem[];
  categoryPools?: CategoryModifierPool[];
  /** simple_catalog: options are free-text names + price only (no inventory/prep/BoM linking). */
  simpleCatalogMode?: boolean;
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

function createOption(): ModifierOption {
  return {
    id: generateId(),
    name: 'Nuova opzione',
    inventoryItemId: undefined,
    componentType: 'ingredient',
    componentId: undefined,
    quantity: 1,
    unit: 'pz',
    priceDelta: 0,
    isDefault: false,
    sortOrder: 0,
    isActive: true,
    ingredientOverrides: [],
  };
}

export default function ModifierGroupsEditor({ value, onChange, inventory, prepItems = [], bomItems = [], categoryPools = [], simpleCatalogMode = false }: ModifierGroupsEditorProps) {
  const { references } = useProductionReferences();
  const activeReferences = references.filter((r) => r.isActive);
  const inventoryById = new Map(inventory.map((i) => [i.id, i]));
  const prepById = new Map(prepItems.map((p) => [p.id, p]));
  const bomById = new Map(bomItems.map((b) => [b.id, b]));

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
    <div className="space-y-3 tabular-nums">
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
                    <span key={opt.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg border border-border/50 text-text-muted">
                      {opt.name ?? invItem?.name ?? opt.inventoryItemId}
                      {opt.priceDelta !== 0 && (
                        <span className={opt.priceDelta > 0 ? 'text-success-600' : 'text-danger-600'}>
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
          className="inline-flex items-center gap-1 px-2 py-1 min-h-[44px] rounded border border-border text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          <Plus size={12} />
          Gruppo
        </button>
      </div>

      {value.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          title="Nessun gruppo modificatore."
          description={categoryPools.length > 0
            ? 'Usa il pool della categoria o aggiungi gruppi specifici cliccando "Gruppo".'
            : 'Clicca "Gruppo" per aggiungere opzioni modificabili (extra, salse, cotture...).'}
        />
      )}

      {value.map((group) => (
        <div key={group.id} className="rounded border border-border bg-white p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={group.name}
              onChange={(e) => setGroupField(group.id, { name: e.target.value })}
              className="flex-1 min-w-[140px] px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
              placeholder="Nome gruppo (es: Extra, Salse)"
            />
            <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Tipo selezione">
              <button
                type="button"
                onClick={() => setGroupMode(group.id, false)}
                className={cn(
                  'min-h-[40px] px-3 text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  group.maxSelections <= 1 ? 'bg-accent text-white' : 'bg-white text-text-muted',
                )}
              >
                Singola
              </button>
              <button
                type="button"
                onClick={() => setGroupMode(group.id, true)}
                className={cn(
                  'min-h-[40px] px-3 text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  group.maxSelections > 1 ? 'bg-accent text-white' : 'bg-white text-text-muted',
                )}
              >
                Multipla
              </button>
            </div>
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
              Min
              <input
                type="number"
                value={String(group.minSelections)}
                onChange={(e) => setGroupField(group.id, { minSelections: Number(e.target.value.replace(/[^0-9]/g, '') || '0') })}
                className="w-16 px-2 py-2 rounded border border-border text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            {group.maxSelections > 1 && (
              <>
                <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
                  Max
                  <input
                    type="number"
                    value={String(group.maxSelections)}
                    onChange={(e) => setGroupField(group.id, { maxSelections: Math.max(2, Number(e.target.value.replace(/[^0-9]/g, '') || '2')) })}
                    className="w-16 px-2 py-2 rounded border border-border text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
                  Costo
                  <select
                    value={group.multiSelectPriceMode ?? 'max'}
                    onChange={(e) => setGroupField(group.id, { multiSelectPriceMode: e.target.value as ModifierGroup['multiSelectPriceMode'] })}
                    className="px-2 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="none">Nessuno</option>
                    <option value="max">Massimo</option>
                    <option value="sum">Somma</option>
                  </select>
                </label>
              </>
            )}
            <button
              type="button"
              onClick={() => setGroupField(group.id, { required: !group.required })}
              className="min-h-[40px] px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              {group.required ? 'Obbligatorio' : 'Opzionale'}
            </button>
            <button
              type="button"
              onClick={() => onChange(value.filter((entry) => entry.id !== group.id))}
              className="min-w-[44px] min-h-[40px] flex items-center justify-center px-2 py-2 rounded border border-danger text-danger hover:bg-danger-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
              aria-label="Rimuovi gruppo modificatore"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {group.options.map((option) => {
              const componentType = option.componentType ?? 'ingredient';
              const isIngredientMode = componentType === 'ingredient';
              const componentId = option.componentId ?? option.inventoryItemId;
              if (simpleCatalogMode) {
                // Free-text option: name + price only. No inventory/prep/BoM links.
                return (
                  <div key={option.id} className="rounded border border-border bg-bg/30 p-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input
                        value={option.name}
                        onChange={(e) => updateOption(group.id, option.id, { name: e.target.value })}
                        className="px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                        placeholder="Nome opzione (es: Extra avocado)"
                      />
                      <input
                        type="number"
                        value={option.priceDelta}
                        onChange={(e) => updateOption(group.id, option.id, { priceDelta: Number(e.target.value) || 0 })}
                        step="0.5"
                        className="px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                        placeholder="Delta prezzo (€)"
                      />
                      <button
                        type="button"
                        onClick={() => updateOption(group.id, option.id, { isDefault: !option.isDefault })}
                        className="min-h-[44px] px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                        aria-pressed={option.isDefault}
                      >
                        {option.isDefault ? '✓ Di default' : 'Di default'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(value.map((entry) => (entry.id === group.id ? { ...entry, options: entry.options.filter((o) => o.id !== option.id) } : entry)))}
                        className="min-h-[44px] px-2 py-2 rounded border border-danger text-danger text-[10px] font-bold uppercase tracking-wider hover:bg-danger-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={option.id} className="rounded border border-border bg-bg/30 p-2 space-y-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (isIngredientMode) {
                          updateOption(group.id, option.id, { inventoryItemId: undefined, componentType: 'ingredient', componentId: undefined });
                        } else {
                          const first = inventory[0];
                          updateOption(group.id, option.id, { inventoryItemId: first?.id, componentType: 'ingredient', componentId: first?.id, name: first?.name ?? option.name });
                        }
                      }}
                      className={`min-h-[44px] px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${isIngredientMode ? 'bg-info-50 text-info-700 border-info-200' : 'bg-warning-50 text-warning-700 border-warning-200'}`}
                      aria-pressed={isIngredientMode}
                    >
                      {componentType === 'prep' ? 'Prep' : componentType === 'bom' ? 'BoM' : 'Ingrediente'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                    <select
                      value={componentType}
                      onChange={(e) => {
                        const nextType = e.target.value as 'ingredient' | 'prep' | 'bom';
                        updateOption(group.id, option.id, { componentType: nextType, componentId: undefined, inventoryItemId: undefined });
                      }}
                      className="px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                    >
                      <option value="ingredient">Ingrediente</option>
                      <option value="prep">Prep</option>
                      <option value="bom">BoM</option>
                    </select>
                    {isIngredientMode ? (
                      <SearchableSelect items={inventory} getLabel={(inv) => `${inv.name} (${inv.unit})`} getValue={(inv) => inv.id} selectedValue={componentId} fallbackLabel={componentId ? undefined : option.name} onSelect={(id) => { const item = inventory.find((i) => i.id === id); updateOption(group.id, option.id, { inventoryItemId: id, componentId: id, name: item?.name ?? option.name }); }} placeholder="Seleziona ingrediente..." />
                    ) : componentType === 'prep' ? (
                      <SearchableSelect items={prepItems} getLabel={(prep) => `${prep.name} (${prep.outputUnit})`} getValue={(prep) => prep.id} selectedValue={componentId} fallbackLabel={componentId ? undefined : option.name} onSelect={(id) => { const item = prepById.get(id); updateOption(group.id, option.id, { componentId: id, inventoryItemId: undefined, name: item?.name ?? option.name }); }} placeholder="Seleziona prep..." />
                    ) : (
                      <SearchableSelect items={bomItems} getLabel={(bom) => `${bom.name} (${bom.outputUnit})`} getValue={(bom) => bom.id} selectedValue={componentId} fallbackLabel={componentId ? undefined : option.name} onSelect={(id) => { const item = bomById.get(id); updateOption(group.id, option.id, { componentId: id, inventoryItemId: undefined, name: item?.name ?? option.name }); }} placeholder="Seleziona BoM..." />
                    )}
                    <input
                      type="number"
                      value={option.quantity}
                      onChange={(e) =>
                        updateOption(group.id, option.id, { quantity: Number(e.target.value) || 1 })
                      }
                      min="0.01"
                      step="0.01"
                      className="px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                      placeholder="Qtà"
                    />
                    <select
                      value={option.unit}
                      onChange={(e) => updateOption(group.id, option.id, { unit: e.target.value })}
                      className="px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={option.priceDelta}
                      onChange={(e) =>
                        updateOption(group.id, option.id, { priceDelta: Number(e.target.value) || 0 })
                      }
                      step="0.5"
                      className="px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent"
                      placeholder="Delta prezzo (€)"
                    />
                    <button
                      type="button"
                      onClick={() => updateOption(group.id, option.id, { isDefault: !option.isDefault })}
                      className="min-h-[44px] px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      aria-pressed={option.isDefault}
                    >
                      {option.isDefault ? 'Default' : 'Non default'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOption(group.id, option.id, { isActive: !option.isActive })}
                      className="min-h-[44px] px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                      aria-pressed={option.isActive}
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
                      className="min-h-[44px] px-2 py-2 rounded border border-danger text-danger text-[10px] font-bold uppercase tracking-wider hover:bg-danger-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                    >
                      Rimuovi
                    </button>
                  </div>
                  <select
                    value={option.referenceId ?? ''}
                    onChange={(e) => updateOption(group.id, option.id, { referenceId: e.target.value || null })}
                    className="w-full px-3 py-2 rounded border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <option value="">Referenza conteggio: nessuna</option>
                    {activeReferences.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
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
              className="min-h-[44px] px-2 py-2 rounded border border-border text-[10px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              + Opzione
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
