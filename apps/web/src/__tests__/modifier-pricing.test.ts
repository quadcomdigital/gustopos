import { describe, expect, it } from 'vitest';
import type { ModifierGroup } from '@gustopos/shared';
import { computeGroupModifierDelta, isMultiSelectGroup, modifierOptionPriceBadge } from '../lib/modifier-pricing';

function group(overrides: Partial<ModifierGroup>): ModifierGroup {
  return {
    id: 'g1',
    name: 'Gruppo',
    required: false,
    minSelections: 0,
    maxSelections: 1,
    multiSelectPriceMode: 'max',
    sortOrder: 0,
    options: [],
    ...overrides,
  };
}

const option = (id: string, priceDelta: number, isDefault = false) => ({
  id,
  name: id,
  componentType: 'ingredient' as const,
  quantity: 1,
  unit: 'pz' as const,
  priceDelta,
  isDefault,
  isActive: true,
  sortOrder: 0,
  ingredientOverrides: [],
});

describe('isMultiSelectGroup', () => {
  it('is false for maxSelections 1', () => {
    expect(isMultiSelectGroup({ maxSelections: 1 })).toBe(false);
  });
  it('is true for maxSelections > 1', () => {
    expect(isMultiSelectGroup({ maxSelections: 3 })).toBe(true);
  });
});

describe('computeGroupModifierDelta', () => {
  it('returns 0 when nothing is selected', () => {
    const g = group({ options: [option('a', 2)] });
    expect(computeGroupModifierDelta(g, [])).toBe(0);
  });

  it('single-select charges the selected non-default delta', () => {
    const g = group({ options: [option('a', 0, true), option('b', 1.5)] });
    expect(computeGroupModifierDelta(g, ['b'])).toBe(1.5);
  });

  it('single-select ignores default options', () => {
    const g = group({ options: [option('a', 2, true)] });
    expect(computeGroupModifierDelta(g, ['a'])).toBe(0);
  });

  it('multi "max" charges only the highest selected delta', () => {
    const g = group({ maxSelections: 3, multiSelectPriceMode: 'max', options: [option('a', 1), option('b', 2), option('c', 0.5)] });
    expect(computeGroupModifierDelta(g, ['a', 'b', 'c'])).toBe(2);
  });

  it('multi "sum" adds every selected delta', () => {
    const g = group({ maxSelections: 3, multiSelectPriceMode: 'sum', options: [option('a', 1), option('b', 2), option('c', 0.5)] });
    expect(computeGroupModifierDelta(g, ['a', 'b', 'c'])).toBe(3.5);
  });

  it('multi "none" never charges', () => {
    const g = group({ maxSelections: 6, multiSelectPriceMode: 'none', options: [option('a', 1), option('b', 2)] });
    expect(computeGroupModifierDelta(g, ['a', 'b'])).toBe(0);
  });

  it('multi with all-default selections is free', () => {
    const g = group({ maxSelections: 3, multiSelectPriceMode: 'sum', options: [option('a', 5, true)] });
    expect(computeGroupModifierDelta(g, ['a'])).toBe(0);
  });
});

// ─── priceMultiplier (MAXI-style scaling) ───────────────────────────────

const multiplierOption = (id: string, priceMultiplier: number, priceDelta = 0, isDefault = false) => ({
  ...option(id, priceDelta, isDefault),
  priceMultiplier,
});

describe('computeGroupModifierDelta with priceMultiplier', () => {
  it('doubles the item base price when ×2 is selected', () => {
    const g = group({ maxSelections: 3, multiSelectPriceMode: 'sum', options: [multiplierOption('maxi', 2)] });
    expect(computeGroupModifierDelta(g, ['maxi'], 8)).toBe(8);
  });

  it('applies the multiplier first, then adds toppings', () => {
    // base×2 + 1.50 topping on an 8.00 pizza → +9.50
    const g = group({
      maxSelections: 3,
      multiSelectPriceMode: 'sum',
      options: [multiplierOption('maxi', 2), option('extra', 1.5)],
    });
    expect(computeGroupModifierDelta(g, ['maxi', 'extra'], 8)).toBe(9.5);
  });

  it('supports fractional multipliers', () => {
    const g = group({ maxSelections: 1, options: [multiplierOption('half', 1.5)] });
    expect(computeGroupModifierDelta(g, ['half'], 10)).toBe(5);
  });

  it('contributes nothing when the base price is missing', () => {
    const g = group({ maxSelections: 1, options: [multiplierOption('maxi', 2)] });
    expect(computeGroupModifierDelta(g, ['maxi'])).toBe(0);
  });

  it('keeps legacy additive behaviour when the multiplier is 1', () => {
    const g = group({
      maxSelections: 2,
      multiSelectPriceMode: 'sum',
      options: [multiplierOption('plain', 1, 1.5), option('legacy', 2)],
    });
    expect(computeGroupModifierDelta(g, ['plain', 'legacy'], 8)).toBe(3.5);
  });

  it('is suppressed by the "none" price mode', () => {
    const g = group({ maxSelections: 3, multiSelectPriceMode: 'none', options: [multiplierOption('maxi', 2)] });
    expect(computeGroupModifierDelta(g, ['maxi'], 8)).toBe(0);
  });

  it('is never charged on a default option', () => {
    const g = group({ maxSelections: 1, options: [multiplierOption('maxi', 2, 0, true)] });
    expect(computeGroupModifierDelta(g, ['maxi'], 8)).toBe(0);
  });

  it('doubles a JOLLY half-price selection as expected end to end', () => {
    // Two halves at price/2 each (sum mode) → (15.00 + 5.50) / 2 = 10.25
    const g = group({
      maxSelections: 2,
      multiSelectPriceMode: 'sum',
      options: [option('gourmet', 7.5), option('margherita', 2.75)],
    });
    expect(computeGroupModifierDelta(g, ['gourmet', 'margherita'], 0)).toBe(10.25);
  });
});

describe('modifierOptionPriceBadge', () => {
  it('renders a multiplier as ×N', () => {
    expect(modifierOptionPriceBadge({ id: 'maxi', priceMultiplier: 2 })).toBe('×2');
    expect(modifierOptionPriceBadge({ id: 'maxi', priceMultiplier: 1.5 })).toBe('×1.5');
  });

  it('renders flat deltas in euros', () => {
    expect(modifierOptionPriceBadge({ id: 'extra', priceDelta: 1.5 })).toBe('+€1.50');
    expect(modifierOptionPriceBadge({ id: 'free' })).toBeUndefined();
  });
});
