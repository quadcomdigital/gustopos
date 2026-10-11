import test from "node:test";
import assert from "node:assert/strict";
import { runWithTenantContext } from "./tenant-context.store";
import { hasTenantOverrideFor } from "./tenant-overrides";

/**
 * The override helper reads the AsyncLocalStorage tenant context, which is what
 * every repository actually has at read/write time. These tests pin the two
 * properties that matter: the capability follows the resolved tenant, and an
 * unknown tenant always falls back to base behaviour (never enabled).
 */

const runAs = (tenantId: string, tenantSlug: string | undefined, callback: () => void) =>
  runWithTenantContext(
    { tenantId, tenantSlug, resolutionSource: "slug", enabledModules: [] },
    callback,
  );

test("casale (by slug) has both capabilities", () => {
  runAs("ten_any", "casale", () => {
    assert.equal(hasTenantOverrideFor("jolly"), true);
    assert.equal(hasTenantOverrideFor("modifierMultiplier"), true);
  });
});

test("casale (by tenant id only) has both capabilities", () => {
  // The middleware may resolve by header/jwt where the slug is absent.
  runAs("ten_2ad3a695-8893-411f-b922-f28c9b30a6d8", undefined, () => {
    assert.equal(hasTenantOverrideFor("jolly"), true);
    assert.equal(hasTenantOverrideFor("modifierMultiplier"), true);
  });
});

test("franks gets the open-price capability only", () => {
  runAs("ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f", "franks", () => {
    assert.equal(hasTenantOverrideFor("jolly"), false);
    assert.equal(hasTenantOverrideFor("modifierMultiplier"), false);
    assert.equal(hasTenantOverrideFor("openPrice"), true);
  });
});

test("no tenant context at all falls back to base behaviour", () => {
  assert.equal(hasTenantOverrideFor("jolly"), false);
  assert.equal(hasTenantOverrideFor("modifierMultiplier"), false);
  assert.equal(hasTenantOverrideFor("openPrice"), false);
});
