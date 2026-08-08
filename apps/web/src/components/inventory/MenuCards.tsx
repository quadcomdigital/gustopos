import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MenuItemAdmin } from '@gustopos/shared';
import StatusPill from '../../shared/ui/atoms/StatusPill';

interface ResolvedComponent {
  componentType: string;
  name: string;
  quantity: number;
  unit: string;
}

interface MenuCardsProps {
  items: MenuItemAdmin[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  simpleCatalogMode?: boolean;
  /** Pre-resolved recipe components (BoM exploded, containers filtered) */
  resolvedRecipes?: Record<string, ResolvedComponent[]>;
}

export default function MenuCards({ items, onEdit, onDelete, onToggleActive, simpleCatalogMode, resolvedRecipes }: MenuCardsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
                  <p className="text-[11px] text-text-muted">{item.category} · €{item.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex gap-1">
                  {item.printAreas.map((area) => (
                    <span key={area} className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-bg border border-border">{area}</span>
                  ))}
                </div>
                <StatusPill label={item.isActive ? 'Attivo' : 'Inattivo'} tone={item.isActive ? 'success' : 'neutral'} />
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-border/50 ml-7">
                {!simpleCatalogMode && (resolvedRecipes?.[item.id] ?? item.recipe).length > 0 && (
                  <div className="pt-2">
                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">Ricetta</p>
                    {(resolvedRecipes?.[item.id] ?? item.recipe).map((r: any, idx: number) => (
                      <p key={idx} className="text-xs text-secondary">
                        <span className="font-bold uppercase text-[10px] mr-1">
                          {r.componentType === 'ingredient' ? 'Ingred' : r.componentType === 'prep' ? 'Prep' : r.componentType === 'bom' ? 'BoM' : '?'}
                        </span>
                        {r.name ?? r.componentName ?? r.componentId} · {r.quantity} {r.unit}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onEdit(item.id)} className="min-h-[44px] px-3 py-2 bg-bg text-secondary font-bold text-xs uppercase tracking-wider rounded-lg border border-border">
                    {simpleCatalogMode ? 'Modifica' : 'Modifica Ricetta'}
                  </button>
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
