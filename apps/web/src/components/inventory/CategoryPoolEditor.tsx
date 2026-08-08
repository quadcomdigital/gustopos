import type { Category, Ingredient, CategoryModifierPool, BomItem, PrepItem } from '@gustopos/shared';
import { Trash2, Save, X, Boxes } from 'lucide-react';
import { useState } from 'react';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';
import EmptyState from '../../shared/ui/atoms/EmptyState';

const UNIT_OPTIONS = ['mg', 'g', 'kg', 'ml', 'L', 'pz'] as const;

interface CategoryPoolEditorProps {
  pools: CategoryModifierPool[];
  menuCategories: Category[];
  inventory: Ingredient[];
  prepItems?: PrepItem[];
  bomItems?: BomItem[];
  onCreatePool: (payload: { categoryIds: string[]; name: string; options: Array<{ inventoryItemId?: string; componentType: 'ingredient' | 'prep' | 'bom'; componentId?: string; name?: string; quantity: number; unit: string; priceDelta: number; sortOrder: number }> }) => Promise<void>;
  onUpdatePool: (id: string, payload: { name?: string; categoryIds?: string[]; options?: Array<{ inventoryItemId?: string; componentType: 'ingredient' | 'prep' | 'bom'; componentId?: string; name?: string; quantity: number; unit: string; priceDelta: number; sortOrder: number }> }) => Promise<void>;
  onDeletePool: (id: string) => Promise<void>;
}

export default function CategoryPoolEditor({
  pools,
  menuCategories,
  inventory,
  prepItems = [],
  bomItems = [],
  onCreatePool,
  onUpdatePool,
  onDeletePool,
}: CategoryPoolEditorProps) {
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolOptions, setNewPoolOptions] = useState<Array<{ inventoryItemId?: string; componentType: 'ingredient' | 'prep' | 'bom'; componentId?: string; name?: string; quantity: number; unit: string; priceDelta: number; sortOrder: number }>>([]);
  const [saving, setSaving] = useState(false);

  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editOptions, setEditOptions] = useState<Array<{ inventoryItemId?: string; componentType: 'ingredient' | 'prep' | 'bom'; componentId?: string; name?: string; quantity: number; unit: string; priceDelta: number; sortOrder: number }>>([]);
  const [editSaving, setEditSaving] = useState(false);

  const filteredPools = filterCategoryId
    ? pools.filter((p) => p.categoryIds?.includes(filterCategoryId) || p.categoryId === filterCategoryId)
    : pools;

  const handleCreatePool = async () => {
    if (selectedCategoryIds.length === 0 || !newPoolName.trim()) return;
    setSaving(true);
    try {
      await onCreatePool({
        categoryIds: selectedCategoryIds,
        name: newPoolName.trim(),
        options: newPoolOptions,
      });
      setNewPoolName('');
      setNewPoolOptions([]);
      setSelectedCategoryIds([]);
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  };

  const addOptionToNewPool = () => {
    setNewPoolOptions([...newPoolOptions, { inventoryItemId: undefined, componentType: 'ingredient', componentId: undefined, name: '', quantity: 1, unit: 'pz', priceDelta: 0, sortOrder: newPoolOptions.length }]);
  };

  const updateNewPoolOption = (idx: number, field: 'inventoryItemId' | 'componentType' | 'componentId' | 'priceDelta' | 'name' | 'quantity' | 'unit', value: string | number | undefined) => {
    setNewPoolOptions((prev) => prev.map((opt, i) => (i === idx ? { ...opt, [field]: value } : opt)));
  };

  const removeNewPoolOption = (idx: number) => {
    setNewPoolOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const getCategoryNames = (pool: CategoryModifierPool): string => {
    const catIds = pool.categoryIds?.length ? pool.categoryIds : (pool.categoryId ? [pool.categoryId] : []);
    return catIds
      .map((id) => menuCategories.find((c) => c.id === id)?.name ?? id)
      .join(', ');
  };

  const startEditing = (pool: CategoryModifierPool) => {
    setEditingPoolId(pool.id);
    setEditName(pool.name);
    setEditCategoryIds(pool.categoryIds?.length ? pool.categoryIds : (pool.categoryId ? [pool.categoryId] : []));
    setEditOptions(pool.options.map((o) => ({ inventoryItemId: o.inventoryItemId, componentType: o.componentType ?? 'ingredient', componentId: o.componentId ?? o.inventoryItemId, name: o.name, quantity: 1, unit: 'pz', priceDelta: o.priceDelta, sortOrder: o.sortOrder })));
  };

  const cancelEditing = () => {
    setEditingPoolId(null);
    setEditName('');
    setEditCategoryIds([]);
    setEditOptions([]);
  };

  const handleUpdatePool = async () => {
    if (!editingPoolId || editCategoryIds.length === 0 || !editName.trim()) return;
    setEditSaving(true);
    try {
      await onUpdatePool(editingPoolId, {
        name: editName.trim(),
        categoryIds: editCategoryIds,
        options: editOptions,
      });
      cancelEditing();
    } finally {
      setEditSaving(false);
    }
  };

  const toggleEditCategory = (catId: string) => {
    setEditCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  };

  const addOptionToEditPool = () => {
    setEditOptions([...editOptions, { inventoryItemId: undefined, componentType: 'ingredient', componentId: undefined, name: '', quantity: 1, unit: 'pz', priceDelta: 0, sortOrder: editOptions.length }]);
  };

  const updateEditPoolOption = (idx: number, field: 'inventoryItemId' | 'componentType' | 'componentId' | 'priceDelta' | 'name' | 'quantity' | 'unit', value: string | number | undefined) => {
    setEditOptions((prev) => prev.map((opt, i) => (i === idx ? { ...opt, [field]: value } : opt)));
  };

  const removeEditPoolOption = (idx: number) => {
    setEditOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3 tabular-nums">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Pool modificatori per categoria</p>

      <div className="flex items-center gap-2">
        <SearchableSelect
          items={[{ id: '', name: 'Tutte le categorie' }, ...menuCategories]}
          getLabel={(cat) => cat.name}
          getValue={(cat) => cat.id}
          selectedValue={filterCategoryId}
          onSelect={setFilterCategoryId}
          placeholder="Filtra per categoria..."
        />
      </div>

      <div className="rounded border border-border bg-white p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Categorie del pool</p>
        <div className="flex flex-wrap gap-1.5">
          {menuCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`px-3 py-1.5 min-h-[44px] rounded text-[10px] font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                selectedCategoryIds.includes(cat.id)
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg text-secondary border-border hover:border-accent'
              }`}
              aria-pressed={selectedCategoryIds.includes(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            value={newPoolName}
            onChange={(e) => setNewPoolName(e.target.value)}
            placeholder="Nome pool (es: Extra, Salse)"
            className="w-full sm:flex-1 px-3 py-2 rounded border border-border text-sm"
          />
          <button
            type="button"
            onClick={() => void handleCreatePool()}
            disabled={saving || selectedCategoryIds.length === 0 || !newPoolName.trim()}
            className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-4 py-2 min-h-[44px] rounded bg-accent text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-60"
          >
            <Save size={12} />
            {saving ? 'Creazione...' : 'Crea Pool'}
          </button>
        </div>

        <div className="space-y-1">
          {newPoolOptions.map((opt, idx) => {
            const componentType = opt.componentType ?? 'ingredient';
            const isIngredientMode = componentType === 'ingredient';
            const componentId = opt.componentId ?? opt.inventoryItemId;
            return (
              <div key={idx} className="rounded border border-border bg-bg/30 p-2 space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Tipo</label>
                  <select
                    value={componentType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'ingredient' | 'prep' | 'bom';
                      updateNewPoolOption(idx, 'componentType', nextType);
                      updateNewPoolOption(idx, 'componentId', undefined);
                      updateNewPoolOption(idx, 'inventoryItemId', undefined);
                    }}
                    className="px-2 py-1.5 min-h-[40px] rounded border border-border text-xs"
                  >
                    <option value="ingredient">Ingrediente</option>
                    <option value="prep">Prep</option>
                    <option value="bom">BoM</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    {isIngredientMode ? (
                      <SearchableSelect items={inventory} getLabel={(inv) => `${inv.name} (${inv.unit})`} getValue={(inv) => inv.id} selectedValue={componentId} onSelect={(id) => { const item = inventory.find((i) => i.id === id); updateNewPoolOption(idx, 'inventoryItemId', id); updateNewPoolOption(idx, 'componentId', id); if (item) updateNewPoolOption(idx, 'name', item.name); }} placeholder="Seleziona ingrediente..." className="w-full" />
                    ) : componentType === 'prep' ? (
                      <SearchableSelect items={prepItems} getLabel={(prep) => `${prep.name} (${prep.outputUnit})`} getValue={(prep) => prep.id} selectedValue={componentId} onSelect={(id) => { const item = prepItems.find((p) => p.id === id); updateNewPoolOption(idx, 'componentId', id); if (item) updateNewPoolOption(idx, 'name', item.name); }} placeholder="Seleziona prep..." className="w-full" />
                    ) : (
                      <SearchableSelect items={bomItems} getLabel={(bom) => `${bom.name} (${bom.outputUnit})`} getValue={(bom) => bom.id} selectedValue={componentId} onSelect={(id) => { const item = bomItems.find((b) => b.id === id); updateNewPoolOption(idx, 'componentId', id); if (item) updateNewPoolOption(idx, 'name', item.name); }} placeholder="Seleziona BoM..." className="w-full" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={opt.quantity}
                      onChange={(e) => updateNewPoolOption(idx, 'quantity', Number(e.target.value) || 1)}
                      min="0.01"
                      step="0.01"
                      placeholder="Qtà"
                      className="flex-1 sm:flex-none px-3 py-2 rounded border border-border text-xs w-16"
                    />
                    <select
                      value={opt.unit}
                      onChange={(e) => updateNewPoolOption(idx, 'unit', e.target.value)}
                      className="px-2 py-2 rounded border border-border text-xs"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={opt.priceDelta}
                      onChange={(e) => updateNewPoolOption(idx, 'priceDelta', Number(e.target.value) || 0)}
                      step="0.5"
                      placeholder="Prezzo"
                      className="flex-1 sm:flex-none px-3 py-2 rounded border border-border text-xs w-20"
                    />
                    <button
                      type="button"
                      onClick={() => removeNewPoolOption(idx)}
                      className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-danger text-danger"
                      aria-label="Rimuovi opzione"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addOptionToNewPool}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded border border-border text-[10px] font-bold uppercase tracking-wider"
          >
            + Aggiungi opzione al pool
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filteredPools.length === 0 && (
          <EmptyState
            icon={<Boxes size={24} />}
            title={pools.length === 0 ? 'Nessun pool configurato.' : 'Nessun pool corrisponde al filtro.'}
            description={pools.length === 0
              ? 'Crea un pool di modificatori per assegnare opzioni comuni ai prodotti di una categoria.'
              : 'Prova a rimuovere il filtro categoria.'}
          />
        )}
        {filteredPools.map((pool) => {
          const isEditing = editingPoolId === pool.id;
          return (
            <div key={pool.id} className="rounded border border-border bg-white p-3 space-y-2">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Modifica pool</p>
                    <div className="flex flex-wrap gap-1.5">
                      {menuCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleEditCategory(cat.id)}
                          className={`px-3 py-1.5 min-h-[44px] rounded text-[10px] font-bold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                            editCategoryIds.includes(cat.id)
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg text-secondary border-border hover:border-accent'
                          }`}
                          aria-pressed={editCategoryIds.includes(cat.id)}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nome pool"
                        className="w-full sm:flex-1 px-3 py-2 rounded border border-border text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      {editOptions.map((opt, idx) => {
                        const componentType = opt.componentType ?? 'ingredient';
                        const isIngredientMode = componentType === 'ingredient';
                        const componentId = opt.componentId ?? opt.inventoryItemId;
                        return (
                          <div key={idx} className="rounded border border-border bg-bg/30 p-2 space-y-1">
                            <div className="flex items-center gap-1">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Tipo</label>
                              <select
                                value={componentType}
                                onChange={(e) => {
                                  const nextType = e.target.value as 'ingredient' | 'prep' | 'bom';
                                  updateEditPoolOption(idx, 'componentType', nextType);
                                  updateEditPoolOption(idx, 'componentId', undefined);
                                  updateEditPoolOption(idx, 'inventoryItemId', undefined);
                                }}
                                className="px-2 py-1.5 min-h-[40px] rounded border border-border text-xs"
                              >
                                <option value="ingredient">Ingrediente</option>
                                <option value="prep">Prep</option>
                                <option value="bom">BoM</option>
                              </select>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                {isIngredientMode ? (
                                  <SearchableSelect items={inventory} getLabel={(inv) => `${inv.name} (${inv.unit})`} getValue={(inv) => inv.id} selectedValue={componentId} onSelect={(id) => { const item = inventory.find((i) => i.id === id); updateEditPoolOption(idx, 'inventoryItemId', id); updateEditPoolOption(idx, 'componentId', id); if (item) updateEditPoolOption(idx, 'name', item.name); }} placeholder="Seleziona ingrediente..." className="w-full" />
                                ) : componentType === 'prep' ? (
                                  <SearchableSelect items={prepItems} getLabel={(prep) => `${prep.name} (${prep.outputUnit})`} getValue={(prep) => prep.id} selectedValue={componentId} onSelect={(id) => { const item = prepItems.find((p) => p.id === id); updateEditPoolOption(idx, 'componentId', id); if (item) updateEditPoolOption(idx, 'name', item.name); }} placeholder="Seleziona prep..." className="w-full" />
                                ) : (
                                  <SearchableSelect items={bomItems} getLabel={(bom) => `${bom.name} (${bom.outputUnit})`} getValue={(bom) => bom.id} selectedValue={componentId} onSelect={(id) => { const item = bomItems.find((b) => b.id === id); updateEditPoolOption(idx, 'componentId', id); if (item) updateEditPoolOption(idx, 'name', item.name); }} placeholder="Seleziona BoM..." className="w-full" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={opt.quantity}
                                  onChange={(e) => updateEditPoolOption(idx, 'quantity', Number(e.target.value) || 1)}
                                  min="0.01"
                                  step="0.01"
                                  placeholder="Qtà"
                                  className="flex-1 sm:flex-none px-3 py-2 rounded border border-border text-xs w-16"
                                />
                                <select
                                  value={opt.unit}
                                  onChange={(e) => updateEditPoolOption(idx, 'unit', e.target.value)}
                                  className="px-2 py-2 rounded border border-border text-xs"
                                >
                                  {UNIT_OPTIONS.map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  value={opt.priceDelta}
                                  onChange={(e) => updateEditPoolOption(idx, 'priceDelta', Number(e.target.value) || 0)}
                                  step="0.5"
                                  placeholder="Prezzo"
                                  className="flex-1 sm:flex-none px-3 py-2 rounded border border-border text-xs w-20"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEditPoolOption(idx)}
                                  className="px-3 py-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-danger text-danger"
                                  aria-label="Rimuovi opzione"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={addOptionToEditPool}
                        className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded border border-border text-[10px] font-bold uppercase tracking-wider"
                      >
                        + Aggiungi opzione al pool
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleUpdatePool()}
                      disabled={editSaving || editCategoryIds.length === 0 || !editName.trim()}
                      className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-4 py-2 min-h-[44px] rounded bg-accent text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-60"
                    >
                      <Save size={12} />
                      {editSaving ? 'Salvataggio...' : 'Salva modifiche'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="inline-flex items-center justify-center gap-1 w-full sm:w-auto px-4 py-2 min-h-[44px] rounded border border-border text-[10px] font-bold uppercase tracking-wider"
                    >
                      <X size={12} />
                      Annulla
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-sm font-bold text-secondary">{pool.name}</span>
                      <span className="text-[10px] text-text-muted">
                        {getCategoryNames(pool)}
                      </span>
                      <span className="text-[10px] text-text-muted">· {pool.options.length} opzioni</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditing(pool)}
                        className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded border border-border text-[10px] font-bold uppercase tracking-wider"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeletePool(pool.id)}
                        className="px-4 py-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded border border-danger text-danger text-[10px]"
                        aria-label="Elimina pool"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {pool.options.map((opt) => {
                      const invItem = inventory.find((i) => i.id === opt.inventoryItemId);
                      return (
                        <span key={opt.id} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg border border-border">
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
