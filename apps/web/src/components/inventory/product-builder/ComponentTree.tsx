import { useState, useMemo } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent } from '@gustopos/shared';
import { ChevronRight, ChevronDown, Package, ChefHat, Layers, Trash2, Pencil, AlertTriangle } from 'lucide-react';

interface ComponentTreeProps {
  components: MenuRecipeComponent[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  onEdit: (component: MenuRecipeComponent) => void;
  onRemove: (componentType: string, componentId: string) => void;
  onQuantityChange: (componentType: string, componentId: string, qty: number) => void;
}

interface ComponentRowProps {
  component: MenuRecipeComponent;
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  onEdit: () => void;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
}

function ComponentRow({ component, inventory, bomItems, prepItems, onEdit, onRemove, onQuantityChange }: ComponentRowProps) {
  const [expanded, setExpanded] = useState(false);

  const componentName = useMemo(() => {
    if (component.componentName) return component.componentName;
    if (component.componentType === 'ingredient') return inventory.find((i) => i.id === component.componentId)?.name ?? component.componentId;
    if (component.componentType === 'prep') return prepItems.find((p) => p.id === component.componentId)?.name ?? component.componentId;
    if (component.componentType === 'bom') return bomItems.find((b) => b.id === component.componentId)?.name ?? component.componentId;
    return component.componentId;
  }, [component, inventory, bomItems, prepItems]);

  const prep = component.componentType === 'prep' ? prepItems.find((p) => p.id === component.componentId) : null;
  const ingredient = prep ? inventory.find((i) => i.id === prep.ingredientId) : null;

  const icon = component.componentType === 'prep'
    ? <ChefHat size={14} className="text-blue-600" />
    : component.componentType === 'bom'
      ? <Layers size={14} className="text-purple-600" />
      : <Package size={14} className="text-green-600" />;

  const typeLabel = component.componentType === 'prep' ? 'Prep' : component.componentType === 'bom' ? 'BoM' : 'Ingrediente';

  const canExpand = component.componentType === 'prep' && prep && ingredient;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-bg/50 transition-colors">
        {canExpand ? (
          <button type="button" onClick={() => setExpanded(!expanded)} className="p-0.5 text-text-muted hover:text-primary">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <span className="shrink-0">{icon}</span>

        <span className="text-sm font-medium text-primary truncate flex-1 min-w-0">{componentName}</span>

        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted shrink-0 px-1.5 py-0.5 rounded bg-bg">{typeLabel}</span>

        <input
          type="number"
          value={component.quantity}
          onChange={(e) => { const v = Number(e.target.value); if (v > 0) onQuantityChange(v); }}
          className="w-16 px-2 py-1 rounded border border-border text-xs text-center"
          min="0.001"
          step="0.001"
        />
        <span className="text-[10px] text-text-muted shrink-0">{component.unit}</span>

        <button type="button" onClick={onEdit} className="p-1.5 text-text-muted hover:text-primary hover:bg-bg rounded transition-colors" aria-label="Modifica">
          <Pencil size={13} />
        </button>
        <button type="button" onClick={onRemove} className="p-1.5 text-text-muted hover:text-danger hover:bg-red-50 rounded transition-colors" aria-label="Rimuovi">
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && canExpand && prep && ingredient && (
        <div className="px-3 py-2 bg-bg/30 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Package size={12} />
            <span className="font-medium">{ingredient.name}</span>
            <span>→</span>
            <span>{Number(prep.quantityPerUnit)} {prep.unit}</span>
            <span className="text-[9px] text-text-muted ml-auto">Costo: €{(Number(prep.quantityPerUnit) * (ingredient.unitCost ?? 0)).toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComponentTree({ components, inventory, bomItems, prepItems, onEdit, onRemove, onQuantityChange }: ComponentTreeProps) {
  if (components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ChefHat size={32} className="text-text-muted/40 mb-2" />
        <p className="text-sm text-text-muted">Nessun componente</p>
        <p className="text-[11px] text-text-muted/70 mt-1">Clicca "Aggiungi componente" per iniziare</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {components.map((comp, idx) => (
        <ComponentRow
          key={`${comp.componentType}:${comp.componentId}`}
          component={comp}
          inventory={inventory}
          bomItems={bomItems}
          prepItems={prepItems}
          onEdit={() => onEdit(comp)}
          onRemove={() => onRemove(comp.componentType, comp.componentId)}
          onQuantityChange={(qty) => onQuantityChange(comp.componentType, comp.componentId, qty)}
        />
      ))}
    </div>
  );
}
