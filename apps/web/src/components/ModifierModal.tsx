import React, { useState, useMemo } from 'react';
import type { MenuItem, BomItem, Ingredient, MenuItemModifier, CategoryModifierPool, ModifierGroup, ModifierOption } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

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
  existingOverrides?: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
  existingSelectedModifiers?: Array<{ groupId: string; optionId: string }>;
  categoryModifierPools?: CategoryModifierPool[];
}

function collectLeafIngredientIds(
  recipe: Array<{ componentType: string; componentId: string; quantity: number; unit: string }>,
  bomItems: BomItem[],
  visited: Set<string> = new Set(),
): string[] {
  const ids: string[] = [];
  for (const comp of recipe) {
    if (comp.componentType === 'ingredient') {
      ids.push(comp.componentId);
    } else if (comp.componentType === 'bom') {
      if (visited.has(comp.componentId)) continue;
      visited.add(comp.componentId);
      const bom = bomItems.find((b) => b.id === comp.componentId);
      if (bom) {
        ids.push(...collectLeafIngredientIds(bom.components as any, bomItems, visited));
      }
    }
  }
  return ids;
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
  existingOverrides = [],
  existingSelectedModifiers = [],
  categoryModifierPools,
}: ModifierModalProps) {
  const [activeTab, setActiveTab] = useState<'togli' | 'aggiungi'>('togli');
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>({});

  const existingOverridesRef = React.useRef(existingOverrides);
  const existingSelectedModifiersRef = React.useRef(existingSelectedModifiers);

  React.useEffect(() => {
    existingOverridesRef.current = existingOverrides;
  }, [existingOverrides]);

  React.useEffect(() => {
    existingSelectedModifiersRef.current = existingSelectedModifiers;
  }, [existingSelectedModifiers]);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('togli'); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] reset modifier tab to default when modal opens; literal string, safe
      setRemovedIds(
        existingOverridesRef.current
          .filter((o) => o.action === 'remove')
          .map((o) => o.ingredientId),
      );
      setAddedIds(
        existingOverridesRef.current
          .filter((o) => o.action === 'add')
          .map((o) => o.ingredientId),
      );

      // Initialize modifier group selections from existing cart data or defaults
      const initialSelections: Record<string, string[]> = {};
      const existingMap = new Map(
        existingSelectedModifiersRef.current.map((sm) => [sm.groupId, sm.optionId]),
      );
      const modifierGroups = (item.modifierGroups ?? []) as ModifierGroup[];
      for (const group of modifierGroups) {
        const existingOptionId = existingMap.get(group.id);
        if (existingOptionId) {
          initialSelections[group.id] = [existingOptionId];
        } else {
          const defaults = group.options
            .filter((o: ModifierOption) => o.isDefault && o.isActive)
            .map((o: ModifierOption) => o.id);
          if (defaults.length > 0) {
            initialSelections[group.id] = defaults;
          } else if (group.maxSelections === 1 && group.options.length > 0) {
            const firstActive = group.options.find((o: ModifierOption) => o.isActive);
            if (firstActive) initialSelections[group.id] = [firstActive.id];
          }
        }
      }
      setGroupSelections(initialSelections);
    }
  }, [isOpen, item]);

  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const inventoryById = useMemo(() => new Map(inventory.map((e) => [e.id, e])), [inventory]);

  const leafIngredientIds = useMemo(() => {
    const ids = collectLeafIngredientIds(item.recipe ?? [], bomItems);
    return [...new Set(ids)];
  }, [item.recipe, bomItems]);

  const modifiers: MenuItemModifier[] = useMemo(() => (item as any).modifiers ?? [], [item]);

  const modifierGroups: ModifierGroup[] = useMemo(
    () => ((item.modifierGroups ?? []) as ModifierGroup[]).filter((g) => g.options.some((o: ModifierOption) => o.isActive)),
    [item.modifierGroups],
  );

  const poolOptions = useMemo(() => {
    if (!categoryModifierPools) return [];
    const pools = item.categoryId
      ? categoryModifierPools.filter((p) => p.categoryIds?.includes(item.categoryId!) || p.categoryId === item.categoryId)
      : categoryModifierPools;
    return pools.flatMap((pool) =>
      pool.options.map((o) => ({
        id: o.id,
        poolName: pool.name,
        inventoryItemId: o.inventoryItemId,
        name: o.name ?? (o.inventoryItemId ? inventoryById.get(o.inventoryItemId)?.name : undefined) ?? o.inventoryItemId ?? '',
        priceDelta: o.priceDelta,
      })),
    );
  }, [categoryModifierPools, item.categoryId, inventoryById]);

  const allAddableItems = useMemo(() => {
    const items: Array<{ id: string; name: string; subtitle?: string; priceDelta: number; invId: string }> = [];
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
      const key = opt.inventoryItemId ?? opt.id;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: opt.id,
        name: opt.name,
        subtitle: opt.poolName,
        priceDelta: opt.priceDelta,
        invId: opt.inventoryItemId ?? '',
      });
    }
    return items;
  }, [modifiers, poolOptions, inventoryById]);

  // Compute modifier group overrides and price delta
  const { groupIngredientOverrides, groupPriceDelta } = useMemo(() => {
    const overrides: Array<{ ingredientId: string; action: 'add' | 'remove' }> = [];
    let price = 0;
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      const group = modifierGroups.find((g) => g.id === groupId);
      if (!group || optionIds.length === 0) continue;
      if (group.maxSelections > 1) {
        const maxDelta = Math.max(...group.options.filter((o: ModifierOption) => optionIds.includes(o.id) && !o.isDefault).map((o: ModifierOption) => o.priceDelta));
        price += maxDelta;
      } else {
        for (const optionId of optionIds) {
          const option = group.options.find((o: ModifierOption) => o.id === optionId);
          if (!option) continue;
          // Don't apply price delta for default options — they're included in the base price
          if (!option.isDefault) {
            price += option.priceDelta;
          }
        }
      }
      for (const optionId of optionIds) {
        const option = group.options.find((o: ModifierOption) => o.id === optionId);
        if (!option) continue;
        for (const override of option.ingredientOverrides ?? []) {
          if (override.action === 'replace') {
            overrides.push({ ingredientId: override.ingredientId, action: 'remove' });
          } else {
            overrides.push({ ingredientId: override.ingredientId, action: override.action as 'add' | 'remove' });
          }
        }
      }
    }
    return { groupIngredientOverrides: overrides, groupPriceDelta: price };
  }, [groupSelections, modifierGroups]);

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

  const toggleGroupOption = (groupId: string, optionId: string) => {
    setGroupSelections((prev) => {
      const group = modifierGroups.find((g) => g.id === groupId);
      if (!group) return prev;
      const current = prev[groupId] ?? [];

      if (group.maxSelections === 1) {
        return { ...prev, [groupId]: [optionId] };
      }

      if (current.includes(optionId)) {
        const next = current.filter((id) => id !== optionId);
        if (next.length >= (group.minSelections ?? 0)) {
          return { ...prev, [groupId]: next };
        }
        return prev;
      }

      if (current.length < group.maxSelections) {
        return { ...prev, [groupId]: [...current, optionId] };
      }
      return prev;
    });
  };

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
  const groupSelectionCount = Object.values(groupSelections).reduce((sum, opts) => sum + opts.length, 0);
  const totalModCount = removedCount + addedCount + groupSelectionCount;

  // Check if all required groups have selections
  const requiredGroupsSatisfied = useMemo(() => {
    return modifierGroups.every((group) => {
      if (!group.required) return true;
      const selected = groupSelections[group.id] ?? [];
      return selected.length >= (group.minSelections ?? (group.required ? 1 : 0));
    });
  }, [modifierGroups, groupSelections]);

  const hasChanges = (removedCount > 0 || addedCount > 0 || groupSelectionCount > 0) && requiredGroupsSatisfied;

  const handleConfirm = () => {
    const ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }> = [];

    // Add modifier group overrides first
    ingredientOverrides.push(...groupIngredientOverrides);

    // Add manual remove overrides
    for (const id of removedIds) {
      ingredientOverrides.push({ ingredientId: id, action: 'remove' });
    }

    // Add manual add overrides
    const idSet = new Set(addedIds);
    for (const item of allAddableItems) {
      if (idSet.has(item.id)) {
        ingredientOverrides.push({ ingredientId: item.invId, action: 'add' });
      }
    }

    const selectedModifiers: Array<{ groupId: string; optionId: string }> = [];
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      for (const optionId of optionIds) {
        selectedModifiers.push({ groupId, optionId });
      }
    }

    onConfirm({
      ingredientOverrides,
      selectedModifiers,
      modifierPriceDelta: addedPriceDelta + groupPriceDelta,
    });
  };

  const totalAddedPrice = addedPriceDelta + groupPriceDelta;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
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

            {/* Modifier Groups Section */}
            {modifierGroups.length > 0 && (
              <div className="border-b border-border shrink-0 max-h-[35vh] overflow-y-auto">
                {modifierGroups.map((group) => {
                  const selected = groupSelections[group.id] ?? [];
                  const _isSingleSelect = group.maxSelections === 1;
                  return (
                    <div key={group.id} className="px-4 py-3 border-b border-border/50 last:border-b-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">
                          {group.name}
                        </h3>
                        {group.required && (
                          <span className="text-[9px] font-bold text-danger bg-rose-50 px-1.5 py-0.5 rounded">
                            OBBLIGATORIO
                          </span>
                        )}
                        {selected.length > 0 && (
                          <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded ml-auto">
                            {selected.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {group.options
                          .filter((o: ModifierOption) => o.isActive)
                          .map((option: ModifierOption) => {
                            const isSelected = selected.includes(option.id);
                            const badge = option.priceDelta > 0
                              ? `+€${option.priceDelta.toFixed(2)}`
                              : option.priceDelta < 0
                                ? `-€${Math.abs(option.priceDelta).toFixed(2)}`
                                : undefined;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => toggleGroupOption(group.id, option.id)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all active:scale-[0.98] text-left',
                                  isSelected
                                    ? 'border-accent bg-accent/5'
                                    : 'border-border bg-white hover:border-gray-300',
                                )}
                              >
                                <div
                                  className={cn(
                                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all',
                                    isSelected
                                      ? 'border-accent bg-accent'
                                      : 'border-gray-300 bg-white',
                                  )}
                                >
                                  {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm font-medium truncate', isSelected ? 'text-primary' : 'text-secondary')}>
                                    {option.name}
                                  </p>
                                </div>
                                {badge && (
                                  <span className={cn('text-[11px] font-bold shrink-0', isSelected ? 'text-accent' : 'text-text-muted')}>
                                    {badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setActiveTab('togli')}
                className={cn(
                  'flex-1 min-h-[44px] py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2',
                  activeTab === 'togli' ? 'text-rose-600 border-rose-600 bg-rose-50/50' : 'text-text-muted border-transparent hover:bg-bg/50',
                )}
              >
                Togli {removedCount > 0 && <span className="ml-1 bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full text-[10px]">{removedCount}</span>}
              </button>
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
                  {leafIngredientIds.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-8">Nessun ingrediente da rimuovere</p>
                  ) : (
                    leafIngredientIds.map((ingId) => {
                      const ing = inventoryById.get(ingId);
                      return (
                        <CheckboxRow
                          key={ingId}
                          label={ing?.name ?? ingId}
                          checked={removedIds.includes(ingId)}
                          onChange={() => toggleRemove(ingId)}
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
