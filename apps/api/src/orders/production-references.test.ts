import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveItemReference, buildReferenceTally } from "./production-references";

test("category reference is used when no product/modifier override", () => {
  assert.equal(resolveItemReference({ modifierRefs: [], itemRef: null, categoryRef: "ref_bun" }), "ref_bun");
});

test("product reference overrides the category reference", () => {
  assert.equal(resolveItemReference({ modifierRefs: [], itemRef: "ref_panino", categoryRef: "ref_bun" }), "ref_panino");
});

test("main modifier (lowest sort_order) overrides product and category", () => {
  const result = resolveItemReference({
    modifierRefs: [
      { referenceId: "ref_secondo", sortOrder: 5 },
      { referenceId: "ref_piadina", sortOrder: 1 },
    ],
    itemRef: "ref_panino",
    categoryRef: "ref_bun",
  });
  assert.equal(result, "ref_piadina");
});

test("no reference resolves to null", () => {
  assert.equal(resolveItemReference({ modifierRefs: [], itemRef: null, categoryRef: null }), null);
});

test("tally sums quantities per reference and ignores nulls", () => {
  const tally = buildReferenceTally([
    { referenceId: "ref_bun", quantity: 2 },
    { referenceId: "ref_piadina", quantity: 1 },
    { referenceId: "ref_bun", quantity: 1 },
    { referenceId: null, quantity: 5 },
  ]);
  assert.equal(tally.get("ref_bun"), 3);
  assert.equal(tally.get("ref_piadina"), 1);
  assert.equal(tally.size, 2);
});
