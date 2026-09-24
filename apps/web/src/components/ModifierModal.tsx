import React, { useState, useMemo } from 'react';
import type { MenuItem, BomItem, Ingredient, PrepItem, MenuItemModifier, CategoryModifierPool, ModifierOption } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { computeGroupModifierDelta } from '../lib/modifier-pricing';
import { useBackdropDismiss } from '../hooks/useBackdropDismiss';
import { lockBodyScroll, unlockBodyScroll } from '../shared/ui/utils/scrollLock';

interface ModifierModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
    selectedModifiers: Array<{ groupId: string; optionId: string }>;
    modifierPriceDelta: number;
  }) => void;
  inventory: Ingredient[];
  bomItems: BomItem[];
  prepItems: PrepItem[];
  existingOverrides?: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
  existingSelectedModifiers?: Array<{ groupId: string; optionId: string }>;
  existingModifierPriceDelta?: number;
  categoryModifierPools?: CategoryModifierPool[];
}

type LeafComponent = {
  componentType: 'ingredient' | 'prep';
  componentId: string;
  componentName?: string;
  quantity: number;
  unit: string;
};

/**
 * Pool options of this item's category that are already persisted as
 * selectedModifiers. They carry their price inside the existing
 * `modifierPriceDelta`, so both the "added" set and the existing-price
 * subtraction must account for them (see ModifierModal).
 */
function restorablePoolOptionIds(
  existingSelectedModifiers: Array<{ groupId: string; optionId: string }>,
  item: MenuItem,
  categoryModifierPools?: CategoryModifierPool[],
): string[] {
  if (!categoryModifierPools || existingSelectedModifiers.length === 0) return [];
  const pools = item.categoryId
    ? categoryModifierPools.filter((p) => p.categoryIds?.includes(item.categoryId!) || p.categoryId === item.categoryId)
    : categoryModifierPools;
  const selectedKeys = new Set(existingSelectedModifiers.map((s) => `${s.groupId}:${s.optionId}`));
  const ids: string[] = [];
  for (const pool of pools) {
    for (const option of pool.options) {
      if (option.isActive === false) continue;
      if (selectedKeys.has(`${pool.id}:${option.id}`)) ids.push(option.id);
    }
  }
  return ids;
}

function collectLeafIngredientIds(
  recipe: Array<{ componentType: string; componentId: string; componentName?: string; quantity: number; unit: string }>,
  bomItems: BomItem[],
  visited: Set<string> = new Set(),
): LeafComponent[] {
  const components: LeafComponent[] = [];
  for (const comp of recipe) {
    if (comp.componentType === 'ingredient' || comp.componentType === 'prep') {
      components.push({
        componentType: comp.componentType,
        componentId: comp.componentId,
        componentName: comp.componentName,
        quantity: comp.quantity,
        unit: comp.unit,
      });
    } else if (comp.componentType === 'bom') {
      if (visited.has(comp.componentId)) continue;
      visited.add(comp.componentId);
      const bom = bomItems.find((b) => b.id === comp.componentId);
      if (bom) {
        components.push(...collectLeafIngredientIds(bom.components as any, bomItems, visited));
      }
    }
  }
  return components;
}

function CheckboxRow({
  label,
  subtitle,
  checked,
  onChange,
  badge,
  variant = 'default',
}: {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: () => void;
  badge?: string;
  variant?: 'default' | 'danger' | 'accent';
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98] text-left',
        checked
          ? variant === 'danger'
            ? 'border-rose-400 bg-rose-50'
            : 'border-emerald-400 bg-emerald-50'
          : 'border-border bg-white hover:border-gray-300',
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
          checked
            ? variant === 'danger'
              ? 'border-rose-500 bg-rose-500'
              : 'border-emerald-500 bg-emerald-500'
            : 'border-gray-300 bg-white',
        )}
      >
        {checked && <Check size={12} className="text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', checked ? 'text-primary' : 'text-secondary')}>
          {label}
        </p>
        {subtitle && <p className="text-[10px] text-text-muted truncate">{subtitle}</p>}
      </div>
      {badge && (
        <span className={cn('text-[11px] font-bold shrink-0', checked ? 'text-emerald-700' : 'text-text-muted')}>
          {badge}
        </span>
      )}
    </button>
  );
}

export default function ModifierModal({
  item,
  isOpen,
  onClose,
  onConfirm,
  inventory,
  bomItems,
  prepItems,
  existingOverrides = [],
  existingSelectedModifiers = [],
  existingModifierPriceDelta = 0,
  categoryModifierPools,
}: ModifierModalProps) {
  const [activeTab, setActiveTab] = useState<'togli' | 'aggiungi'>('togli');
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>({});
  const existingOverridesRef = React.useRef(existingOverrides);

  React.useEffect(() => {
    existingOverridesRef.current = existingOverrides;
  }, [existingOverrides]);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab((item.recipe?.length ?? 0) > 0 ? 'togli' : 'aggiungi'); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] reset modifier tab to default when modal opens; literal string, safe
      setRemovedIds(
        existingOverridesRef.current
          .filter((o) => o.action === 'remove')
          .map((o) => o.ingredientId),
      );
      setAddedIds([
        ...existingOverridesRef.current
          .filter((o) => o.action === 'add')
          .map((o) => o.ingredientId),
        // Pool options (e.g. MAXI) are persisted as selectedModifiers, not as
        // ingredient overrides. Restore them so the option reads as selected
        // on re-open — otherwise a second confirm would charge it twice.
        // Read from the raw prop (declared above) rather than `poolOptions`,
        // which is initialised later in the component body.
        ...restorablePoolOptionIds(existingSelectedModifiers, item, categoryModifierPools),
      ]);
      const initialSelections: Record<string, string[]> = {};
      const selectedMap = new Map(existingSelectedModifiers.map((selected) => [selected.groupId, selected.optionId]));
      for (const group of (item.modifierGroups ?? [])) {
        if (group.name.trim().toLowerCase() === 'base') continue;
        const existingOptionId = selectedMap.get(group.id);
        if (existingOptionId) {
          initialSelections[group.id] = [existingOptionId];
        } else {
          const defaults = group.options.filter((option) => option.isDefault && option.isActive).map((option) => option.id);
          if (defaults.length > 0) initialSelections[group.id] = defaults;
          else if (group.maxSelections === 1 && group.options.length > 0) {
            const first = group.options.find((option) => option.isActive);
            if (first) initialSelections[group.id] = [first.id];
          }
        }
      }
      setGroupSelections(initialSelections);
    }
  }, [existingSelectedModifiers, isOpen, item]);

  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
  const backdropDismiss = useBackdropDismiss(onClose);

  React.useEffect(() => {
    if (!isOpen) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    lockBodyScroll();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen, onClose]);

  const inventoryById = useMemo(() => new Map(inventory.map((e) => [e.id, e])), [inventory]);
  const prepById = useMemo(() => new Map(prepItems.map((prep) => [prep.id, prep])), [prepItems]);
  const modifierGroups = useMemo(
    () => ((item.modifierGroups ?? []) as Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; multiSelectPriceMode?: 'max' | 'sum' | 'none'; options: ModifierOption[] }>)
      .filter((group) => group.name.trim().toLowerCase() !== 'base' && group.options.some((option) => option.isActive)),
    [item.modifierGroups],
  );

  const leafComponents = useMemo(() => {
    const components = collectLeafIngredientIds(item.recipe ?? [], bomItems);
    const byId = new Map<string, LeafComponent>();
    for (const component of components) {
      const existing = byId.get(component.componentId);
      if (existing && existing.unit === component.unit && existing.componentType === component.componentType) {
        existing.quantity += component.quantity;
      } else if (!existing) {
        byId.set(component.componentId, { ...component });
      }
    }
    const labelOf = (component: LeafComponent) =>
      inventoryById.get(component.componentId)?.name
      ?? prepById.get(component.componentId)?.name
      ?? component.componentName
      ?? component.componentId;
    return [...byId.values()].sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'it', { sensitivity: 'base' }));
  }, [item.recipe, bomItems, inventoryById, prepById]);

  const modifiers: MenuItemModifier[] = useMemo(() => (item as any).modifiers ?? [], [item]);

  const poolOptions = useMemo(() => {
    if (!categoryModifierPools) return [];
    const pools = item.categoryId
      ? categoryModifierPools.filter((p) => p.categoryIds?.includes(item.categoryId!) || p.categoryId === item.categoryId)
      : categoryModifierPools;
    return pools.flatMap((pool) =>
      // Disabled options are not purchasable.
      pool.options.filter((o) => o.isActive !== false).map((o) => ({
        id: o.id,
        poolId: pool.id,
        poolName: pool.name,
        inventoryItemId: o.inventoryItemId,
        componentId: o.componentId,
        componentType: o.componentType ?? 'ingredient',
        quantity: o.quantity ?? 1,
        unit: o.unit ?? 'pz',
        name: o.name ?? (o.inventoryItemId ? inventoryById.get(o.inventoryItemId)?.name : undefined) ?? o.inventoryItemId ?? o.componentId ?? '',
        priceDelta: o.priceDelta,
        priceMultiplier: o.priceMultiplier ?? undefined,
      })),
    );
  }, [categoryModifierPools, item.categoryId, inventoryById]);

  /**
   * Cost of one "add" entry as shown in the list: a priceMultiplier option
   * (MAXI) costs `item.price × (m - 1)` plus its flat delta.
   */
  const addableDelta = useMemo(() => {
    return (option: { priceDelta: number; priceMultiplier?: number }): number => {
      const multiplier = option.priceMultiplier;
      const scaled =
        typeof multiplier === 'number' && Number.isFinite(multiplier) && multiplier !== 1
          ? item.price * (multiplier - 1)
          : 0;
      return scaled + option.priceDelta;
    };
  }, [item.price]);

  const allAddableItems = useMemo(() => {
    const items: Array<{ id: string; name: string; subtitle?: string; priceDelta: number; invId: string; componentType?: string; poolId?: string }> = [];
    const seen = new Set<string>();
    for (const mod of modifiers) {
      if (seen.has(mod.inventoryItemId)) continue;
      seen.add(mod.inventoryItemId);
      items.push({
        id: mod.inventoryItemId,
        name: mod.name ?? mod.inventoryItemId,
        subtitle: inventoryById.get(mod.inventoryItemId)?.unit,
        priceDelta: mod.effectivePrice ?? mod.priceDelta,
        invId: mod.inventoryItemId,
      });
    }
    for (const opt of poolOptions) {
      const key = opt.inventoryItemId ?? opt.componentId ?? opt.id;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: opt.id,
        name: opt.name,
        subtitle: opt.poolName,
        priceDelta: addableDelta(opt),
        componentType: opt.componentType,
        poolId: opt.poolId,
        // Pool options may reference a prep/BoM (componentId) instead of an
        // inventory ingredient — carry the component reference so the add
        // override reaches the right stock target.
        invId: opt.inventoryItemId ?? opt.componentId ?? '',
      });
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
  }, [modifiers, poolOptions, inventoryById, addableDelta]);

  const toggleRemove = (ingredientId: string) => {
    setRemovedIds((prev) =>
      prev.includes(ingredientId)
        ? prev.filter((id) => id !== ingredientId)
        : [...prev, ingredientId],
    );
  };

  const toggleAdd = (id: string) => {
    setAddedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const groupPriceDelta = useMemo(() => {
    let total = 0;
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      const group = modifierGroups.find((candidate) => candidate.id === groupId);
      if (!group || optionIds.length === 0) continue;
      total += computeGroupModifierDelta(group, optionIds, item.price);
    }
    return total;
  }, [groupSelections, modifierGroups, item.price]);

  const existingGroupPriceDelta = useMemo(() => {
    let total = 0;
    for (const selected of existingSelectedModifiers) {
      const group = modifierGroups.find((candidate) => candidate.id === selected.groupId);
      const option = group?.options.find((candidate) => candidate.id === selected.optionId);
      if (!option || option.isDefault) continue;
      total += computeGroupModifierDelta(group!, [option.id], item.price);
    }
    return total;
  }, [existingSelectedModifiers, modifierGroups, item.price]);

  const existingAddedPriceDelta = useMemo(() => {
    const ids = new Set(existingOverrides.filter((override) => override.action === 'add').map((override) => override.ingredientId));
    // Mirror of the addedIds restore above: pool options persisted as
    // selectedModifiers already carry their price inside the existing delta,
    // so they must be subtracted here or the price would be counted twice.
    const restoredPoolIds = new Set(
      allAddableItems
        .filter((option) => option.poolId && existingSelectedModifiers.some((s) => s.groupId === option.poolId && s.optionId === option.id))
        .map((option) => option.id),
    );
    return allAddableItems
      .filter((option) => ids.has(option.id) || restoredPoolIds.has(option.id))
      .reduce((sum, option) => sum + option.priceDelta, 0);
  }, [allAddableItems, existingOverrides, existingSelectedModifiers]);

  const selectedModifiers = useMemo(() => {
    const baseSelections = existingSelectedModifiers.filter((selected) => !modifierGroups.some((group) => group.id === selected.groupId));
    return [
      ...baseSelections,
      ...Object.entries(groupSelections).flatMap(([groupId, optionIds]) => optionIds.map((optionId) => ({ groupId, optionId }))),
    ];
  }, [existingSelectedModifiers, groupSelections, modifierGroups]);

  const addedPriceDelta = useMemo(() => {
    let total = 0;
    const idSet = new Set(addedIds);
    for (const item of allAddableItems) {
      if (idSet.has(item.id)) total += item.priceDelta;
    }
    return total;
  }, [addedIds, allAddableItems]);

  const removedCount = removedIds.length;
  const addedCount = addedIds.length;
  const totalModCount = removedCount + addedCount + selectedModifiers.length;
  const requiredGroupsSatisfied = modifierGroups.every((group) => !group.required || (groupSelections[group.id] ?? []).length >= (group.minSelections ?? 1));
  // A change exists if there is any active selection OR the current state
  // differs from what was persisted on the cart item. Without the comparison
  // branch, un-toggling a persisted "TOGLI" (or add) would zero out every
  // counter and disable CONFERMA even though the user must confirm the
  // removal of that override.
  const removedChanged = removedCount !== existingOverrides.filter((o) => o.action === 'remove').length
    || removedIds.some((id) => !existingOverrides.some((o) => o.action === 'remove' && o.ingredientId === id));
  const addedChanged = addedCount !== existingOverrides.filter((o) => o.action === 'add').length
    || addedIds.some((id) => !existingOverrides.some((o) => o.action === 'add' && o.ingredientId === id));
  const modifiersChanged = selectedModifiers.length !== existingSelectedModifiers.length
    || selectedModifiers.some((sm) => !existingSelectedModifiers.some((e) => e.groupId === sm.groupId && e.optionId === sm.optionId));
  const hasChanges = (removedCount > 0 || addedCount > 0 || selectedModifiers.length > 0 || removedChanged || addedChanged || modifiersChanged) && requiredGroupsSatisfied;

  const handleConfirm = () => {
    const overridesByKey = new Map<string, { ingredientId: string; action: 'add' | 'remove' }>();
    for (const id of removedIds) {
      overridesByKey.set(`${id}:remove`, { ingredientId: id, action: 'remove' });
    }
    const addedIdSet = new Set(addedIds);
    const poolModifiers: Array<{ groupId: string; optionId: string }> = [];
    for (const option of allAddableItems) {
      if (addedIdSet.has(option.id)) {
        // Pool options referencing a prep or BoM are tracked as selected
        // modifiers so the server resolves their quantity/unit (e.g. 150 g of
        // "Pollo grigliato" per add) instead of scaling a bare ingredient.
        if (option.componentType === 'prep' || option.componentType === 'bom') {
          if (option.poolId) poolModifiers.push({ groupId: option.poolId, optionId: option.id });
        } else if (option.invId) {
          overridesByKey.set(`${option.invId}:add`, { ingredientId: option.invId, action: 'add' });
        } else if (option.poolId) {
          // Free-text pool option (simple_catalog: no inventory link): persist
          // it as the pool selection so createOrder prices it and the ticket
          // prints its name. Without this branch the add was silently dropped.
          poolModifiers.push({ groupId: option.poolId, optionId: option.id });
        }
      }
    }
    for (const selected of selectedModifiers) {
      const group = modifierGroups.find((candidate) => candidate.id === selected.groupId);
      const option = group?.options.find((candidate) => candidate.id === selected.optionId);
      for (const override of option?.ingredientOverrides ?? []) {
        overridesByKey.set(`${override.ingredientId}:${override.action}`, {
          ingredientId: override.ingredientId,
          action: override.action as 'add' | 'remove',
        });
      }
    }

    onConfirm({
      ingredientOverrides: [...overridesByKey.values()],
      selectedModifiers: [...selectedModifiers, ...poolModifiers],
      modifierPriceDelta: existingModifierPriceDelta - existingGroupPriceDelta - existingAddedPriceDelta + groupPriceDelta + addedPriceDelta,
    });
  };

  const totalAddedPrice = addedPriceDelta + groupPriceDelta;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" {...backdropDismiss} />
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative bg-white w-full sm:max-w-md md:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] sm:max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-base font-bold text-primary leading-tight truncate">{item.name}</h2>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Modifica ordine</p>
              </div>
              <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 hover:bg-bg rounded-full transition-colors text-text-muted shrink-0"><X size={18} /></button>
            </div>

            <div className="flex border-b border-border shrink-0">
              {(item.recipe?.length ?? 0) > 0 && (
              <button
                onClick={() => setActiveTab('togli')}
                className={cn(
                  'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2',
                  activeTab === 'togli' ? 'text-rose-600 border-rose-600 bg-rose-50/50' : 'text-text-muted border-transparent hover:bg-bg/50',
                )}
              >
                Togli {removedCount > 0 && <span className="ml-1 bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px]">{removedCount}</span>}
              </button>
              )}
              <button
                onClick={() => setActiveTab('aggiungi')}
                className={cn(
                  'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2',
                  activeTab === 'aggiungi' ? 'text-emerald-600 border-emerald-600 bg-emerald-50/50' : 'text-text-muted border-transparent hover:bg-bg/50',
                )}
              >
                Aggiungi {addedCount > 0 && <span className="ml-1 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[9px]">{addedCount}</span>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {activeTab === 'togli' && (
                <div className="space-y-1">
                  {leafComponents.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">Nessun ingrediente da rimuovere</p>
                  ) : (
                    leafComponents.map((component) => {
                      const ing = inventoryById.get(component.componentId);
                      const prep = prepById.get(component.componentId);
                      const label = ing?.name ?? prep?.name ?? component.componentName ?? component.componentId;
                      const subtitle = `${component.quantity} ${component.unit}`;
                      return (
                        <CheckboxRow
                          key={`${component.componentType}:${component.componentId}`}
                          label={label}
                          subtitle={subtitle}
                          checked={removedIds.includes(component.componentId)}
                          onChange={() => toggleRemove(component.componentId)}
                          variant="danger"
                        />
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'aggiungi' && (
                <div className="space-y-1">
                  {allAddableItems.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">Nessuna opzione disponibile</p>
                  ) : (
                    allAddableItems.map((opt) => {
                      const priceLabel = opt.priceDelta > 0 ? `+€${opt.priceDelta.toFixed(2)}` : opt.priceDelta < 0 ? `-€${Math.abs(opt.priceDelta).toFixed(2)}` : undefined;
                      return (
                        <CheckboxRow
                          key={opt.id}
                          label={opt.name}
                          subtitle={opt.subtitle}
                          checked={addedIds.includes(opt.id)}
                          onChange={() => toggleAdd(opt.id)}
                          badge={priceLabel}
                        />
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-border shrink-0 space-y-2">
              {totalAddedPrice > 0 && (
                <p className="text-[10px] text-center text-accent font-bold">+€{totalAddedPrice.toFixed(2)} extra</p>
              )}
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-xs font-bold uppercase tracking-wider text-text-muted active:bg-bg transition-all">Annulla</button>
                <button
                  ref={confirmButtonRef}
                  onClick={handleConfirm}
                  disabled={!hasChanges}
                  className={cn(
                    'flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]',
                    hasChanges ? 'bg-accent text-white shadow-md active:bg-blue-800' : 'bg-bg text-text-muted border border-border',
                  )}
                >
                  Conferma {totalModCount > 0 ? `(${totalModCount})` : ''}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
