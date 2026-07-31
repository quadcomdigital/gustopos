import { useState, useMemo, useEffect } from 'react';
import type { Ingredient, BomItem, PrepItem, MenuRecipeComponent, UnitConversion } from '@gustopos/shared';
import { ChevronRight, ChevronDown, Package, ChefHat, Layers, Trash2, Pencil, ExternalLink } from 'lucide-react';
import ConversionHint from '../ConversionHint';

interface ComponentTreeProps {
  components: MenuRecipeComponent[];
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  onEdit: (component: MenuRecipeComponent) => void;
  onRemove: (componentType: string, componentId: string) => void;
  onQuantityChange: (componentType: string, componentId: string, qty: number) => void;
  /** Called when a sub-component inside an expanded BoM is edited/removed */
  onBomComponentEdit?: (bomId: string, action: 'update' | 'remove', payload: { componentType: string; componentId: string; quantity?: number; unit?: string }) => void;
  /** Called when user clicks 'Apri in BoM' quick-link */
  onOpenBomTab?: (bomId: string) => void;
  /** Map of ingredientId → unit conversions for conversion hints in expanded BoM rows */
  conversionsMap?: Record<string, UnitConversion[]>;
}

// ─── SubComponentRow for BoM sub-components (controlled input, no silent failures) ─

interface SubComponentRowProps {
  subComp: { componentType: string; componentId: string; quantity: number; unit: string };
  bomId: string;
  inventory: Ingredient[];
  prepItems: PrepItem[];
  bomItems: BomItem[];
  conversionsMap: Record<string, UnitConversion[]>;
  onBomComponentEdit?: (bomId: string, action: 'update' | 'remove', payload: { componentType: string; componentId: string; quantity?: number; unit?: string }) => void;
}

function SubComponentRow({
  subComp, bomId, inventory, prepItems, bomItems, conversionsMap, onBomComponentEdit,
}: SubComponentRowProps) {
  const qtyStr = String(Number.isFinite(subComp.quantity) ? subComp.quantity : 0);
  const [localQty, setLocalQty] = useState<string>(qtyStr);

  useEffect(() => {
    setLocalQty(String(Number.isFinite(subComp.quantity) ? subComp.quantity : 0));
  }, [subComp.quantity]);

  const subName =
    subComp.componentType === 'ingredient'
      ? inventory.find((i) => i.id === subComp.componentId)?.name ?? subComp.componentId
      : subComp.componentType === 'prep'
        ? prepItems.find((p) => p.id === subComp.componentId)?.name ?? subComp.componentId
        : bomItems.find((b) => b.id === subComp.componentId)?.name ?? subComp.componentId;

  const subIcon = subComp.componentType === 'prep'
    ? <ChefHat size={12} className="text-blue-600" />
    : subComp.componentType === 'bom'
      ? <Layers size={12} className="text-purple-600" />
      : <Package size={12} className="text-green-600" />;

  const subLabel = subComp.componentType === 'prep' ? 'Prep' : subComp.componentType === 'bom' ? 'BoM' : 'Ingred';

  const commit = () => {
    const v = Number(localQty);
    if (Number.isFinite(v) && v > 0 && onBomComponentEdit) {
      onBomComponentEdit(bomId, 'update', {
        componentType: subComp.componentType,
        componentId: subComp.componentId,
        quantity: v,
        unit: subComp.unit,
      });
    } else {
      setLocalQty(String(Number.isFinite(subComp.quantity) ? subComp.quantity : 0));
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-white border border-border/70 hover:border-border transition-colors group">
      <span className="shrink-0">{subIcon}</span>
      <span className="text-xs text-secondary truncate flex-1 min-w-0">{subName}</span>
      <span className="text-[8px] font-bold uppercase tracking-wider text-text-muted px-1 py-0.5 rounded bg-bg/50 shrink-0">{subLabel}</span>
      <input
        type="number"
        value={localQty}
        onChange={(e) => setLocalQty(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-14 px-1.5 py-0.5 rounded border border-border text-[10px] text-center"
        min="0.001"
        step="0.001"
      />
      <span className="text-[9px] text-text-muted shrink-0">{subComp.unit}</span>
      {subComp.componentType === 'ingredient' && (
        <ConversionHint
          conversions={conversionsMap[subComp.componentId] ?? []}
          canonicalUnit={subComp.unit}
        />
      )}
      <button
        type="button"
        onClick={() => {
          if (onBomComponentEdit) {
            onBomComponentEdit(bomId, 'remove', {
              componentType: subComp.componentType,
              componentId: subComp.componentId,
            });
          }
        }}
        className="p-1 text-text-muted hover:text-danger hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Rimuovi componente"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

interface ComponentRowProps {
  component: MenuRecipeComponent;
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  onEdit: () => void;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
  /** Called when a sub-component inside an expanded BoM is edited/removed */
  onBomComponentEdit?: (bomId: string, action: 'update' | 'remove', payload: { componentType: string; componentId: string; quantity?: number; unit?: string }) => void;
  /** Called when user clicks 'Apri in BoM' quick-link */
  onOpenBomTab?: (bomId: string) => void;
  /** Map of ingredientId → unit conversions for conversion hints */
  conversionsMap?: Record<string, UnitConversion[]>;
}

function ComponentRow({ component, inventory, bomItems, prepItems, onEdit, onRemove, onQuantityChange, onBomComponentEdit, onOpenBomTab, conversionsMap = {} }: ComponentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [localQty, setLocalQty] = useState<string>(String(component.quantity));

  // Sync local state when external quantity changes
  useEffect(() => {
    setLocalQty(String(Number.isFinite(component.quantity) ? component.quantity : 0));
  }, [component.quantity]);

  const componentName = useMemo(() => {
    if (component.componentName) return component.componentName;
    if (component.componentType === 'ingredient') return inventory.find((i) => i.id === component.componentId)?.name ?? component.componentId;
    if (component.componentType === 'prep') return prepItems.find((p) => p.id === component.componentId)?.name ?? component.componentId;
    if (component.componentType === 'bom') return bomItems.find((b) => b.id === component.componentId)?.name ?? component.componentId;
    return component.componentId;
  }, [component, inventory, bomItems, prepItems]);

  const prep = component.componentType === 'prep' ? prepItems.find((p) => p.id === component.componentId) : null;
  const ingredient = prep ? inventory.find((i) => i.id === prep.ingredientId) : null;
  const bom = component.componentType === 'bom' ? bomItems.find((b) => b.id === component.componentId) : null;

  const icon = component.componentType === 'prep'
    ? <ChefHat size={14} className="text-blue-600" />
    : component.componentType === 'bom'
      ? <Layers size={14} className="text-purple-600" />
      : <Package size={14} className="text-green-600" />;

  const typeLabel = component.componentType === 'prep' ? 'Prep' : component.componentType === 'bom' ? 'BoM' : 'Ingrediente';

  const canExpand = (component.componentType === 'prep' && prep && ingredient) || (component.componentType === 'bom' && !!bom && bom.components.length > 0);

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
          value={localQty}
          onChange={(e) => setLocalQty(e.target.value)}
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (v > 0) {
              onQuantityChange(v);
            } else {
              setLocalQty(String(Number.isFinite(component.quantity) ? component.quantity : 0));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
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

      {/* Expanded PREP detail: show underlying ingredient */}
      {expanded && component.componentType === 'prep' && prep && ingredient && (
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

      {/* Expanded BoM detail: show sub-components with inline editing */}
      {expanded && component.componentType === 'bom' && bom && (
        <div className="bg-bg/30 border-t border-border">
          <div className="ml-5 pl-3 border-l-2 border-purple-200 py-2 pr-3 space-y-1.5">
            {bom.components.length === 0 ? (
              <p className="text-[10px] text-text-muted italic px-2">Nessun componente in questo BoM</p>
            ) : (
              bom.components.map((subComp, subIdx) => (
                <SubComponentRow
                  key={`sub-${subComp.componentType}-${subComp.componentId}-${subIdx}`}
                  subComp={subComp}
                  bomId={bom.id}
                  inventory={inventory}
                  prepItems={prepItems}
                  bomItems={bomItems}
                  conversionsMap={conversionsMap}
                  onBomComponentEdit={onBomComponentEdit}
                />
              ))
            )}
            <div className="flex items-center justify-between px-2 pt-1">
              {bom.components.length > 0 && (
                <p className="text-[9px] text-text-muted italic">
                  Resa: {bom.yieldQuantity} {bom.unit} — Le modifiche si applicano al BoM
                </p>
              )}
              {onOpenBomTab && (
                <button
                  type="button"
                  onClick={() => onOpenBomTab(bom.id)}
                  className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors shrink-0"
                >
                  <ExternalLink size={10} />
                  Apri in BoM
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComponentTree({ components, inventory, bomItems, prepItems, onEdit, onRemove, onQuantityChange, onBomComponentEdit, onOpenBomTab, conversionsMap = {} }: ComponentTreeProps) {
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
      {components.map((comp, _idx) => (
        <ComponentRow
          key={`${comp.componentType}:${comp.componentId}`}
          component={comp}
          inventory={inventory}
          bomItems={bomItems}
          prepItems={prepItems}
          onEdit={() => onEdit(comp)}
          onRemove={() => onRemove(comp.componentType, comp.componentId)}
          onQuantityChange={(qty) => onQuantityChange(comp.componentType, comp.componentId, qty)}
          conversionsMap={conversionsMap}
          onBomComponentEdit={onBomComponentEdit}
            onOpenBomTab={onOpenBomTab}
        />
      ))}
    </div>
  );
}
