import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isLegacyAreaKey,
  normalizeStationIds,
  sanitizeActiveStationIds,
} from "./print-areas";

test("isLegacyAreaKey matches the pre-station enum keys, case-insensitively", () => {
  assert.equal(isLegacyAreaKey("kitchen"), true);
  assert.equal(isLegacyAreaKey("CASHIER"), true);
  assert.equal(isLegacyAreaKey("st_kitchen"), false);
  assert.equal(isLegacyAreaKey(undefined), false);
});

test("normalizeStationIds drops empties and legacy keys, then de-duplicates", () => {
  assert.deepEqual(
    normalizeStationIds(["st_cucina", "", "  ", "kitchen", "st_bar", "st_cucina", 7]),
    ["st_cucina", "st_bar"],
  );
});

test("an empty zone filter stays empty (empty = every active station)", () => {
  // The read path treats `[]` as "no filter": this is what lets an admin mean
  // "print to every zone" without listing them all.
  assert.deepEqual(sanitizeActiveStationIds([], new Set(["st_cucina", "st_bar"])), []);
});

test("sanitizeActiveStationIds keeps only live, active station ids", () => {
  const active = new Set(["st_cucina", "st_bar"]);
  assert.deepEqual(
    sanitizeActiveStationIds(["st_bar", "st_cucina"], active),
    ["st_bar", "st_cucina"],
  );
});

test("stale ids (deleted or deactivated stations) are dropped, never rejected", () => {
  // Refusing would lock the admin out of Settings; keeping the id would leave a
  // key nobody resolves. Dropping keeps the stored filter honest.
  const active = new Set(["st_cucina"]);
  assert.deepEqual(sanitizeActiveStationIds(["st_cucina", "st_removed"], active), ["st_cucina"]);
  assert.deepEqual(sanitizeActiveStationIds(["st_removed"], active), []);
});

test("legacy enum keys and duplicates cannot leak into the filter", () => {
  const active = new Set(["st_cucina", "st_bar"]);
  assert.deepEqual(
    sanitizeActiveStationIds(["st_bar", "kitchen", "st_bar", "st_bar"], active),
    ["st_bar"],
  );
});
