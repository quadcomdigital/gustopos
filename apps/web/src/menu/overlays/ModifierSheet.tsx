import { useMemo, useState } from 'react';
import type { ModifierGroup, ModifierOption, PublicMenuResponse } from '@gustopos/shared';
import { computeGroupModifierDelta, isMultiSelectGroup, modifierOptionPriceBadge } from '@gustopos/shared';
import { Check, X } from 'lucide-react';
import type { ModifierSheetProps } from '../types';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * Generic public-facing modifier picker. Uses the SAME pricing rules as the POS
 * and the server (`computeGroupModifierDelta`) so the previewed price always
 * matches what the API will charge on submit.
 *
 * Colour comes from `MenuAppearance`; a scaffold may replace this component via
 * the registry while keeping the identical pricing logic.
 */
export default function ModifierSheet({
  item,
  categoryPools,
  appearance,
  formatPrice,
  onClose,
  onConfirm,
}: ModifierSheetProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const groups = useMemo<ModifierGroup[]>(() => {
    if (!item) return [];
    const own = (item.modifierGroups ?? [])
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => option.isActive),
      }))
      .filter((group) => group.options.length > 0);
    const pools = item.categoryId
      ? categoryPools
          .filter((pool) => {
            const ids = pool.categoryIds.length > 0 ? pool.categoryIds : pool.categoryId ? [pool.categoryId] : [];
            return ids.includes(item.categoryId!);
          })
          .map<ModifierGroup>((pool) => {
            // Disabled options are not purchasable.
            const activeOptions = pool.options.filter((option) => option.isActive !== false);
            return {
              id: pool.id,
              name: pool.name,
              required: false,
              minSelections: 0,
              maxSelections: Math.max(1, activeOptions.length),
              multiSelectPriceMode: 'sum',
              sortOrder: pool.sortOrder,
              options: activeOptions.map<ModifierOption>((option) => ({
                id: option.id,
                name: option.name || option.componentId || option.id,
                inventoryItemId: option.inventoryItemId,
                componentType: option.componentType,
                componentId: option.componentId,
                quantity: option.quantity ?? 1,
                unit: 'pz',
                priceDelta: option.priceDelta ?? 0,
                priceMultiplier: option.priceMultiplier ?? undefined,
                isDefault: false,
                isActive: true,
                sortOrder: option.sortOrder ?? 0,
                ingredientOverrides: [],
              })),
            };
          })
      : [];
    return [...own, ...pools].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [item, categoryPools]);

  const delta = useMemo(
    () =>
      groups.reduce(
        (sum, group) => sum + computeGroupModifierDelta(group, selections[group.id] ?? [], item?.price ?? 0),
        0,
      ),
    [groups, selections, item?.price],
  );

  const missingRequired = groups.some(
    (group) => group.required && (selections[group.id]?.length ?? 0) < Math.max(1, group.minSelections),
  );

  if (!item) return null;

  const toggle = (group: ModifierGroup, optionId: string) => {
    setSelections((current) => {
      const selected = current[group.id] ?? [];
      if (isMultiSelectGroup(group)) {
        const next = selected.includes(optionId)
          ? selected.filter((id) => id !== optionId)
          : selected.length >= group.maxSelections
            ? selected
            : [...selected, optionId];
        return { ...current, [group.id]: next };
      }
      return { ...current, [group.id]: [optionId] };
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl shadow-2xl sm:max-w-md sm:rounded-2xl"
        style={{ backgroundColor: appearance.surface }}
      >
        <div
          className="shrink-0 border-b p-4"
          style={{ backgroundColor: appearance.ink, borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="display truncate text-lg font-extrabold text-white">{item.name}</h2>
              <p className="text-sm font-extrabold tabular-nums" style={{ color: appearance.accent }}>
                {formatPrice(item.price + delta)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {groups.length === 0 ? (
            <p className="text-sm" style={{ color: appearance.muted }}>
              Nessuna opzione disponibile per questo piatto.
            </p>
          ) : (
            groups.map((group) => {
              const selected = selections[group.id] ?? [];
              const multi = isMultiSelectGroup(group);
              return (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: appearance.muted }}>
                      {group.name}
                    </h3>
                    {group.required && <span className="text-[10px] font-bold text-rose-600">Obbligatorio</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const active = selected.includes(option.id);
                      const multiplierBadge = modifierOptionPriceBadge(option);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggle(group, option.id)}
                          aria-pressed={active}
                          className="min-h-[44px] rounded-full border px-4 text-xs font-bold transition-colors"
                          style={{
                            backgroundColor: active ? appearance.accent : appearance.surface,
                            color: active ? appearance.accentForeground : appearance.ink,
                            borderColor: active ? appearance.accent : appearance.border,
                          }}
                        >
                          {option.name}
                          {/* Multiplier options (MAXI) have no fixed euro value:
                              they scale the item price, so they render as "×2". */}
                          {multiplierBadge ? (
                            <span className="ml-1 opacity-80 tabular-nums">{multiplierBadge}</span>
                          ) : option.priceDelta > 0 ? (
                            <span className="ml-1 opacity-80 tabular-nums">+{formatPrice(option.priceDelta)}</span>
                          ) : null}
                          {multi && active && <Check className="ml-1 inline-block h-3 w-3 -mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t p-4" style={{ borderColor: appearance.border }}>
          {missingRequired && <p className="text-xs text-rose-600">Seleziona le opzioni obbligatorie.</p>}
          <button
            type="button"
            disabled={missingRequired}
            onClick={() => {
              const selectedModifiers = Object.entries(selections).flatMap(([groupId, optionIds]) =>
                optionIds.map((optionId) => ({ groupId, optionId })),
              );
              onConfirm({ selectedModifiers, modifierPriceDelta: delta });
            }}
            className="min-h-[48px] w-full rounded-xl text-xs font-extrabold uppercase tracking-widest disabled:opacity-50"
            style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
          >
            Aggiungi · {formatPrice(item.price + delta)}
          </button>
        </div>
      </div>
    </div>
  );
}
