import type { Category, Ingredient, CategoryModifierPool } from '@gustopos/shared';
import { Trash2, Save, X } from 'lucide-react';
import { useState } from 'react';
import SearchableSelect from '../../shared/ui/molecules/SearchableSelect';

interface CategoryPoolEditorProps {
  pools: CategoryModifierPool[];
  menuCategories: Category[];
  inventory: Ingredient[];
  onCreatePool: (payload: { categoryIds: string[]; name: string; options: Array<{ inventoryItemId?: string; name?: string; priceDelta: number; sortOrder: number }> }) => Promise<void>;
  onUpdatePool: (id: string, payload: { name?: string; categoryIds?: string[]; options?: Array<{ inventoryItemId?: string; name?: string; priceDelta: number; sortOrder: number }> }) => Promise<void>;
  onDeletePool: (id: string) => Promise<void>;
}

export default function CategoryPoolEditor({
  pools,
  menuCategories,
  inventory,
  onCreatePool,
  onUpdatePool,
  onDeletePool,
}: CategoryPoolEditorProps) {
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolOptions, setNewPoolOptions] = useState<Array<{ inventoryItemId?: string; name?: string; priceDelta: number; sortOrder: number }>>([]);
  const [saving, setSaving] = useState(false);

  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editOptions, setEditOptions] = useState<Array<{ inventoryItemId?: string; name?: string; priceDelta: number; sortOrder: number }>>([]);
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
    setNewPoolOptions([...newPoolOptions, { inventoryItemId: undefined, name: '', priceDelta: 0, sortOrder: newPoolOptions.length }]);
  };

  const updateNewPoolOption = (idx: number, field: 'inventoryItemId' | 'priceDelta' | 'name', value: string | number | undefined) => {
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
    setEditOptions(pool.options.map((o) => ({ inventoryItemId: o.inventoryItemId, name: o.name, priceDelta: o.priceDelta, sortOrder: o.sortOrder })));
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
    setEditOptions([...editOptions, { inventoryItemId: undefined, name: '', priceDelta: 0, sortOrder: editOptions.length }]);
  };

  const updateEditPoolOption = (idx: number, field: 'inventoryItemId' | 'priceDelta' | 'name', value: string | number | undefined) => {
    setEditOptions((prev) => prev.map((opt, i) => (i === idx ? { ...opt, [field]: value } : opt)));
  };

  const removeEditPoolOption = (idx: number) => {
    setEditOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
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
              className={`px-3 py-1.5 min-h-[40px] rounded text-[10px] font-bold border transition-all ${
                selectedCategoryIds.includes(cat.id)
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg text-secondary border-border hover:border-accent'
              }`}
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
            const isIngredientMode = !!opt.inventoryItemId;
            return (
              <div key={idx} className="rounded border border-border bg-bg/30 p-2 space-y-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isIngredientMode) {
                        updateNewPoolOption(idx, 'inventoryItemId', undefined);
                      } else {
                        const first = inventory[0];
                        updateNewPoolOption(idx, 'inventoryItemId', first?.id);
                        if (first) updateNewPoolOption(idx, 'name', first.name);
                      }
                    }}
                    className={`px-3 py-1.5 min-h-[40px] rounded text-[9px] font-bold uppercase tracking-wider border ${isIngredientMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                  >
                    {isIngredientMode ? 'Ingrediente' : 'Testo libero'}
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    {isIngredientMode ? (
                      <SearchableSelect
                        items={inventory}
                        getLabel={(inv) => `${inv.name} (${inv.unit})`}
                        getValue={(inv) => inv.id}
                        selectedValue={opt.inventoryItemId}
                        onSelect={(invId) => {
                          const invItem = inventory.find((i) => i.id === invId);
                          updateNewPoolOption(idx, 'inventoryItemId', invId);
                          if (invItem) updateNewPoolOption(idx, 'name', invItem.name);
                        }}
                        placeholder="Seleziona ingrediente..."
                        className="w-full"
                      />
                    ) : (
                      <input
                        value={opt.name ?? ''}
                        onChange={(e) => updateNewPoolOption(idx, 'name', e.target.value)}
                        className="w-full px-3 py-2 rounded border border-border text-xs"
                        placeholder="Nome opzione (es: Formato grande)"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
            + Aggiungi ingrediente al pool
          </button>
        </div>
      </div>

      <div className="space-y-2">
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
                          className={`px-3 py-1.5 min-h-[40px] rounded text-[10px] font-bold border transition-all ${
                            editCategoryIds.includes(cat.id)
                              ? 'bg-accent text-white border-accent'
                              : 'bg-bg text-secondary border-border hover:border-accent'
                          }`}
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
                        const isIngredientMode = !!opt.inventoryItemId;
                        return (
                          <div key={idx} className="rounded border border-border bg-bg/30 p-2 space-y-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isIngredientMode) {
                                    updateEditPoolOption(idx, 'inventoryItemId', undefined);
                                  } else {
                                    const first = inventory[0];
                                    updateEditPoolOption(idx, 'inventoryItemId', first?.id);
                                    if (first) updateEditPoolOption(idx, 'name', first.name);
                                  }
                                }}
                                className={`px-3 py-1.5 min-h-[40px] rounded text-[9px] font-bold uppercase tracking-wider border ${isIngredientMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                              >
                                {isIngredientMode ? 'Ingrediente' : 'Testo libero'}
                              </button>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <div className="flex-1 min-w-0">
                                {isIngredientMode ? (
                                  <SearchableSelect
                                    items={inventory}
                                    getLabel={(inv) => `${inv.name} (${inv.unit})`}
                                    getValue={(inv) => inv.id}
                                    selectedValue={opt.inventoryItemId}
                                    onSelect={(invId) => {
                                      const invItem = inventory.find((i) => i.id === invId);
                                      updateEditPoolOption(idx, 'inventoryItemId', invId);
                                      if (invItem) updateEditPoolOption(idx, 'name', invItem.name);
                                    }}
                                    placeholder="Seleziona ingrediente..."
                                    className="w-full"
                                  />
                                ) : (
                                  <input
                                    value={opt.name ?? ''}
                                    onChange={(e) => updateEditPoolOption(idx, 'name', e.target.value)}
                                    className="w-full px-3 py-2 rounded border border-border text-xs"
                                    placeholder="Nome opzione (es: Formato grande)"
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
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
                        <span key={opt.id} className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-bg border border-border">
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
