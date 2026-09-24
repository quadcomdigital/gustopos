/**
 * Regression guard: the explicit /signing/digital-certificate.txt route must be
 * registered BEFORE app.useStaticAssets(web/dist).
 *
 * Background: express.static serves apps/web/dist/signing/digital-certificate.txt,
 * a build artifact that can lag behind a certificate rotation. When it shadowed
 * the explicit route, QZ Tray received a stale certificate and rejected it
 * (popup / "Request blocked") after a rotation. This test asserts the ordering
 * so the shadow cannot silently come back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MAIN_SOURCE = readFileSync(join(__dirname, "..", "..", "src", "main.ts"), "utf-8");

test("signing certificate route is registered before useStaticAssets", () => {
  const routeIndex = MAIN_SOURCE.indexOf("httpAdapter.get('/signing/digital-certificate.txt'");
  const staticIndex = MAIN_SOURCE.indexOf("app.useStaticAssets(");

  assert.ok(routeIndex !== -1, "expected the /signing/digital-certificate.txt route in main.ts");
  assert.ok(staticIndex !== -1, "expected app.useStaticAssets(...) in main.ts");
  assert.ok(
    routeIndex < staticIndex,
    "the /signing/digital-certificate.txt route must be registered BEFORE useStaticAssets, " +
      "otherwise express.static serves the web build's stale certificate copy",
  );
});
