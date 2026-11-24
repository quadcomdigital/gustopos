import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardGateCode } from "./dashboard-gate-codes";

test("franks resolves to its gate code by slug", () => {
  assert.equal(resolveDashboardGateCode({ tenantSlug: "franks" }), "1989");
});

test("franks resolves to its gate code by tenant id", () => {
  assert.equal(
    resolveDashboardGateCode({ tenantId: "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f" }),
    "1989",
  );
});

test("slug wins over an unrelated id", () => {
  assert.equal(
    resolveDashboardGateCode({ tenantSlug: "franks", tenantId: "ten_other" }),
    "1989",
  );
});

test("other tenants have no gate code", () => {
  assert.equal(resolveDashboardGateCode({ tenantSlug: "casale" }), null);
  assert.equal(resolveDashboardGateCode({ tenantId: "ten_2ad3a695-8893-411f-b922-f28c9b30a6d8" }), null);
});

test("missing tenant context has no gate code", () => {
  assert.equal(resolveDashboardGateCode({}), null);
  assert.equal(resolveDashboardGateCode({ tenantSlug: null, tenantId: undefined }), null);
  assert.equal(resolveDashboardGateCode({ tenantSlug: "   " }), null);
});

test("prototype keys never resolve to a code", () => {
  assert.equal(resolveDashboardGateCode({ tenantSlug: "constructor" }), null);
  assert.equal(resolveDashboardGateCode({ tenantSlug: "__proto__" }), null);
});
