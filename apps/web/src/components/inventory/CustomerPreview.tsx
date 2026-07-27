import { useMemo } from 'react';
import type { MenuItemAdmin, Ingredient } from '@gustopos/shared';
import { ShoppingCart, Plus } from 'lucide-react';

interface CustomerPreviewProps {
  item: MenuItemAdmin;
  inventory: Ingredient[];
}

export default function CustomerPreview({ item, inventory }: CustomerPreviewProps) {
  const inventoryById = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory]);

  const totalModifierPrice = useMemo(() => {
    let total = 0;
    for (const mod of item.modifiers ?? []) {
      const inv = inventoryById.get(mod.inventoryItemId);
      total += (mod.effectivePrice ?? mod.priceDelta) ?? (inv?.salePrice ?? 0);
    }
    return total;
  }, [item.modifiers, inventoryById]);

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        Anteprima cliente
      </p>
      <p className="text-[9px] text-text-muted italic">
        Ecco come appare questo prodotto nel POS del cliente.
      </p>

      <div className="rounded-xl border-2 border-accent/30 bg-white overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-accent to-accent/80 px-4 py-3">
          <p className="text-white font-bold text-lg">{item.name}</p>
          <p className="text-white/80 text-sm">€{item.price.toFixed(2)}</p>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <ShoppingCart size={14} />
            <span>Quantità: 1</span>
          </div>

          {item.modifiers.length > 0 && (
            <div className="border-t border-border pt-2 mt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
                Extra disponibili
              </p>
              <div className="space-y-1">
                {item.modifiers.map((mod) => {
                  const inv = inventoryById.get(mod.inventoryItemId);
                  const price = (mod.effectivePrice ?? mod.priceDelta) ?? (inv?.salePrice ?? 0);
                  return (
                    <div key={mod.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-bg border border-border">
                      <div className="flex items-center gap-2">
                        <Plus size={12} className="text-accent" />
                        <span className="text-sm font-medium text-secondary">{inv?.name ?? mod.name ?? mod.inventoryItemId}</span>
                      </div>
                      {price > 0 && (
                        <span className="text-xs font-bold text-accent">+€{price.toFixed(2)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {item.modifierGroups && item.modifierGroups.length > 0 && (
            <div className="border-t border-border pt-2 mt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
                Gruppi modificatori
              </p>
              <div className="space-y-2">
                {item.modifierGroups.map((group) => (
                  <div key={group.id}>
                    <p className="text-[10px] font-bold text-text-muted uppercase">{group.name}</p>
                    {group.options.filter(o => o.isActive).map((opt) => (
                      <p key={opt.id} className="text-xs text-secondary">
                        {opt.name} {opt.priceDelta !== 0 && `(+€${opt.priceDelta.toFixed(2)})`}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.modifiers.length === 0 && (!item.modifierGroups || item.modifierGroups.length === 0) && (
            <p className="text-xs text-text-muted italic">Nessun extra configurato per questo prodotto.</p>
          )}

          <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Totale</span>
            <span className="text-lg font-extrabold text-primary">€{(item.price + totalModifierPrice).toFixed(2)}</span>
          </div>
        </div>

        <div className="px-3 pb-3">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest text-center">
            Anteprima cliente
          </p>
        </div>
      </div>
    </div>
  );
}
