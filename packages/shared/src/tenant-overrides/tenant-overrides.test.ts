import assert from "node:assert/strict";
import test from "node:test";
import { hasTenantOverride, resolveTenantOverrides } from "./index";

test("an unknown tenant gets base behaviour (every capability off)", () => {
  const base = {
    jolly: false,
    modifierMultiplier: false,
    posAlphabeticalSort: false,
    stationNotes2x1: false,
    stationHideComandaLine: false,
    stationTable2x1: false,
    openPrice: false,
  };
  assert.deepEqual(resolveTenantOverrides("unknown-tenant"), base);
  assert.deepEqual(resolveTenantOverrides(), base);
  assert.deepEqual(resolveTenantOverrides(null, undefined, ""), base);
});

test("casale is enabled by slug", () => {
  const overrides = resolveTenantOverrides("casale");
  assert.equal(overrides.jolly, true);
  assert.equal(overrides.modifierMultiplier, true);
  assert.equal(overrides.posAlphabeticalSort, true);
  assert.equal(overrides.stationNotes2x1, true);
  assert.equal(overrides.stationHideComandaLine, true);
  assert.equal(overrides.stationTable2x1, true);
});

test("casale is enabled by tenant id (the POS store only knows the id)", () => {
  const overrides = resolveTenantOverrides(undefined, "ten_2ad3a695-8893-411f-b922-f28c9b30a6d8");
  assert.equal(overrides.jolly, true);
  assert.equal(overrides.modifierMultiplier, true);
  assert.equal(overrides.posAlphabeticalSort, true);
  assert.equal(overrides.stationNotes2x1, true);
  assert.equal(overrides.stationHideComandaLine, true);
  assert.equal(overrides.stationTable2x1, true);
});

test("franks is enabled for openPrice by slug and by tenant id", () => {
  assert.equal(resolveTenantOverrides("franks").openPrice, true);
  assert.equal(resolveTenantOverrides(undefined, "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f").openPrice, true);
  // The open-price capability is franks-only: casale never gets it.
  assert.equal(resolveTenantOverrides("casale").openPrice, false);
  assert.equal(resolveTenantOverrides().openPrice, false);
});

test("first matching key wins when both slug and id are passed", () => {
  // Unknown slug first → falls through to the known id.
  assert.equal(hasTenantOverride("jolly", "does-not-exist", "ten_2ad3a695-8893-411f-b922-f28c9b30a6d8"), true);
  // A matching slug short-circuits before the id is consulted.
  assert.equal(hasTenantOverride("jolly", "casale", "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f"), true);
});

test("a capability is read per key, not as an all-or-nothing blob", () => {
  // The registry currently enables them together; the API must still read
  // them independently so a future tenant can take one without the others.
  assert.equal(hasTenantOverride("jolly", "casale"), true);
  assert.equal(hasTenantOverride("modifierMultiplier", "franks"), false);
  assert.equal(hasTenantOverride("posAlphabeticalSort", "casale"), true);
  assert.equal(hasTenantOverride("posAlphabeticalSort", "franks"), false);
  // Notes at GS 2x1 is a print-only deviation: casale yes, everyone else no.
  assert.equal(hasTenantOverride("stationNotes2x1", "casale"), true);
  assert.equal(hasTenantOverride("stationNotes2x1", "franks"), false);
  assert.equal(hasTenantOverride("stationNotes2x1"), false);
  // Same for the two kitchen-header deviations: print-only, casale only.
  assert.equal(hasTenantOverride("stationHideComandaLine", "casale"), true);
  assert.equal(hasTenantOverride("stationHideComandaLine", "franks"), false);
  assert.equal(hasTenantOverride("stationTable2x1", "casale"), true);
  assert.equal(hasTenantOverride("stationTable2x1", "franks"), false);
  assert.equal(hasTenantOverride("stationTable2x1"), false);
  // The open-price capability is the mirror image: franks only.
  assert.equal(hasTenantOverride("openPrice", "franks"), true);
  assert.equal(hasTenantOverride("openPrice", "casale"), false);
  assert.equal(hasTenantOverride("openPrice"), false);
});

test("resolved overrides cannot be mutated through the returned object", () => {
  const overrides = resolveTenantOverrides("casale");
  assert.ok(Object.isFrozen(overrides), "resolved overrides are frozen");
  try {
    (overrides as { jolly: boolean }).jolly = false;
  } catch (error) {
    // Strict mode (ESM / "use strict") throws TypeError: also acceptable.
    assert.ok(error instanceof TypeError);
  }
  // Whatever the runtime does on assignment, the resolved value must stand —
  // a caller must never be able to flip a tenant on for everyone else.
  assert.equal(overrides.jolly, true);
  assert.equal(resolveTenantOverrides("franks").jolly, false);
});
