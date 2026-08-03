import assert from "node:assert/strict";
import test from "node:test";
import { assertAcyclicBomGraph, normalizeTargetQuantity } from "./inventory-workflow";

test("normalizes a metric recipe edge to the target unit", () => {
  assert.equal(
    normalizeTargetQuantity({
      quantity: 20,
      fromUnit: "g",
      targetUnit: "kg",
      targetType: "ingredient",
      targetId: "cheese",
    }),
    0.02,
  );
});

test("rejects incompatible dimensions for BOM/prep targets", () => {
  assert.throws(
    () => normalizeTargetQuantity({ quantity: 1, fromUnit: "kg", targetUnit: "L", targetType: "bom" }),
    /incompatible/,
  );
});

test("allows an explicit ingredient packaging conversion only for its target", () => {
  assert.equal(
    normalizeTargetQuantity({
      quantity: 2,
      fromUnit: "carton",
      targetUnit: "kg",
      targetType: "ingredient",
      targetId: "tomato",
      customConversions: [{ targetType: "ingredient", targetId: "tomato", fromUnit: "carton", toUnit: "kg", factor: 0.5 }],
    }),
    1,
  );
});

test("rejects a direct BOM cycle", () => {
  assert.throws(
    () => assertAcyclicBomGraph([
      { bomId: "a", componentType: "bom", componentId: "b" },
      { bomId: "b", componentType: "bom", componentId: "a" },
    ]),
    /Inventory recipe cycle detected/,
  );
});

test("rejects a mixed BOM to prep to source-BOM cycle", () => {
  assert.throws(
    () => assertAcyclicBomGraph(
      [{ bomId: "a", componentType: "prep", componentId: "p" }],
      [{ prepId: "p", sourceType: "bom", sourceId: "a" }],
    ),
    /Inventory recipe cycle detected/,
  );
});

test("allows a raw-ingredient prep source as a terminal edge", () => {
  assert.doesNotThrow(() => assertAcyclicBomGraph([], [{ prepId: "p", sourceType: "ingredient", sourceId: "raw" }]));
});
