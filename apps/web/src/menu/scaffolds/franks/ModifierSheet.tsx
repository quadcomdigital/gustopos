import { useMemo, useState } from 'react';
import type { ModifierGroup, ModifierOption, PublicMenuResponse } from '@gustopos/shared';
import { computeGroupModifierDelta, isMultiSelectGroup, modifierOptionPriceBadge } from '@gustopos/shared';
import { Check, RotateCcw, X } from 'lucide-react';
import type { ModifierSheetProps } from '../../types';
import { removableComponents } from '../../lib/customization';
import { FRANKS_LOGO_URL } from './brand';

type PublicMenuItem = PublicMenuResponse['items'][number];

/**
 * Franks options overlay: identical pricing to the POS and the server, restyled
 * on the tenant chrome (dark header with the local logo, squared accent chips).
 * Scaffold opt-in replacement for the shared `ModifierSheet`.
 */
export default function FranksModifierSheet({
  item,
  categoryPools,
  appearance,
  formatPrice,
  onClose,
  onConfirm,
}: ModifierSheetProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  // Ingredient ids the guest asked to leave out ("senza cipolla").
  const [removed, setRemoved] = useState<string[]>([]);
  const [lineNote, setLineNote] = useState('');

  const removable = useMemo(() => (item ? removableComponents(item) : []), [item]);

  const toggleRemoved = (ingredientId: string) => {
    setRemoved((current) =>
      current.includes(ingredientId)
        ? current.filter((id) => id !== ingredientId)
        : [...current, ingredientId],
    );
  };

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
              // Pools are OPTIONAL MULTI-SELECT even with a single option
              // (Senza glutine, MAXI): max=1 would make them single-select and
              // the active chip could never be deselected.
              maxSelections: Math.max(2, activeOptions.length),
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Chiudi"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl shadow-2xl sm:max-w-md sm:rounded-3xl"
        style={{ backgroundColor: appearance.pageBg }}
      >
        <div className="shrink-0 p-4" style={{ backgroundColor: appearance.ink }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <img src={FRANKS_LOGO_URL} alt="" className="mb-2 h-6 w-auto" />
              <h2 className="display truncate text-xl font-extrabold text-white">{item.name}</h2>
              <p className="text-lg font-extrabold tabular-nums" style={{ color: appearance.accent }}>
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

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
          {groups.length === 0 && removable.length === 0 ? (
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
                    <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: appearance.muted }}>
                      {group.name}
                    </h3>
                    {group.required && <span className="text-[10px] font-bold text-rose-600">Obbligatorio</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const active = selected.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggle(group, option.id)}
                          aria-pressed={active}
                          className="min-h-[44px] rounded-lg border px-4 text-xs font-bold transition-all active:scale-[0.98]"
                          style={{
                            backgroundColor: active ? appearance.accent : appearance.surface,
                            color: active ? appearance.accentForeground : appearance.ink,
                            borderColor: active ? appearance.accent : appearance.border,
                          }}
                        >
                          {option.name}
                          {/* Multiplier options (MAXI) scale the item price, so
                              they have no fixed euro value and render as "×2". */}
                          {modifierOptionPriceBadge(option) ? (
                            <span className="ml-1 opacity-80 tabular-nums">{modifierOptionPriceBadge(option)}</span>
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

          {removable.length > 0 && (
            <div className="space-y-2 border-t pt-5" style={{ borderColor: appearance.border }}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: appearance.muted }}>
                  Togli ingredienti
                </h3>
                {removed.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRemoved([])}
                    className="inline-flex min-h-[32px] items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: appearance.muted }}
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    Ripristina
                  </button>
                )}
              </div>
              <p className="text-[11px]" style={{ color: appearance.muted }}>
                Tocca un ingrediente per farlo togliere in cucina.
              </p>
              <div className="flex flex-wrap gap-2">
                {removable.map((component) => {
                  const isRemoved = removed.includes(component.id);
                  return (
                    <button
                      key={component.id}
                      type="button"
                      onClick={() => toggleRemoved(component.id)}
                      aria-pressed={isRemoved}
                      aria-label={isRemoved ? `${component.name}: rimetti` : `${component.name}: togli`}
                      className="min-h-[44px] rounded-lg border px-4 text-xs font-bold transition-all active:scale-[0.98]"
                      style={{
                        backgroundColor: isRemoved ? appearance.surface : 'transparent',
                        color: isRemoved ? appearance.muted : appearance.ink,
                        borderColor: isRemoved ? appearance.accent : appearance.border,
                        textDecorationLine: isRemoved ? 'line-through' : 'none',
                      }}
                    >
                      {component.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="block border-t pt-5" style={{ borderColor: appearance.border }}>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em]" style={{ color: appearance.muted }}>
              Nota per questo piatto
            </span>
            <textarea
              value={lineNote}
              onChange={(event) => setLineNote(event.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Es. ben cotta, senza sale…"
              className="mt-1.5 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              style={{
                backgroundColor: appearance.pageBg,
                borderColor: appearance.border,
                color: appearance.ink,
              }}
            />
          </label>
        </div>

        <div className="shrink-0 space-y-2 border-t p-4" style={{ borderColor: appearance.border }}>
          {missingRequired && <p className="text-xs text-rose-600">Seleziona le opzioni obbligatorie.</p>}
          {removed.length > 0 && (
            <p className="text-xs" style={{ color: appearance.muted }}>
              Senza: {removable.filter((component) => removed.includes(component.id)).map((component) => component.name).join(', ')}
            </p>
          )}
          <button
            type="button"
            disabled={missingRequired}
            onClick={() => {
              const selectedModifiers = Object.entries(selections).flatMap(([groupId, optionIds]) =>
                optionIds.map((optionId) => ({ groupId, optionId })),
              );
              onConfirm({
                selectedModifiers,
                modifierPriceDelta: delta,
                ingredientOverrides: removed.map((ingredientId) => ({ ingredientId, action: 'remove' as const })),
                notes: lineNote.trim() || undefined,
              });
            }}
            className="min-h-[52px] w-full rounded-full text-xs font-extrabold uppercase tracking-[0.16em] transition-transform active:scale-[0.99] disabled:opacity-50"
            style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
          >
            Aggiungi · {formatPrice(item.price + delta)}
          </button>
        </div>
      </div>
    </div>
  );
}
