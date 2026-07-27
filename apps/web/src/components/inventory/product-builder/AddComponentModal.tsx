import { useState, useMemo } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent } from '@gustopos/shared';
import { Search, Package, ChefHat, Layers, Plus } from 'lucide-react';
import Modal from '../../../shared/ui/molecules/Modal';
import Button from '../../../shared/ui/atoms/Button';

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
}

export default function AddComponentModal({
  open, onClose, onAdd, onCreateIngredient, onCreatePrep, inventory, bomItems, prepItems, existingComponents,
}: AddComponentModalProps) {
  const [search, setSearch] = useState('');

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

  const handleAdd = (type: 'ingredient' | 'prep' | 'bom', id: string, unit: string) => {
    onAdd({ componentType: type, componentId: id, quantity: 1, unit });
    onClose();
    setSearch('');
  };

  const handleClose = () => {
    onClose();
    setSearch('');
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
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {allResults.map((item) => (
              <button
                key={`${item.type}:${item.id}`}
                type="button"
                disabled={item.existing}
                onClick={() => handleAdd(item.type, item.id, item.unit)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-left transition-colors ${
                  item.existing
                    ? 'border-border bg-bg/50 opacity-50 cursor-not-allowed'
                    : 'border-border hover:border-accent hover:bg-accent/5 cursor-pointer'
                }`}
              >
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
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-text-muted">
            {search ? 'Nessun risultato' : 'Inizia a digitare per cercare...'}
          </div>
        )}

        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Oppure crea nuovo</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { onCreateIngredient(); handleClose(); }}>
              <Package size={14} />
              Crea ingrediente
            </Button>
            <Button variant="secondary" onClick={() => { onCreatePrep(); handleClose(); }}>
              <ChefHat size={14} />
              Crea prep
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
