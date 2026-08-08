import React, { useState, useMemo } from 'react';
import type { CartItem, CourseRoundsConfig, Ingredient, MenuItem, CategoryModifierPool, ModifierGroup, ModifierOption } from '@gustopos/shared';
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
    customPrice?: number,
    round?: number | null,
  ) => void;
  inventory: Ingredient[];
  orderMode: 'dine_in' | 'takeaway' | 'delivery';
  existingCartItem?: CartItem;
  menuItems: MenuItem[];
  onOpenModifierModal?: (draft?: {
    quantity: number;
    round?: number | null;
    notes: string;
    ingredientOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }>;
    selectedModifiers: Array<{ groupId: string; optionId: string }>;
    modifierPriceDelta: number;
    cartItemId?: string;
  }) => void;
  categoryModifierPools?: CategoryModifierPool[];
  courseRoundsConfig: CourseRoundsConfig;
  courseRoundsModuleEnabled: boolean;
  onOpenRoundReorder?: () => void;
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
  courseRoundsConfig,
  courseRoundsModuleEnabled,
  onOpenRoundReorder,
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
  const [customPrice, setCustomPrice] = useState<number>(existingCartItem?.basePrice ?? 0);
  const [selectedRound, setSelectedRound] = useState<number | null>(existingCartItem?.round ?? null);
  const roundsActive = courseRoundsModuleEnabled && courseRoundsConfig.enabled && _orderMode === 'dine_in';

  const resolvedItem = menuItems.find((m) => m.id === item?.id) ?? item;
  const isJolly = Boolean((resolvedItem as any)?.isJolly);

  const inventoryById = useMemo(() => new Map(inventory.map((e) => [e.id, e])), [inventory]);

  const visiblePools = useMemo(() => {
    if (!resolvedItem?.categoryId) return [];
    return categoryModifierPools.filter((p) => {
      const belongsToCategory = p.categoryIds?.includes(resolvedItem.categoryId!) || p.categoryId === resolvedItem.categoryId;
      if (!belongsToCategory) return false;
      const name = p.name.toLowerCase();
      const isLegacyInline = name.includes('salsa') || name.includes('salse') || name.includes('topping');
      // Inline: pool salsa/topping (legacy) + pool piccoli (≤8 opzioni, es. Granella).
      // I pool grossi (es. AGGIUNTA 35 opzioni) restano solo nel modale Personalizza.
      return isLegacyInline || (p.options?.length ?? 0) <= 8;
    });
  }, [categoryModifierPools, resolvedItem?.categoryId]);

  const toppingPoolOptions = useMemo(() => {
    return visiblePools.flatMap((pool) =>
      pool.options.map((opt) => ({
        id: opt.id,
        name: opt.name ?? inventoryById.get(opt.inventoryItemId!)?.name ?? opt.inventoryItemId ?? '',
        inventoryItemId: opt.inventoryItemId,
        componentId: opt.componentId,
      })),
    );
  }, [visiblePools, inventoryById]);

  // All pool option ids belonging to this product's category (visible inline
  // pools AND large "Personalizza" pools). Used to discard stale modifiers
  // from other products when computing inlineSelectedModifiers.
  const categoryPoolOptionIds = useMemo(() => {
    const ids = new Set<string>();
    if (!resolvedItem?.categoryId) return ids;
    for (const pool of categoryModifierPools) {
      const belongsToCategory = pool.categoryIds?.includes(resolvedItem.categoryId) || pool.categoryId === resolvedItem.categoryId;
      if (!belongsToCategory) continue;
      for (const opt of pool.options ?? []) ids.add(opt.id);
    }
    return ids;
  }, [categoryModifierPools, resolvedItem?.categoryId]);

  // Map a component reference (ingredient/prep/bom id) to its pool chip id so
  // additions made in the ModifierModal (which are persisted as
  // selectedModifiers / ingredientOverrides) light up the matching inline
  // chips when re-opening the product modal.
  const poolChipByComponentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of toppingPoolOptions) {
      if (opt.inventoryItemId) map.set(opt.inventoryItemId, opt.id);
      if (opt.componentId) map.set(opt.componentId, opt.id);
    }
    return map;
  }, [toppingPoolOptions]);

  React.useEffect(() => {
    if (isOpen) {
      setQuantity(existingCartItem?.quantity ?? 1); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize POS product modal from existing cart item
      setIngredientOverrides(existingCartItem?.ingredientOverrides ?? []);  
      setSelectedModifiers(existingCartItem?.selectedModifiers ?? []);  
      setModifierPriceDelta(existingCartItem?.modifierPriceDelta ?? 0);
      setCustomPrice(existingCartItem?.basePrice ?? ((item as any)?.isJolly ? Number((item as any)?.price ?? 0) : 0));
      setSelectedRound(existingCartItem?.round ?? null);
      // Reset group selections when the modal opens: a previous product's
      // inline modifier choices (e.g. Bun from a burger's "Base" group) must
      // NOT leak into a product without modifier groups (e.g. a drink).
      // Without this, a drink would inherit the burger's groupSelections and
      // print modifiers that don't belong to it (regression: Bun on bar tickets).
      setGroupSelections({});

      const rawNotes = existingCartItem?.notes ?? '';
      let selectedIds: string[] = [];
      if (toppingPoolOptions.length > 0) {
        const { cleanNotes, selectedIds: noteIds } = parseExistingToppings(rawNotes, toppingPoolOptions);
        setNotes(cleanNotes);
        selectedIds = noteIds;
      } else {
        setNotes(rawNotes);
      }
      // Preselect chips from persisted selected modifiers (pool options
      // tracked as groupId/optionId) and ingredient overrides (add), so
      // additions made via "Personalizza" stay selected on re-open.
      const fromModifiers = (existingCartItem?.selectedModifiers ?? [])
        .map((sm) => toppingPoolOptions.find((o) => o.id === sm.optionId)?.id)
        .filter(Boolean) as string[];
      const fromOverrides = (existingCartItem?.ingredientOverrides ?? [])
        .filter((entry) => entry.action === 'add')
        .map((entry) => poolChipByComponentId.get(entry.ingredientId))
        .filter(Boolean) as string[];
      const merged = new Set([...selectedIds, ...fromModifiers, ...fromOverrides]);
      setSelectedToppingIds([...merged]);
    }
  }, [isOpen, existingCartItem, toppingPoolOptions, poolChipByComponentId]);

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

  const inlineModifierGroups = useMemo(
    // I group del prodotto (Grandezza, Tipo, Formato, Gusto, Base...) vanno SEMPRE inline,
    // anche quando il prodotto ha pool di categoria (es. Granella su Dolci). Il filtro
    // storico `isSimpleModifier || name==='base'` nascondeva i group non-Base quando
    // hasCategoryPools → i group obbligatori sparivano dal modale principale.
    () => modifierGroups,
    [modifierGroups],
  );

  const modifierGroupIds = useMemo(() => inlineModifierGroups.map((g) => g.id).join(','), [inlineModifierGroups]);

  React.useEffect(() => {
    if (isOpen && modifierGroupIds) {
      const initialSelections: Record<string, string[]> = {};
      const existingMap = new Map(selectedModifiers.map((sm) => [sm.groupId, sm.optionId]));
      
      for (const group of inlineModifierGroups) {
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
  }, [isOpen, modifierGroupIds, inlineModifierGroups, selectedModifiers]);

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

  const groupPriceDelta = useMemo(() => {
    const priceForSelections = (selections: Record<string, string[]>) => {
      let price = 0;
      for (const [groupId, optionIds] of Object.entries(selections)) {
        const group = inlineModifierGroups.find((g) => g.id === groupId);
        if (!group || optionIds.length === 0) continue;
        if (group.maxSelections > 1) {
          const deltas = group.options
            .filter((o: ModifierOption) => optionIds.includes(o.id) && !o.isDefault)
            .map((o: ModifierOption) => o.priceDelta);
          price += deltas.length > 0 ? Math.max(...deltas) : 0;
        } else {
          for (const optionId of optionIds) {
            const option = group.options.find((o: ModifierOption) => o.id === optionId);
            if (option && !option.isDefault) price += option.priceDelta;
          }
        }
      }
      return price;
    };
    return priceForSelections(groupSelections);
  }, [groupSelections, inlineModifierGroups]);

  const inlineModifierPriceDelta = useMemo(() => {
    const existingSelections: Record<string, string[]> = {};
    for (const selected of selectedModifiers) {
      const group = inlineModifierGroups.find((candidate) => candidate.id === selected.groupId);
      if (group) existingSelections[selected.groupId] = [...(existingSelections[selected.groupId] ?? []), selected.optionId];
    }
    let existingGroupPrice = 0;
    for (const [groupId, optionIds] of Object.entries(existingSelections)) {
      const group = inlineModifierGroups.find((candidate) => candidate.id === groupId);
      if (!group || optionIds.length === 0) continue;
      if (group.maxSelections > 1) {
        const deltas = group.options
          .filter((o: ModifierOption) => optionIds.includes(o.id) && !o.isDefault)
          .map((o: ModifierOption) => o.priceDelta);
        existingGroupPrice += deltas.length > 0 ? Math.max(...deltas) : 0;
      } else {
        for (const optionId of optionIds) {
          const option = group.options.find((o: ModifierOption) => o.id === optionId);
          if (option && !option.isDefault) existingGroupPrice += option.priceDelta;
        }
      }
    }
    return modifierPriceDelta - existingGroupPrice + groupPriceDelta;
  }, [groupPriceDelta, inlineModifierGroups, modifierPriceDelta, selectedModifiers]);

  const inlineSelectedModifiers = useMemo(() => {
    const directGroupIds = new Set(inlineModifierGroups.map((group) => group.id));
    // Defense-in-depth: keep only modifiers that belong to this product —
    // either its own inline groups or a pool option of its category. Stale
    // selections from a previously opened product (e.g. Bun from a burger's
    // "Base" group) are dropped instead of leaking into the cart/order.
    const mods = selectedModifiers.filter(
      (selected) => directGroupIds.has(selected.groupId) || categoryPoolOptionIds.has(selected.optionId),
    );
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      for (const optionId of optionIds) mods.push({ groupId, optionId });
    }
    return mods;
  }, [groupSelections, inlineModifierGroups, selectedModifiers, categoryPoolOptionIds]);

  const cartIngredientOverrides = useMemo(() => {
    const groupOverrideKeys = new Set<string>();
    for (const selected of inlineSelectedModifiers) {
      const group = modifierGroups.find((candidate) => candidate.id === selected.groupId);
      const option = group?.options.find((candidate: ModifierOption) => candidate.id === selected.optionId);
      for (const override of option?.ingredientOverrides ?? []) {
        groupOverrideKeys.add(`${override.ingredientId}:${override.action}`);
      }
    }
    const manualOverrides = ingredientOverrides.filter((override) => !groupOverrideKeys.has(`${override.ingredientId}:${override.action}`));
    const selectedGroupOverrides: Array<{ ingredientId: string; action: 'add' | 'remove' }> = [];
    for (const selected of inlineSelectedModifiers) {
      const group = modifierGroups.find((candidate) => candidate.id === selected.groupId);
      const option = group?.options.find((candidate: ModifierOption) => candidate.id === selected.optionId);
      for (const override of option?.ingredientOverrides ?? []) {
        selectedGroupOverrides.push({ ingredientId: override.ingredientId, action: override.action as 'add' | 'remove' });
      }
    }
    return [...manualOverrides, ...selectedGroupOverrides];
  }, [ingredientOverrides, inlineSelectedModifiers, modifierGroups]);

  const requiredInlineGroupsSatisfied = useMemo(() => inlineModifierGroups.every((group) => {
    if (!group.required) return true;
    return (groupSelections[group.id] ?? []).length >= (group.minSelections ?? 1);
  }), [groupSelections, inlineModifierGroups]);

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
  const baseUnitPrice = isJolly ? customPrice : resolvedItem.price;
  const finalPrice = (baseUnitPrice + inlineModifierPriceDelta) * quantity;
  const totalMods = cartIngredientOverrides.length + inlineSelectedModifiers.length;

  const toggleGroupOption = (groupId: string, optionId: string) => {
    setGroupSelections((prev) => {
      const group = inlineModifierGroups.find((g) => g.id === groupId);
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
                <p className="text-sm sm:text-base font-extrabold text-accent">{isJolly ? `€${(customPrice || 0).toFixed(2)}` : `€${resolvedItem.price.toFixed(2)}`}</p>
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

              {roundsActive && (
                <div className="rounded-xl border border-border bg-bg/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">Portata</h3>
                      <p className="text-[10px] text-text-muted mt-0.5">{selectedRound === null ? 'Scegli quando servirla' : courseRoundsConfig.labels[selectedRound]}</p>
                    </div>
                    {selectedRound !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedRound(null)}
                        className="min-h-[44px] px-2 text-[10px] font-bold text-text-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {courseRoundsConfig.labels.map((label, index) => (
                      <button
                        type="button"
                        key={label + index}
                        onClick={() => setSelectedRound(index)}
                        className={cn(
                          'min-h-[44px] px-3 rounded-full border text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                          selectedRound === index ? 'border-accent bg-accent text-white shadow-sm' : 'border-border bg-white text-secondary hover:border-accent hover:text-accent',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {courseRoundsConfig.required && selectedRound === null && (
                    <p className="text-[10px] text-danger font-semibold" role="alert">Seleziona una portata per continuare.</p>
                  )}
                  {onOpenRoundReorder && (
                    <button
                      type="button"
                      onClick={onOpenRoundReorder}
                      className="w-full min-h-[44px] rounded-lg border border-border text-[10px] font-bold uppercase tracking-wider text-text-muted hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Imposta portate per tutto il carrello
                    </button>
                  )}
                </div>
              )}

              {isJolly && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">Prezzo ad-hoc</h3>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice || ''}
                    onChange={(e) => setCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl border border-accent text-lg font-bold text-primary focus:outline-none"
                  />
                </div>
              )}

              {visiblePools.length > 0 && (
                <div className="space-y-2">
                  {visiblePools.map((pool) => (
                    <div key={pool.id} className="space-y-1.5">
                      <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">{pool.name}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {pool.options.map((opt) => {
                          const optId = opt.id;
                          const isSelected = selectedToppingIds.includes(optId);
                          return (
                            <button
                              key={optId}
                              type="button"
                              onClick={() =>
                                setSelectedToppingIds((prev) =>
                                  prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
                                )
                              }
                              className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95',
                                isSelected
                                  ? 'bg-accent text-white border-accent'
                                  : 'bg-white text-secondary border-border hover:border-accent',
                              )}
                            >
                              {opt.name ?? inventoryById.get(opt.inventoryItemId!)?.name ?? opt.inventoryItemId ?? ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline modifier groups: the base (and any direct product groups) is selected here. */}
              {inlineModifierGroups.length > 0 && (
                <div className="space-y-3">
                  {inlineModifierGroups.map((group) => {
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
                                    {((option as any).quantity ?? 1) !== 1 || (option as any).unit !== 'pz' ? (
                                      <p className="text-[10px] text-text-muted">
                                        {(option as any).quantity ?? 1} {(option as any).unit ?? 'pz'}
                                      </p>
                                    ) : null}
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
                  onClick={() => onOpenModifierModal?.({                    quantity,
                    round: roundsActive ? selectedRound : undefined,
                    notes: combinedNotes,
                ingredientOverrides: cartIngredientOverrides,
                selectedModifiers: inlineSelectedModifiers,
                  modifierPriceDelta: inlineModifierPriceDelta,
                  cartItemId: existingCartItem?.cartItemId,
                })}
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
                onClick={() => onAddToCart(resolvedItem, quantity, combinedNotes, cartIngredientOverrides, inlineSelectedModifiers, inlineModifierPriceDelta, isJolly ? (customPrice || 0) : undefined, roundsActive ? selectedRound : undefined)}
                disabled={!requiredInlineGroupsSatisfied || (roundsActive && courseRoundsConfig.required && selectedRound === null)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-accent text-white rounded-xl active:bg-blue-800 active:scale-[0.98] transition-all text-sm font-bold uppercase tracking-widest shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
