/**
 * Per-tenant QZ signing material: host → tenant resolution.
 *
 * The invariant under test: the certificate served for a host and the key used
 * to sign for that host are chosen by the SAME resolver, so a mismatch would
 * make QZ Tray reject every signature ("Bad signature on request").
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  clearSigningTenantCache,
  listSigningTenants,
  resolveSigningMaterial,
  resolveTenantByHost,
  resolveTenantBySlug,
} from "./signing-tenants";

const REPO_CERTS_DIR = join(__dirname, "..", "..", "..", "print-bridge", "certs");
const previousCertsDir = process.env.QZ_CERTS_DIR;

// Fixture: one tenant, built from the committed public certificates plus a
// placeholder key (private keys are gitignored, so a fresh checkout has none).
const fixtureDir = mkdtempSync(join(tmpdir(), "gustopos-signing-tenants-"));
const tenantDir = join(fixtureDir, "tenants", "acme");
mkdirSync(tenantDir, { recursive: true });
copyFileSync(join(REPO_CERTS_DIR, "ca-cert.pem"), join(tenantDir, "ca-cert.pem"));
copyFileSync(join(REPO_CERTS_DIR, "digital-certificate.pem"), join(tenantDir, "digital-certificate.pem"));
writeFileSync(join(tenantDir, "private-key.pem"), "dummy-key-not-a-real-key");
writeFileSync(
  join(tenantDir, "meta.json"),
  JSON.stringify({
    slug: "acme",
    cn: "GustoPOS acme",
    domains: ["test.acme.example", "acme.example"],
    root: { fingerprintSha1: "ROOTACME" },
    leaf: { fingerprintSha1: "LEAFACME" },
  }),
);

process.env.QZ_CERTS_DIR = fixtureDir;
clearSigningTenantCache();

after(() => {
  if (previousCertsDir === undefined) delete process.env.QZ_CERTS_DIR;
  else process.env.QZ_CERTS_DIR = previousCertsDir;
  clearSigningTenantCache();
  rmSync(fixtureDir, { recursive: true, force: true });
});

test("lists the tenant PKI found on disk", () => {
  const tenants = listSigningTenants();
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].slug, "acme");
  assert.deepEqual(tenants[0].domains, ["test.acme.example", "acme.example"]);
  assert.ok(tenants[0].certPath.endsWith(join("tenants", "acme", "digital-certificate.pem")));
  assert.equal(tenants[0].rootCertPath, join(tenantDir, "ca-cert.pem"));
  assert.equal(tenants[0].keyPath, join(tenantDir, "private-key.pem"));
});

test("resolves a tenant from its declared domain", () => {
  assert.equal(resolveTenantByHost("test.acme.example")?.slug, "acme");
  assert.equal(resolveTenantByHost("ACME.example:443")?.slug, "acme");
});

test("does not resolve loopback or unknown hosts (legacy pair instead)", () => {
  assert.equal(resolveTenantByHost("127.0.0.1:11900"), null);
  assert.equal(resolveTenantByHost("localhost"), null);
  assert.equal(resolveTenantByHost("unknown.example"), null);
  assert.equal(resolveTenantByHost(undefined), null);
});

test("resolves by host label only for a real tenant slug", () => {
  assert.equal(resolveTenantByHost("acme.example")?.slug, "acme");
  // `test.` is the shared staging prefix of every tenant — never a slug match.
  assert.equal(resolveTenantByHost("test.other.example"), null);
});

test("resolveSigningMaterial prefers ?tenant= then the host", () => {
  const byHost = resolveSigningMaterial({ headers: { host: "test.acme.example" } });
  assert.equal(byHost?.slug, "acme");

  const byQuery = resolveSigningMaterial({
    headers: { host: "127.0.0.1" },
    query: { tenant: "acme" },
  });
  assert.equal(byQuery?.slug, "acme");

  const unknown = resolveSigningMaterial({
    headers: { host: "unknown.example" },
    query: { tenant: "nope" },
  });
  assert.equal(unknown, null, "an unknown tenant falls back to the legacy pair");
});

test("the served certificate and the signing key come from the same tenant", () => {
  const material = resolveSigningMaterial({ headers: { host: "test.acme.example" } });
  assert.ok(material);
  assert.ok(material.certPath.includes(join("tenants", "acme")));
  assert.ok(material.keyPath.includes(join("tenants", "acme")));
  assert.notEqual(material.certPath, material.keyPath);
  assert.equal(material.leafFingerprintSha1, "LEAFACME");
  assert.equal(material.rootFingerprintSha1, "ROOTACME");
});

test("resolveTenantBySlug finds the tenant directory", () => {
  assert.equal(resolveTenantBySlug("acme")?.slug, "acme");
  assert.equal(resolveTenantBySlug("  ACME ")?.slug, "acme");
  assert.equal(resolveTenantBySlug("missing"), null);
  assert.equal(resolveTenantBySlug(""), null);
});
