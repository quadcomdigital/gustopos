import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BomItem, Ingredient, PrepItem } from '@gustopos/shared';
import StatusPill from '../../shared/ui/atoms/StatusPill';
import { explodeBomCost } from './useInventoryShared';

interface BomCardsProps {
  items: BomItem[];
  inventory: Ingredient[];
  prepItems?: PrepItem[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export default function BomCards({ items, inventory, prepItems = [], onEdit, onDelete, onToggleActive }: BomCardsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ingredientNameById = new Map(inventory.map((i) => [i.id, i.name]));
  const prepNameById = new Map(prepItems.map((p) => [p.id, p.name]));

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-border tabular-nums">
      {items.map((item) => {
        const isExpanded = expanded.has(item.id);
        const totalCost = explodeBomCost(item.components, inventory, items, prepItems);
        const costPerUnit = item.yieldQuantity > 0 ? totalCost / item.yieldQuantity : 0;

        return (
          <div key={item.id}>
            <button
              onClick={() => toggle(item.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isExpanded ? <ChevronDown size={14} className="text-text-muted shrink-0" /> : <ChevronRight size={14} className="text-text-muted shrink-0" />}
                <div className="min-w-0">
                  <p className="font-bold text-primary text-sm truncate">{item.name}</p>
                  <p className="text-[11px] text-text-muted">{item.yieldQuantity} {item.outputUnit} · €{costPerUnit.toFixed(2)}/{item.outputUnit}</p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <StatusPill label={item.isActive ? 'Attivo' : 'Inattivo'} tone={item.isActive ? 'success' : 'neutral'} />
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-border/50 ml-7">
                <div className="space-y-1 pt-2">
                  {item.components.map((comp) => (
                    <p key={comp.id} className="text-xs text-secondary">
                      <span className="font-bold uppercase text-[10px] mr-1">{comp.componentType === 'ingredient' ? 'Ingred' : comp.componentType === 'prep' ? 'Prep' : 'BoM'}</span>
                      {comp.componentType === 'ingredient' ? (ingredientNameById.get(comp.componentId) ?? comp.componentId) : comp.componentType === 'prep' ? (prepNameById.get(comp.componentId) ?? comp.componentId) : comp.componentId}
                      {' · '}{comp.quantity} {comp.unit}
                    </p>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onEdit(item.id)} className="min-h-[44px] px-3 py-2 bg-bg text-secondary font-bold text-xs uppercase tracking-wider rounded-lg border border-border">Modifica</button>
                  <button onClick={() => onToggleActive(item.id, !item.isActive)} className="min-h-[44px] px-3 py-2 bg-bg text-secondary font-bold text-xs uppercase tracking-wider rounded-lg border border-border">
                    {item.isActive ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button onClick={() => onDelete(item.id)} className="min-h-[44px] px-3 py-2 bg-bg text-danger font-bold text-xs uppercase tracking-wider rounded-lg border border-danger/30">Elimina</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
