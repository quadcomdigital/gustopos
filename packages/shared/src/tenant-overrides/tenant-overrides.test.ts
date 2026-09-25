import assert from "node:assert/strict";
import test from "node:test";
import { hasTenantOverride, resolveTenantOverrides } from "./index";

test("an unknown tenant gets base behaviour (every capability off)", () => {
  assert.deepEqual(resolveTenantOverrides("franks"), { jolly: false, modifierMultiplier: false });
  assert.deepEqual(resolveTenantOverrides(), { jolly: false, modifierMultiplier: false });
  assert.deepEqual(resolveTenantOverrides(null, undefined, ""), { jolly: false, modifierMultiplier: false });
});

test("casale is enabled by slug", () => {
  const overrides = resolveTenantOverrides("casale");
  assert.equal(overrides.jolly, true);
  assert.equal(overrides.modifierMultiplier, true);
});

test("casale is enabled by tenant id (the POS store only knows the id)", () => {
  const overrides = resolveTenantOverrides(undefined, "ten_2ad3a695-8893-411f-b922-f28c9b30a6d8");
  assert.equal(overrides.jolly, true);
  assert.equal(overrides.modifierMultiplier, true);
});

test("first matching key wins when both slug and id are passed", () => {
  // Unknown slug first → falls through to the known id.
  assert.equal(hasTenantOverride("jolly", "does-not-exist", "ten_2ad3a695-8893-411f-b922-f28c9b30a6d8"), true);
  // A matching slug short-circuits before the id is consulted.
  assert.equal(hasTenantOverride("jolly", "casale", "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f"), true);
});

test("a capability is read per key, not as an all-or-nothing blob", () => {
  // The registry currently enables both together; the API must still read
  // them independently so a future tenant can take one without the other.
  assert.equal(hasTenantOverride("jolly", "casale"), true);
  assert.equal(hasTenantOverride("modifierMultiplier", "franks"), false);
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
