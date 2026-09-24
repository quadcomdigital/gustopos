// ─── Modifier pricing (single source of truth) ──────────────────────────
// Shared by the POS (client-side preview + payload), the public menu and the
// API (server-side authoritative re-pricing). Keep this dependency-free.

export type ModifierPriceMode = "max" | "sum" | "none";

export type ModifierPriceOptionShape = {
  id: string;
  priceDelta?: number | null;
  isDefault?: boolean | null;
  /** Multiplicative pricing on the item base price. Absent/null = additive only. */
  priceMultiplier?: number | null;
};

export type ModifierPriceGroupShape = {
  maxSelections: number;
  multiSelectPriceMode?: ModifierPriceMode | null;
  options: ModifierPriceOptionShape[];
};

/**
 * A group is multi-select when it allows more than one option. This is the
 * single source of truth shared by the POS checkbox/radio rendering and the
 * price helper, so the "explicit type" in the builder maps to one rule.
 */
export function isMultiSelectGroup(group: Pick<ModifierPriceGroupShape, "maxSelections">): boolean {
  return (group.maxSelections ?? 1) > 1;
}

/**
 * Price delta contributed by the selected options of one modifier group.
 *
 * Two mechanisms compose additively:
 *
 *  1. MULTIPLIER (`priceMultiplier`) — scales the ITEM's own base price.
 *     An option with multiplier `m` contributes `basePrice × (m - 1)`, so
 *     m=2 doubles the item. These are summed: each one is a format charge on
 *     the item itself, not an alternative to pick among.
 *
 *  2. ADDITIVE (`priceDelta`) — flat euros, ruled by `multiSelectPriceMode`
 *     for multi-select groups:
 *       - "max"  → highest selected delta (legacy behaviour)
 *       - "sum"  → sum of every selected delta
 *       - "none" → no cost, ever (also suppresses the multiplier, honouring
 *                  the "never changes the price" contract)
 *     Single-select groups always charge the selected option's delta.
 *
 * Defaults are never charged (they are already baked into the item price).
 *
 * `basePrice` must be the price of the item the group belongs to. When a
 * multiplier is selected but `basePrice` is not supplied, the multiplier
 * contributes 0 — so every caller that can select such an option MUST pass it.
 *
 * Final line price = (basePrice + returned delta) × quantity, downstream.
 */
export function computeGroupModifierDelta(
  group: ModifierPriceGroupShape,
  selectedOptionIds: string[],
  basePrice?: number,
): number {
  if (selectedOptionIds.length === 0) return 0;

  const selected = group.options.filter(
    (option) => selectedOptionIds.includes(option.id) && !option.isDefault,
  );
  if (selected.length === 0) return 0;

  const priceMode = group.multiSelectPriceMode ?? "max";
  if (priceMode === "none") return 0;

  const effectiveBase = typeof basePrice === "number" && Number.isFinite(basePrice) ? basePrice : 0;

  // 1. Multiplicative part: base × (m - 1) per selected option.
  let multiplierDelta = 0;
  for (const option of selected) {
    const multiplier = option.priceMultiplier;
    if (typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier === 1) continue;
    multiplierDelta += effectiveBase * (multiplier - 1);
  }

  // 2. Additive part: the legacy delta rule.
  const deltas = selected.map((option) => option.priceDelta ?? 0);
  let additiveDelta: number;
  if (!isMultiSelectGroup(group)) {
    additiveDelta = deltas.reduce((sum, delta) => sum + delta, 0);
  } else if (priceMode === "sum") {
    additiveDelta = deltas.reduce((sum, delta) => sum + delta, 0);
  } else {
    // "max"
    additiveDelta = Math.max(...deltas);
  }

  return multiplierDelta + additiveDelta;
}

/**
 * Human-readable badge for one option, POS/menu side. Multiplier options are
 * advertised as "×2" rather than as a euro delta, because their real cost
 * depends on the item being priced (callers keep formatting euro deltas
 * themselves so existing currency rendering stays untouched).
 */
export function modifierOptionPriceBadge(option: ModifierPriceOptionShape): string | undefined {
  const multiplier = option.priceMultiplier;
  if (typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier !== 1) {
    return `×${formatMultiplier(multiplier)}`;
  }
  const delta = option.priceDelta ?? 0;
  if (delta === 0) return undefined;
  return `${delta > 0 ? "+" : "-"}€${Math.abs(delta).toFixed(2)}`;
}

/** 2 → "2", 1.5 → "1.5" (no trailing zeros). */
export function formatMultiplier(multiplier: number): string {
  return String(Number(multiplier.toFixed(3)));
}
