import React, { useState, useMemo } from 'react';
import type { CartItem, Ingredient, MenuItem, CategoryModifierPool, ModifierGroup, ModifierOption } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, ShoppingCart, Settings, Check } from 'lucide-react';
import { cn } from '../lib/utils';

function parseExistingToppings(
  fullNotes: string,
  toppingOptions: Array<{ id: string; name: string }>,
): { cleanNotes: string; selectedIds: string[] } {
  if (!fullNotes || toppingOptions.length === 0) return { cleanNotes: fullNotes, selectedIds: [] };
  const nameToId = new Map(toppingOptions.map((o) => [o.name, o.id]));
  const parts = fullNotes.split(', ');
  const selectedIds: string[] = [];
  let i = parts.length - 1;
  while (i >= 0 && nameToId.has(parts[i])) {
    selectedIds.unshift(nameToId.get(parts[i])!);
    i--;
  }
  return { cleanNotes: parts.slice(0, i + 1).join(', '), selectedIds };
}

interface POSProductModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    item: MenuItem,
    quantity: number,
    notes: string,
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>,
    selectedModifiers: Array<{ groupId: string; optionId: string }>,
    modifierPriceDelta: number,
  ) => void;
  inventory: Ingredient[];
  orderMode: 'dine_in' | 'takeaway' | 'delivery';
  existingCartItem?: CartItem;
  menuItems: MenuItem[];
  onOpenModifierModal?: () => void;
  categoryModifierPools?: CategoryModifierPool[];
}

export default function POSProductModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  inventory,
  orderMode: _orderMode,
  existingCartItem,
  menuItems,
  onOpenModifierModal,
  categoryModifierPools = [],
}: POSProductModalProps) {
  const [quantity, setQuantity] = useState(existingCartItem?.quantity ?? 1);
  const [notes, setNotes] = useState(existingCartItem?.notes ?? '');
  const [ingredientOverrides, setIngredientOverrides] = useState<
    Array<{ ingredientId: string; action: 'add' | 'remove' }>
  >(existingCartItem?.ingredientOverrides ?? []);
  const [selectedModifiers, setSelectedModifiers] = useState<
    Array<{ groupId: string; optionId: string }>
  >(existingCartItem?.selectedModifiers ?? []);
  const [modifierPriceDelta, setModifierPriceDelta] = useState(existingCartItem?.modifierPriceDelta ?? 0);
  const [groupSelections, setGroupSelections] = useState<Record<string, string[]>>({});
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);

  const resolvedItem = menuItems.find((m) => m.id === item?.id) ?? item;

  const inventoryById = useMemo(() => new Map(inventory.map((e) => [e.id, e])), [inventory]);

  const toppingPoolOptions = useMemo(() => {
    if (!resolvedItem?.categoryId) return [];
    return categoryModifierPools
      .filter((p) => {
        const belongsToCategory = p.categoryIds?.includes(resolvedItem.categoryId!) || p.categoryId === resolvedItem.categoryId;
        if (!belongsToCategory) return false;
        const name = p.name.toLowerCase();
        return name.includes('salsa') || name.includes('salse') || name.includes('topping');
      })
      .flatMap((pool) =>
        pool.options.map((opt) => ({
          id: opt.id,
          name: opt.name ?? inventoryById.get(opt.inventoryItemId!)?.name ?? opt.inventoryItemId ?? '',
        })),
      );
  }, [categoryModifierPools, resolvedItem?.categoryId, inventoryById]);

  React.useEffect(() => {
    if (isOpen) {
      setQuantity(existingCartItem?.quantity ?? 1); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize POS product modal from existing cart item
      setIngredientOverrides(existingCartItem?.ingredientOverrides ?? []);  
      setSelectedModifiers(existingCartItem?.selectedModifiers ?? []);  
      setModifierPriceDelta(existingCartItem?.modifierPriceDelta ?? 0);  

      const rawNotes = existingCartItem?.notes ?? '';
      if (toppingPoolOptions.length > 0) {
        const { cleanNotes, selectedIds } = parseExistingToppings(rawNotes, toppingPoolOptions);
        setNotes(cleanNotes);
        setSelectedToppingIds(selectedIds);
      } else {
        setNotes(rawNotes);
        setSelectedToppingIds([]);
      }
    }
  }, [isOpen, existingCartItem, toppingPoolOptions]);

  const rawModifierGroups: ModifierGroup[] = useMemo(
    () => resolvedItem ? ((resolvedItem.modifierGroups ?? []) as ModifierGroup[]) : [],
    [resolvedItem],
  );

  const modifierGroups: ModifierGroup[] = useMemo(
    () => rawModifierGroups.filter((g) => g.options.some((o: ModifierOption) => o.isActive)),
    [rawModifierGroups],
  );

  const hasCategoryPools = useMemo(() => {
    if (!resolvedItem?.categoryId) return false;
    return categoryModifierPools.some(
      (p) => p.categoryIds?.includes(resolvedItem.categoryId!) || p.categoryId === resolvedItem.categoryId,
    );
  }, [categoryModifierPools, resolvedItem?.categoryId]);

  const hasLegacyModifiers = useMemo(() => {
    return resolvedItem ? ((resolvedItem as any).modifiers ?? []).length > 0 : false;
  }, [resolvedItem]);

  const noIngredientOverrides = useMemo(() => {
    return modifierGroups.every((g) =>
      g.options.every((o: ModifierOption) => !o.ingredientOverrides || o.ingredientOverrides.length === 0),
    );
  }, [modifierGroups]);

  const isSimpleModifier = useMemo(() => {
    return (
      modifierGroups.length > 0 &&
      !hasCategoryPools &&
      !hasLegacyModifiers &&
      noIngredientOverrides
    );
  }, [modifierGroups.length, hasCategoryPools, hasLegacyModifiers, noIngredientOverrides]);

  const modifierGroupIds = useMemo(() => modifierGroups.map((g) => g.id).join(','), [modifierGroups]);

  React.useEffect(() => {
    if (isOpen && isSimpleModifier && modifierGroupIds) {
      const initialSelections: Record<string, string[]> = {};
      const existingMap = new Map(selectedModifiers.map((sm) => [sm.groupId, sm.optionId]));
      
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
          }
        }
      }
      setGroupSelections((prev) => { // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize group selections from modifier config; uses prev => updater form which is safe
        if (JSON.stringify(prev) === JSON.stringify(initialSelections)) return prev;
        return initialSelections;
      });
    }
  }, [isOpen, isSimpleModifier, modifierGroupIds, modifierGroups, selectedModifiers]);

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

  const inlineModifierPriceDelta = useMemo(() => {
    if (!isSimpleModifier) return modifierPriceDelta;
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
          if (option && !option.isDefault) {
            price += option.priceDelta;
          }
        }
      }
    }
    return price;
  }, [isSimpleModifier, groupSelections, modifierGroups, modifierPriceDelta]);

  const inlineSelectedModifiers = useMemo(() => {
    if (!isSimpleModifier) return selectedModifiers;
    const mods: Array<{ groupId: string; optionId: string }> = [];
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      for (const optionId of optionIds) {
        mods.push({ groupId, optionId });
      }
    }
    return mods;
  }, [isSimpleModifier, groupSelections, selectedModifiers]);

  const toppingNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of toppingPoolOptions) {
      map.set(opt.id, opt.name);
    }
    return map;
  }, [toppingPoolOptions]);

  const combinedNotes = useMemo(() => {
    const toppingNames = selectedToppingIds
      .map((id) => toppingNameById.get(id))
      .filter(Boolean) as string[];
    return [notes, ...toppingNames].filter(Boolean).join(', ');
  }, [notes, selectedToppingIds, toppingNameById]);

  if (!resolvedItem) return null;

  const isEditing = Boolean(existingCartItem);
  const finalPrice = (resolvedItem.price + inlineModifierPriceDelta) * quantity;
  const totalMods = ingredientOverrides.length + inlineSelectedModifiers.length;

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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative bg-white w-full sm:max-w-sm md:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] sm:max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-base sm:text-lg font-bold text-primary leading-tight truncate">{resolvedItem.name}</h2>
                <p className="text-sm sm:text-base font-extrabold text-accent">€{resolvedItem.price.toFixed(2)}</p>
              </div>
              <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 hover:bg-bg rounded-full transition-colors text-text-muted shrink-0"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-3">
              <div className="flex items-center justify-center gap-4 py-2">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-16 h-16 rounded-2xl border-2 border-border bg-bg flex items-center justify-center text-secondary active:bg-gray-200 active:scale-95 transition-all"><Minus size={26} /></button>
                <span className="text-4xl font-extrabold text-primary w-16 text-center select-none">{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} className="w-16 h-16 rounded-2xl border-2 border-border bg-bg flex items-center justify-center text-secondary active:bg-gray-200 active:scale-95 transition-all"><Plus size={26} /></button>
              </div>

              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (es: senza glutine, ben cotta...)" className="w-full px-3 py-2.5 rounded-xl border border-border text-sm focus:border-accent focus:outline-none" />

              {toppingPoolOptions.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">Toppings</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {toppingPoolOptions.map((opt) => {
                      const isSelected = selectedToppingIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setSelectedToppingIds((prev) =>
                              prev.includes(opt.id) ? prev.filter((id) => id !== opt.id) : [...prev, opt.id],
                            )
                          }
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95',
                            isSelected
                              ? 'bg-accent text-white border-accent'
                              : 'bg-white text-secondary border-border hover:border-accent',
                          )}
                        >
                          {opt.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Inline modifier groups for simple products */}
              {isSimpleModifier && modifierGroups.length > 0 && (
                <div className="space-y-3">
                  {modifierGroups.map((group) => {
                    const selected = groupSelections[group.id] ?? [];
                    return (
                      <div key={group.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">
                            {group.name}
                          </h3>
                          {group.required && (
                            <span className="text-[9px] font-bold text-danger bg-rose-50 px-1.5 py-0.5 rounded">
                              OBBLIGATORIO
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
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all active:scale-[0.98] text-left',
                                    isSelected
                                      ? 'border-accent bg-accent/5'
                                      : 'border-border bg-white hover:border-gray-300',
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'w-5 h-5 flex items-center justify-center shrink-0 border-2 transition-all',
                                      group.maxSelections > 1 ? 'rounded-md' : 'rounded-full',
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

              {/* Show "Modifica ordine" button only for non-simple products */}
              {!isSimpleModifier && (
                <button
                  type="button"
                  onClick={onOpenModifierModal}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all active:scale-[0.98]',
                    totalMods > 0 ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-muted hover:border-accent hover:text-accent',
                  )}
                >
                  <Settings size={14} />
                  {totalMods > 0 ? `Personalizzato (${totalMods})` : 'Personalizza'}
                </button>
              )}
            </div>

            <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-border shrink-0">
              <button
                ref={confirmButtonRef}
                onClick={() => onAddToCart(resolvedItem, quantity, combinedNotes, ingredientOverrides, inlineSelectedModifiers, inlineModifierPriceDelta)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-accent text-white rounded-xl active:bg-blue-800 active:scale-[0.98] transition-all text-sm font-bold uppercase tracking-widest shadow-md"
              >
                <ShoppingCart size={18} />
                {isEditing ? 'Aggiorna' : `Aggiungi · €${finalPrice.toFixed(2)}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
