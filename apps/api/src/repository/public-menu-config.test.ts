import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGroupModifierDelta,
  isMultiSelectGroup,
  modifierOptionPriceBadge,
  normalizePublicMenuConfig,
  mergeTenantPublicMenuConfig,
  publicMenuModuleConfigSchema,
} from "@gustopos/shared";

/**
 * Tests for the public-menu config normalizer/merge and the shared modifier
 * pricing rules. Pricing is used both by the POS (preview) and the API
 * (authoritative re-pricing of public self-service orders), so the rules must
 * be stable and identical on both sides.
 */

// ─── Modifier pricing ───────────────────────────────────────────────────

test("single-select group charges the selected option delta", () => {
  const group = {
    maxSelections: 1,
    multiSelectPriceMode: "max" as const,
    options: [
      { id: "a", priceDelta: 1.5, isDefault: false },
      { id: "b", priceDelta: 2, isDefault: false },
    ],
  };
  assert.equal(computeGroupModifierDelta(group, ["a"]), 1.5);
  assert.equal(computeGroupModifierDelta(group, ["a", "b"]), 3.5);
});

test("default options are free", () => {
  const group = {
    maxSelections: 1,
    multiSelectPriceMode: "max" as const,
    options: [{ id: "base", priceDelta: 5, isDefault: true }],
  };
  assert.equal(computeGroupModifierDelta(group, ["base"]), 0);
});

test("multi-select respects max / sum / none price modes", () => {
  const options = [
    { id: "a", priceDelta: 1, isDefault: false },
    { id: "b", priceDelta: 2, isDefault: false },
    { id: "c", priceDelta: 0.5, isDefault: false },
  ];
  assert.equal(computeGroupModifierDelta({ maxSelections: 3, multiSelectPriceMode: "max", options }, ["a", "b", "c"]), 2);
  assert.equal(computeGroupModifierDelta({ maxSelections: 3, multiSelectPriceMode: "sum", options }, ["a", "b", "c"]), 3.5);
  assert.equal(computeGroupModifierDelta({ maxSelections: 3, multiSelectPriceMode: "none", options }, ["a", "b", "c"]), 0);
});

test("isMultiSelectGroup is driven by maxSelections", () => {
  assert.equal(isMultiSelectGroup({ maxSelections: 1 }), false);
  assert.equal(isMultiSelectGroup({ maxSelections: 3 }), true);
});

// ─── priceMultiplier (MAXI-style scaling) ───────────────────────────────

test("priceMultiplier scales the item base price, then deltas add on top", () => {
  // MAXI (×2) on an 8.00 pizza = +8.00, plus a 1.50 topping = +9.50 total.
  const group = {
    maxSelections: 3,
    multiSelectPriceMode: "sum" as const,
    options: [
      { id: "maxi", priceDelta: 0, priceMultiplier: 2, isDefault: false },
      { id: "extra", priceDelta: 1.5, isDefault: false },
    ],
  };
  assert.equal(computeGroupModifierDelta(group, ["maxi"], 8), 8);
  assert.equal(computeGroupModifierDelta(group, ["maxi", "extra"], 8), 9.5);
});

test("priceMultiplier with a fractional factor", () => {
  const group = {
    maxSelections: 1,
    multiSelectPriceMode: "max" as const,
    options: [{ id: "half", priceDelta: 0, priceMultiplier: 1.5, isDefault: false }],
  };
  // 1.5× on 10.00 → +5.00
  assert.equal(computeGroupModifierDelta(group, ["half"], 10), 5);
});

test("priceMultiplier contributes nothing when the base price is not supplied", () => {
  const group = {
    maxSelections: 1,
    multiSelectPriceMode: "max" as const,
    options: [{ id: "maxi", priceDelta: 0, priceMultiplier: 2, isDefault: false }],
  };
  assert.equal(computeGroupModifierDelta(group, ["maxi"]), 0);
});

test("priceMultiplier of 1 (or unset) leaves the legacy additive behaviour", () => {
  const group = {
    maxSelections: 2,
    multiSelectPriceMode: "sum" as const,
    options: [
      { id: "plain", priceDelta: 1.5, priceMultiplier: 1, isDefault: false },
      { id: "legacy", priceDelta: 2, isDefault: false },
    ],
  };
  assert.equal(computeGroupModifierDelta(group, ["plain", "legacy"], 8), 3.5);
});

test("priceMultiplier is suppressed by the 'none' price mode", () => {
  const group = {
    maxSelections: 3,
    multiSelectPriceMode: "none" as const,
    options: [{ id: "maxi", priceDelta: 0, priceMultiplier: 2, isDefault: false }],
  };
  assert.equal(computeGroupModifierDelta(group, ["maxi"], 8), 0);
});

test("priceMultiplier on a default option is never charged", () => {
  const group = {
    maxSelections: 1,
    multiSelectPriceMode: "max" as const,
    options: [{ id: "maxi", priceDelta: 0, priceMultiplier: 2, isDefault: true }],
  };
  assert.equal(computeGroupModifierDelta(group, ["maxi"], 8), 0);
});

test("multiplier badge renders as ×N instead of a euro amount", () => {
  assert.equal(modifierOptionPriceBadge({ id: "maxi", priceMultiplier: 2 }), "×2");
  assert.equal(modifierOptionPriceBadge({ id: "maxi", priceMultiplier: 1.5 }), "×1.5");
  assert.equal(modifierOptionPriceBadge({ id: "extra", priceDelta: 1.5 }), "+€1.50");
  assert.equal(modifierOptionPriceBadge({ id: "free" }), undefined);
  assert.equal(modifierOptionPriceBadge({ id: "plain", priceDelta: 0, priceMultiplier: 1 }), undefined);
});

// ─── Public menu config normalizer ──────────────────────────────────────

test("legacy flat config is normalised with sections and defaults", () => {
  const legacy = {
    preset: "modern_bistro",
    accentColor: "#ff0000",
    brandTagline: "Franks",
    showPrices: false,
    currency: "EUR",
  };
  const config = normalizePublicMenuConfig(legacy);
  assert.equal(config.preset, "modern_bistro");
  assert.equal(config.accentColor, "#ff0000");
  assert.equal(config.showPrices, false);
  assert.ok(config.sections.length > 0, "sections default is applied");
  assert.deepEqual(config.content, {});
});

test("empty config yields schema defaults", () => {
  const config = normalizePublicMenuConfig({});
  assert.equal(config.preset, "minimal_elegant");
  assert.equal(config.accentColor, "#0f172a");
  assert.equal(publicMenuModuleConfigSchema.parse({}).sections.length > 0, true);
});

test("tenant merge preserves superadmin-only fields", () => {
  const stored = {
    preset: "minimal_elegant",
    accentColor: "#0f172a",
    hiddenCategoryIds: ["cat_secret"],
    featuredItemIds: ["m_featured"],
    soldOutItemIds: ["m_sold"],
    categoryOrder: ["cat_a"],
  };
  const merged = mergeTenantPublicMenuConfig(stored, {
    accentColor: "#123456",
    // A malicious tenant patch trying to clear pinned fields is ignored.
    hiddenCategoryIds: [],
    featuredItemIds: [],
  } as Record<string, unknown>);
  assert.equal(merged.accentColor, "#123456");
  assert.deepEqual(merged.hiddenCategoryIds, ["cat_secret"]);
  assert.deepEqual(merged.featuredItemIds, ["m_featured"]);
  assert.deepEqual(merged.soldOutItemIds, ["m_sold"]);
  assert.deepEqual(merged.categoryOrder, ["cat_a"]);
});

test("tenant merge rejects unknown/invalid values", () => {
  assert.throws(() => mergeTenantPublicMenuConfig({}, { accentColor: "not-a-color" }));
});
