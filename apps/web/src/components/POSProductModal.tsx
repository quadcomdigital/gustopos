import React, { useState, useMemo } from 'react';
import type { CartItem, CourseRoundsConfig, Ingredient, MenuItem, CategoryModifierPool, ModifierGroup, ModifierOption } from '@gustopos/shared';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, ShoppingCart, Settings, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { computeGroupModifierDelta, isMultiSelectGroup, modifierOptionPriceBadge } from '../lib/modifier-pricing';
import { composedPricingBase, isJollyItem } from '../lib/jolly';
import { isOpenPriceItem } from '../lib/open-price';
import { useAppStore } from '../store/app-store';
import { useBackdropDismiss } from '../hooks/useBackdropDismiss';
import { lockBodyScroll, unlockBodyScroll } from '../shared/ui/utils/scrollLock';

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
    /** Open-price line: the price typed by the waiter, carried into "Personalizza". */
    customPrice?: number;
    cartItemId?: string;
  }) => void;
  categoryModifierPools?: CategoryModifierPool[];
  courseRoundsConfig: CourseRoundsConfig;
  courseRoundsModuleEnabled: boolean;
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
  const backdropDismiss = useBackdropDismiss(onClose);

  const resolvedItem = menuItems.find((m) => m.id === item?.id) ?? item;
  // JOLLY (price composed by the selections, no ad-hoc typing) is a per-tenant
  // capability, not base behaviour. The API already masks the flag for tenants
  // without the override, this keeps the modal consistent even if a cached
  // payload still carries it.
  const tenantId = useAppStore((state) => state.tenantContext?.tenantId);
  const isJolly = isJollyItem(resolvedItem, tenantId);
  // Open price: a POS-only line whose unit price the waiter types by hand.
  const isOpenPrice = isOpenPriceItem(resolvedItem, tenantId);

  const inventoryById = useMemo(() => new Map(inventory.map((e) => [e.id, e])), [inventory]);

  // Pools of this item's category, ordered as the POS/public sheet render them.
  const categoryPools = useMemo(() => {
    if (!resolvedItem?.categoryId) return [];
    return categoryModifierPools
      .filter((p) => p.categoryIds?.includes(resolvedItem.categoryId!) || p.categoryId === resolvedItem.categoryId)
      // Disabled options are not purchasable; a pool left with none disappears.
      .filter((p) => (p.options ?? []).some((o) => o.isActive !== false))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categoryModifierPools, resolvedItem?.categoryId]);

  // A pool "carries a cost" when any option has a priceDelta or a
  // priceMultiplier (e.g. MAXI doubling the pizza).
  const isPricedPool = (pool: CategoryModifierPool): boolean =>
    (pool.options ?? [])
      .filter((o) => o.isActive !== false)
      .some((o) => (o.priceDelta ?? 0) !== 0 || (o.priceMultiplier != null && o.priceMultiplier !== 1));

  // NOTE-ONLY inline chips (never reach the price calculation): unpriced pools
  // only — the legacy salsa/topping pools plus the small ones (≤8 opzioni,
  // es. Granella). Their label is appended to the free-text notes.
  const notePools = useMemo(
    () =>
      categoryPools.filter((pool) => {
        if (isPricedPool(pool)) return false;
        const name = pool.name.toLowerCase();
        const isLegacyInline = name.includes('salsa') || name.includes('salse') || name.includes('topping');
        return isLegacyInline || (pool.options ?? []).filter((o) => o.isActive !== false).length <= 8;
      }),
    [categoryPools],
  );

  // Small PRICED pools (≤8 opzioni: MAXI, Senza glutine…) get their own
  // container too, but their chips are real selections: they are wired into
  // `groupSelections` through a synthesised modifier group, so the price is
  // computed, persisted as selectedModifiers and re-priced server side.
  // Bigger priced pools (es. AGGIUNTA, 49 opzioni) stay in "Personalizza".
  const pricedPools = useMemo(
    () =>
      categoryPools.filter((pool) => {
        if (!isPricedPool(pool)) return false;
        return (pool.options ?? []).filter((o) => o.isActive !== false).length <= 8;
      }),
    [categoryPools],
  );

  // Containers in display order, mixing note-only and priced pools.
  const inlineContainers = useMemo(
    () =>
      [...notePools.map((pool) => ({ pool, priced: false })), ...pricedPools.map((pool) => ({ pool, priced: true }))].sort(
        (a, b) => (a.pool.sortOrder ?? 0) - (b.pool.sortOrder ?? 0),
      ),
    [notePools, pricedPools],
  );

  const toppingPoolOptions = useMemo(() => {
    return notePools.flatMap((pool) =>
      pool.options.filter((opt) => opt.isActive !== false).map((opt) => ({
        id: opt.id,
        name: opt.name ?? inventoryById.get(opt.inventoryItemId!)?.name ?? opt.inventoryItemId ?? '',
        inventoryItemId: opt.inventoryItemId,
        componentId: opt.componentId,
      })),
    );
  }, [notePools, inventoryById]);

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

  // Form init runs ONLY on the closed -> open transition. The old deps
  // (`toppingPoolOptions`, `poolChipByComponentId`) are derived from
  // `data.inventory`, which gets a fresh identity on every socket
  // `dataUpdate`: re-running on identity changes reset the in-progress "Note"
  // text and deselected the chips while the modal was open.
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setQuantity(existingCartItem?.quantity ?? 1); // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize POS product modal from existing cart item
    setIngredientOverrides(existingCartItem?.ingredientOverrides ?? []);
    setSelectedModifiers(existingCartItem?.selectedModifiers ?? []);
    setModifierPriceDelta(existingCartItem?.modifierPriceDelta ?? 0);
    // Open-price line: restore the typed price being edited, else start at 0.
    setCustomPrice(existingCartItem?.basePrice ?? 0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-on-open only: derived maps are read at open time, their later identity churn must NOT reset the form
  }, [isOpen]);

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

  // Small priced pools are modelled as ordinary modifier groups so every piece
  // of existing machinery — selection restore from selectedModifiers, price
  // delta, persistence, required-group validation — applies to them unchanged.
  const pricedPoolGroups = useMemo<ModifierGroup[]>(
    () =>
      pricedPools.map((pool) => {
        const activeOptions = (pool.options ?? []).filter((o) => o.isActive !== false);
        return {
          id: pool.id,
          name: pool.name,
          required: false,
          minSelections: 0,
          // A pool is always an OPTIONAL MULTI-SELECT, even when it carries a
          // single option (Senza glutine, MAXI): maxSelections=1 would make it
          // single-select, and a single-select chip can never be deselected.
          // Pricing is unaffected: one selected option costs the same either way.
          maxSelections: Math.max(2, activeOptions.length),
          // Toppings/add-ons accumulate: each selected option is charged.
          multiSelectPriceMode: 'sum',
          sortOrder: pool.sortOrder ?? 0,
          options: activeOptions.map<ModifierOption>((opt) => ({
            id: opt.id,
            name: opt.name ?? inventoryById.get(opt.inventoryItemId!)?.name ?? opt.inventoryItemId ?? opt.id,
            inventoryItemId: opt.inventoryItemId,
            referenceId: opt.referenceId ?? undefined,
            componentType: opt.componentType ?? 'ingredient',
            componentId: opt.componentId,
            quantity: opt.quantity ?? 1,
            unit: (opt.unit ?? 'pz') as ModifierOption['unit'],
            priceDelta: opt.priceDelta ?? 0,
            priceMultiplier: opt.priceMultiplier ?? undefined,
            isDefault: false,
            isActive: true,
            sortOrder: opt.sortOrder ?? 0,
            ingredientOverrides: [],
          })),
        };
      }),
    [pricedPools, inventoryById],
  );

  const inlineModifierGroups = useMemo(
    // I group del prodotto (Grandezza, Tipo, Formato, Gusto, Base...) vanno SEMPRE inline,
    // anche quando il prodotto ha pool di categoria (es. Granella su Dolci). Il filtro
    // storico `isSimpleModifier || name==='base'` nascondeva i group non-Base quando
    // hasCategoryPools → i group obbligatori sparivano dal modale principale.
    // Plus the small priced pools rendered as containers above (MAXI, Senza glutine).
    () => [...modifierGroups, ...pricedPoolGroups],
    [modifierGroups, pricedPoolGroups],
  );

  const modifierGroupIds = useMemo(() => inlineModifierGroups.map((g) => g.id).join(','), [inlineModifierGroups]);

  // Group-selection init. It must re-run after the open-init above writes the
  // restored `selectedModifiers` (state settles a render later), but it must
  // NOT re-run when `inlineModifierGroups` merely gets a fresh identity from a
  // socket `dataUpdate`: that reset the user's live chip choices while the
  // modal was open. Keyed on the *content* (group ids + selected modifiers)
  // instead of object identity: identity churn is ignored, real changes re-init.
  const groupInitKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      groupInitKeyRef.current = null;
      return;
    }
    if (!modifierGroupIds) return;
    const initKey = `${modifierGroupIds}::${JSON.stringify(selectedModifiers)}`;
    if (groupInitKeyRef.current === initKey) return;
    groupInitKeyRef.current = initKey;

    const initialSelections: Record<string, string[]> = {};
    // A group can legitimately persist several selections (multi-select), so
    // collect all option ids per group instead of a last-wins map.
    const existingByGroup = new Map<string, string[]>();
    for (const sm of selectedModifiers) {
      const list = existingByGroup.get(sm.groupId) ?? [];
      list.push(sm.optionId);
      existingByGroup.set(sm.groupId, list);
    }

    for (const group of inlineModifierGroups) {
      const existingOptionIds = (existingByGroup.get(group.id) ?? [])
        .filter((id) => group.options.some((o: ModifierOption) => o.id === id));
      if (existingOptionIds.length > 0) {
        initialSelections[group.id] = existingOptionIds;
        continue;
      }
      const defaults = group.options
        .filter((o: ModifierOption) => o.isDefault && o.isActive)
        .map((o: ModifierOption) => o.id);
      if (defaults.length > 0) {
        initialSelections[group.id] = defaults;
      }
    }
    setGroupSelections((prev) => { // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] initialize group selections from modifier config; uses prev => updater form which is safe
      if (JSON.stringify(prev) === JSON.stringify(initialSelections)) return prev;
      return initialSelections;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init keyed on content signature; object identity churn must not reset user edits
  }, [isOpen, modifierGroupIds, inlineModifierGroups, selectedModifiers]);

  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);
  // Latest-ref: `POSView` passes an inline `onClose`, so a new identity arrives
  // on every parent render. With `onClose` in the deps the effect re-ran each
  // time and `focus()` stole focus back to the confirm button — on mobile the
  // keyboard-open viewport resize re-renders the parent, so the soft-keyboard
  // closed immediately after opening and the "Note" field was untypeable.
  // The ref keeps Escape fresh while the effect runs only on open/close.
  // eslint-disable-next-line react-hooks/refs -- latest-ref pattern avoids stale callbacks in the keydown listener
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!isOpen) return;
    confirmButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    lockBodyScroll();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
    };
  }, [isOpen]); // focus/keydown keyed on open transition only (see onCloseRef above)

  // Base for every priceMultiplier option (MAXI ×2).
  // A JOLLY line has no typed price: its base is COMPOSED by the selections —
  // the product's own groups ("Le due metà" = pizza/2 per option) plus the
  // item price — while category pools (MAXI, Senza glutine) stay outside it,
  // so MAXI doubles the composed pizza and the surcharges remain additive.
  const pricingBase = useMemo(
    () => composedPricingBase(isJolly, resolvedItem?.price ?? 0, modifierGroups, groupSelections),
    [isJolly, resolvedItem?.price, modifierGroups, groupSelections],
  );

  // Selections of the product's own groups (the JOLLY halves): drives the
  // hint that replaces the removed ad-hoc price field.
  const jollySelectionCount = isJolly
    ? modifierGroups.reduce((count, group) => count + (groupSelections[group.id] ?? []).length, 0)
    : 0;

  const groupPriceDelta = useMemo(() => {
    let price = 0;
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      const group = inlineModifierGroups.find((g) => g.id === groupId);
      if (!group || optionIds.length === 0) continue;
      price += computeGroupModifierDelta(group, optionIds, pricingBase);
    }
    return price;
  }, [groupSelections, inlineModifierGroups, pricingBase]);

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
      existingGroupPrice += computeGroupModifierDelta(group, optionIds, pricingBase);
    }
    return modifierPriceDelta - existingGroupPrice + groupPriceDelta;
  }, [groupPriceDelta, inlineModifierGroups, modifierPriceDelta, selectedModifiers, pricingBase]);

  const inlineSelectedModifiers = useMemo(() => {
    const directGroupIds = new Set(inlineModifierGroups.map((group) => group.id));
    // Defense-in-depth: keep only modifiers that belong to this product —
    // either its own inline groups or a pool option of its category. Stale
    // selections from a previously opened product (e.g. Bun from a burger's
    // "Base" group) are dropped instead of leaking into the cart/order.
    // De-duplicate because persisted inline selections are restored into
    // groupSelections as well (multi-select groups can hold several options).
    const byKey = new Map<string, { groupId: string; optionId: string }>();
    for (const selected of selectedModifiers) {
      if (!directGroupIds.has(selected.groupId) && !categoryPoolOptionIds.has(selected.optionId)) continue;
      byKey.set(`${selected.groupId}:${selected.optionId}`, selected);
    }
    for (const [groupId, optionIds] of Object.entries(groupSelections)) {
      for (const optionId of optionIds) byKey.set(`${groupId}:${optionId}`, { groupId, optionId });
    }
    return [...byKey.values()];
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
  // An open-price line uses the price typed by the waiter; a JOLLY line carries
  // no typed price and composes it from the selections (catalog price 0 plus
  // every delta); every other product uses the catalog price.
  const baseUnitPrice = isOpenPrice ? customPrice : resolvedItem.price;
  const finalPrice = (baseUnitPrice + inlineModifierPriceDelta) * quantity;
  const totalMods = cartIngredientOverrides.length + inlineSelectedModifiers.length;

  const toggleGroupOption = (groupId: string, optionId: string) => {
    setGroupSelections((prev) => {
      const group = inlineModifierGroups.find((g) => g.id === groupId);
      if (!group) return prev;
      const current = prev[groupId] ?? [];

      if (!isMultiSelectGroup(group)) {
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" {...backdropDismiss} />
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative bg-white w-full sm:max-w-sm md:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] sm:max-h-[85vh] flex flex-col"
          >
            <div className="flex items-start justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-base sm:text-lg font-bold text-primary leading-tight truncate">{resolvedItem.name}</h2>
                <p className="text-sm sm:text-base font-extrabold text-accent">
                  {isOpenPrice
                    ? `€${(customPrice || 0).toFixed(2)}`
                    : isJolly
                      ? `€${(baseUnitPrice + inlineModifierPriceDelta).toFixed(2)}`
                      : `€${resolvedItem.price.toFixed(2)}`}
                </p>
                {roundsActive && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Portata">
                      {courseRoundsConfig.labels.map((label, index) => (
                        <button
                          key={label + index}
                          type="button"
                          onClick={() => setSelectedRound((current) => (current === index ? null : index))}
                          aria-label={label}
                          aria-pressed={selectedRound === index}
                          className={cn(
                            'min-h-[36px] min-w-[36px] px-2.5 rounded-lg border text-sm font-bold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                            selectedRound === index
                              ? 'border-accent bg-accent text-white shadow-sm'
                              : 'border-border bg-white text-secondary hover:border-accent hover:text-accent',
                          )}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted">
                      {selectedRound === null ? 'Nessuna portata' : courseRoundsConfig.labels[selectedRound]}
                    </p>
                  </div>
                )}
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

              {isOpenPrice && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">Prezzo ad-hoc</h3>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={customPrice || ''}
                    onChange={(e) => setCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-xl border border-accent text-lg font-bold text-primary tabular-nums focus:outline-none"
                  />
                  {customPrice <= 0 && (
                    <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
                      Inserisci un prezzo maggiore di zero
                    </p>
                  )}
                </div>
              )}

              {isJolly && (
                <p
                  className={cn(
                    'text-[11px] font-bold uppercase tracking-wider text-center',
                    jollySelectionCount > 0 ? 'text-text-muted' : 'text-accent',
                  )}
                >
                  {jollySelectionCount > 0
                    ? 'Prezzo composto dalle selezioni'
                    : 'Seleziona almeno una metà: il prezzo si calcola dalle selezioni'}
                </p>
              )}

              {inlineContainers.length > 0 && (
                <div className="space-y-2">
                  {inlineContainers.map(({ pool, priced }) => (
                    <div key={pool.id} className="space-y-1.5">
                      <h3 className="text-[10px] font-bold text-accent uppercase tracking-wider">{pool.name}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(pool.options ?? []).filter((o) => o.isActive !== false).map((opt) => {
                          const optId = opt.id;
                          // Note-only chips live in `selectedToppingIds` (they end up in the
                          // free-text notes); priced chips are real group selections.
                          const isSelected = priced
                            ? (groupSelections[pool.id] ?? []).includes(optId)
                            : selectedToppingIds.includes(optId);
                          const badge = priced
                            ? modifierOptionPriceBadge({
                                id: optId,
                                priceDelta: opt.priceDelta ?? 0,
                                priceMultiplier: opt.priceMultiplier,
                              })
                            : null;
                          return (
                            <button
                              key={optId}
                              type="button"
                              onClick={() =>
                                priced
                                  ? toggleGroupOption(pool.id, optId)
                                  : setSelectedToppingIds((prev) =>
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
                              {badge && <span className={cn('ml-1 tabular-nums', isSelected ? 'opacity-90' : 'opacity-70')}>{badge}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline modifier groups: the base (and any direct product groups) is selected here. */}
              {/* Product groups render as full rows (checkbox + badge). Priced pools are
                  excluded here: they already have their own container of chips above. */}
              {modifierGroups.length > 0 && (
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
                              const badge = modifierOptionPriceBadge(option);
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
                                      isMultiSelectGroup(group) ? 'rounded-md' : 'rounded-full',
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
                  customPrice: isOpenPrice ? customPrice : undefined,
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
                onClick={() => onAddToCart(resolvedItem, quantity, combinedNotes, cartIngredientOverrides, inlineSelectedModifiers, inlineModifierPriceDelta, isOpenPrice ? customPrice : undefined, roundsActive ? selectedRound : undefined)}
                disabled={
                  !requiredInlineGroupsSatisfied ||
                  // A JOLLY is priced by its selections: without any own-group
                  // selection it would be a free €0,00 line.
                  (isJolly && jollySelectionCount === 0) ||
                  // An open-price line is priced by the waiter: it must carry a
                  // typed amount, never be a free €0,00 line.
                  (isOpenPrice && customPrice <= 0) ||
                  (roundsActive && courseRoundsConfig.required && selectedRound === null)
                }
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
