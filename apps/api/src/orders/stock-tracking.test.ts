import test from "node:test";
import assert from "node:assert/strict";
import { isStockTrackingEnabled } from "./stock-tracking";

test("stock tracking runs for the inventory module", () => {
  assert.equal(isStockTrackingEnabled(["inventory", "kitchen"]), true);
});

test("stock tracking is off in simple_catalog mode", () => {
  assert.equal(isStockTrackingEnabled(["simple_catalog", "kitchen"]), false);
});

test("stock tracking is off when neither module is enabled", () => {
  assert.equal(isStockTrackingEnabled(["kitchen"]), false);
});

test("simple_catalog wins if both are present (defensive)", () => {
  assert.equal(isStockTrackingEnabled(["inventory", "simple_catalog"]), false);
});
