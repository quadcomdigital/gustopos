/**
 * Installer/diagnostics templates.
 *
 * These scripts used to ship with a baked-in CA, leaf, SHA-1 fingerprint and
 * (worse) another tenant's domain, so every certificate rotation left behind a
 * script that whitelisted a fingerprint the server no longer served — and the
 * debug script compared the local machine against `test.franksbar.it` on every
 * tenant. The guards below keep them generic: rendered per request, nothing
 * hardcoded, every placeholder filled.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SIGNING_TEMPLATES,
  isSigningTemplateName,
  renderSigningTemplate,
  signingTemplateContentType,
  signingTemplateDir,
  type SigningTemplateContext,
} from "./signing-templates";

const CTX: SigningTemplateContext = {
  origin: "https://test.acme.example",
  slug: "acme",
  cn: "GustoPOS acme",
  rootFingerprintSha1: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  leafFingerprintSha1: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
};

test("exposes the four installer/diagnostics templates", () => {
  assert.deepEqual([...SIGNING_TEMPLATES], [
    "install-qz-cert.bat",
    "install-qz-cert.ps1",
    "install-qz-cert.sh",
    "debug-qz-cert.bat",
    "debug-qz-cert.ps1",
  ]);
  assert.ok(isSigningTemplateName("install-qz-cert.sh"));
  assert.equal(isSigningTemplateName("install-qz-cert.exe"), false);
});

test("every template renders with no placeholder left", () => {
  for (const name of SIGNING_TEMPLATES) {
    const rendered = renderSigningTemplate(name, CTX);
    assert.ok(rendered.length > 100, `${name} rendered to something too small`);
    assert.ok(!/\{\{[A-Z0-9_]+\}\}/.test(rendered), `${name} still contains a placeholder`);
    assert.ok(rendered.includes(CTX.origin), `${name} must target the tenant origin`);
    assert.ok(rendered.includes(CTX.slug), `${name} must name the tenant`);
  }
});

test("no template hardcodes a tenant domain or a certificate fingerprint", () => {
  for (const name of SIGNING_TEMPLATES) {
    const source = readFileSync(join(signingTemplateDir(), name), "utf-8");
    assert.ok(!/franksbar/i.test(source), `${name} hardcodes test.franksbar.it`);
    assert.ok(!/anticocasale/i.test(source), `${name} hardcodes the casale domain`);
    assert.ok(
      !/\b[0-9A-F]{40}\b/.test(source),
      `${name} hardcodes a SHA-1 fingerprint — it goes stale on every rotation`,
    );
    assert.ok(!/BASE64|CERT_B64|LEAF_B64/.test(source), `${name} embeds a certificate payload`);
  }
});

test("the Windows installer downloads the material instead of embedding it", () => {
  const rendered = renderSigningTemplate("install-qz-cert.ps1", CTX);
  assert.ok(rendered.includes("/signing/override.crt"), "must fetch the trust anchor");
  assert.ok(rendered.includes("/signing/digital-certificate.txt"), "must fetch the leaf");
  assert.ok(rendered.includes(CTX.rootFingerprintSha1), "must pin the published CA fingerprint");
  assert.ok(rendered.includes(CTX.leafFingerprintSha1), "must pin the published leaf fingerprint");
  assert.ok(rendered.includes("--allow"), "must whitelist the certificate");
  assert.ok(rendered.includes("override.crt"), "must install the trust anchor");
});

test("the POSIX installer verifies the chain before writing anything", () => {
  const rendered = renderSigningTemplate("install-qz-cert.sh", CTX);
  assert.ok(rendered.includes("openssl verify"), "must verify the chain with openssl");
  assert.ok(rendered.includes(CTX.rootFingerprintSha1));
  assert.ok(rendered.includes(CTX.leafFingerprintSha1));
});

test("the diagnostics report every location QZ reads", () => {
  const rendered = renderSigningTemplate("debug-qz-cert.ps1", CTX);
  assert.ok(rendered.includes("allowed.dat"));
  assert.ok(rendered.includes("override.crt"));
  assert.ok(rendered.includes("debug.log"), "must inspect QZ's own trust log");
  assert.ok(rendered.includes("clock"), "must check the clock (VALID_SIGNING_PERIOD is 15 min)");
});

test("the installers speak QZ's own allowed.dat format (lowercase fingerprint)", () => {
  // qz/utils/ByteUtilities.toHexString(digest, upperCase=false): QZ writes and
  // matches the SHA-1 in LOWERCASE, case-sensitively. An uppercase entry — the
  // way openssl and .NET print it — is invisible to QZ, so the dialog keeps
  // coming back even though the file "contains" the fingerprint.
  const posix = renderSigningTemplate("install-qz-cert.sh", CTX);
  assert.ok(posix.includes("tr 'A-F' 'a-f'"), "POSIX installer must lowercase the fingerprint");
  assert.ok(
    posix.includes("printf '%s\\t%s\\t%s\\t%s\\t%s\\tTrue'"),
    "allowed.dat line must keep QZ's tab-separated format",
  );
  assert.ok(posix.includes("grep -qi"), "the presence check must be case-insensitive");
  assert.ok(posix.includes("pkill -x"), "QZ must be stopped by exact process name");
  assert.ok(!/^\s*pkill\s+-f/m.test(posix), "pkill -f kills any command line that mentions the path");

  const windows = renderSigningTemplate("install-qz-cert.ps1", CTX);
  assert.ok(windows.includes("ExpectedLeafShaLc"), "Windows installer must lowercase the fingerprint");
  assert.ok(windows.includes("ToLowerInvariant()"));
});

test("refuses to render with an empty value instead of shipping a broken script", () => {
  assert.throws(
    () => renderSigningTemplate("install-qz-cert.sh", { ...CTX, origin: "" }),
    /ORIGIN is empty/,
  );
  assert.throws(
    () => renderSigningTemplate("install-qz-cert.sh", { ...CTX, leafFingerprintSha1: "  " }),
    /LEAF_SHA1 is empty/,
  );
  assert.throws(
    () => renderSigningTemplate("install-qz-cert.sh", { ...CTX, cn: "" }),
    /CN is empty/,
  );
});

test("content types and unknown names", () => {
  assert.equal(signingTemplateContentType("install-qz-cert.bat"), "application/octet-stream");
  assert.equal(
    signingTemplateContentType("install-qz-cert.sh"),
    "text/x-shellscript; charset=utf-8",
  );
  assert.throws(
    () => renderSigningTemplate("missing.bat" as never, CTX),
    /ENOENT|no such file/,
  );
});
