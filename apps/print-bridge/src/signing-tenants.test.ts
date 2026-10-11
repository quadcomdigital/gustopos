/**
 * Signing material resolution for the print-bridge.
 *
 * Regression guard for the failure that made every caller (explicit
 * `?tenant=`, tenant `Origin`, tenant `Host`) fall back to the LEGACY shared
 * certificate: `signingCertsDir()` resolved to a non-existent `apps/certs`,
 * the tenant list came back empty, and the POS machines installed a CA the
 * tenant agent's certificate does not chain to — QZ Tray then refused the
 * handshake and no local printer was ever discovered.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  clearSigningTenantCache,
  listSigningTenants,
  resolveTenantForRequest,
  signingCertsDir,
} from "./signing-tenants";

describe("signing-tenants", () => {
  let previousTenant: string | undefined;

  beforeEach(() => {
    previousTenant = process.env.PRINT_BRIDGE_TENANT;
    delete process.env.PRINT_BRIDGE_TENANT;
    clearSigningTenantCache();
  });

  afterEach(() => {
    if (previousTenant === undefined) delete process.env.PRINT_BRIDGE_TENANT;
    else process.env.PRINT_BRIDGE_TENANT = previousTenant;
    clearSigningTenantCache();
  });

  it("resolves the certs directory that exists on disk", () => {
    const dir = signingCertsDir();
    assert.ok(fs.existsSync(dir), `certs directory missing: ${dir}`);
    assert.ok(
      fs.existsSync(path.join(dir, "digital-certificate.pem")) ||
        fs.existsSync(path.join(dir, "tenants")),
      `no signing material in ${dir}`,
    );
  });

  it("honours QZ_CERTS_DIR", () => {
    const previous = process.env.QZ_CERTS_DIR;
    const fake = path.join(os.tmpdir(), "gustopos-qz-certs-test");
    process.env.QZ_CERTS_DIR = fake;
    try {
      clearSigningTenantCache();
      assert.equal(signingCertsDir(), fake);
    } finally {
      if (previous === undefined) delete process.env.QZ_CERTS_DIR;
      else process.env.QZ_CERTS_DIR = previous;
      clearSigningTenantCache();
    }
  });

  it("loads the per-tenant PKI instead of silently serving the legacy certificate", () => {
    const tenantsDir = path.join(signingCertsDir(), "tenants");
    if (!fs.existsSync(tenantsDir)) return; // legacy-only checkout: nothing to load

    const tenants = listSigningTenants();
    assert.ok(tenants.length > 0, `tenants/ exists but no tenant was loaded from ${tenantsDir}`);
    for (const tenant of tenants) {
      assert.ok(
        fs.existsSync(tenant.rootCertPath),
        `root certificate missing for tenant "${tenant.slug}": ${tenant.rootCertPath}`,
      );
      assert.ok(
        fs.existsSync(tenant.certPath),
        `leaf certificate missing for tenant "${tenant.slug}": ${tenant.certPath}`,
      );
    }
  });

  it("resolves an explicit ?tenant= selector", () => {
    const tenants = listSigningTenants();
    if (tenants.length === 0) return;

    const wanted = tenants[0];
    assert.equal(
      resolveTenantForRequest({ query: { tenant: wanted.slug } })?.slug,
      wanted.slug,
      "explicit ?tenant= must win over the legacy fallback",
    );
    assert.equal(resolveTenantForRequest({ query: { tenant: "not-a-tenant" } }), null);
  });

  it("resolves a tenant from the caller Origin (shared bridge, several tenants)", () => {
    const tenants = listSigningTenants();
    if (tenants.length === 0) return;

    const wanted = tenants[0];
    const host = wanted.domains[0];
    if (!host) return;
    assert.equal(
      resolveTenantForRequest({ headers: { origin: `https://${host}` } })?.slug,
      wanted.slug,
    );
    // A loopback caller announces no tenant domain.
    assert.equal(resolveTenantForRequest({ headers: { origin: "http://127.0.0.1:11900" } }), null);
  });

  it("keeps the legacy fallback for callers that announce no tenant", () => {
    assert.equal(resolveTenantForRequest({ headers: { host: "127.0.0.1:11905" } }), null);
    assert.equal(resolveTenantForRequest({ headers: { host: "65.108.42.45" } }), null);
    assert.equal(resolveTenantForRequest(), null);
  });
});
