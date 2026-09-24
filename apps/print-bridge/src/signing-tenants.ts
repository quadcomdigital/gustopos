/**
 * Per-tenant QZ signing material for the print-bridge.
 *
 * The print-bridge is a local, single-machine process, so unlike the API it
 * cannot rely on the request Host to know which tenant it serves (its pages
 * are opened from 127.0.0.1). Resolution order:
 *
 *   1. `PRINT_BRIDGE_TENANT` — slug of the tenant this bridge belongs to
 *      (set it in ecosystem.config.cjs for every tenant deployment);
 *   2. the `Origin`/`Host` of the caller, matched against `meta.json`
 *      `domains[]` — covers browsers opened from a tenant domain;
 *   3. null → the legacy shared certificate (pre-tenant installs keep working).
 *
 * This mirrors `apps/api/src/security/signing-tenants.ts`; the two cannot be
 * shared because the API must not compile print-bridge sources and the bridge
 * must not depend on the API. Keep the `meta.json` contract identical:
 * `{ slug, cn, domains[], root.fingerprintSha1, leaf.fingerprintSha1, … }`.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface TenantSigningMaterial {
  slug: string;
  cn: string;
  domains: string[];
  rootCertPath: string;
  certPath: string;
  keyPath: string;
  rootFingerprintSha1: string;
  leafFingerprintSha1: string;
}

interface TenantMeta {
  slug?: string;
  cn?: string;
  domains?: string[];
  root?: { fingerprintSha1?: string };
  leaf?: { fingerprintSha1?: string };
}

const CACHE_TTL_MS = 5_000;
let cache: { at: number; tenants: TenantSigningMaterial[] } | null = null;

export function clearSigningTenantCache(): void {
  cache = null;
}

/** `apps/print-bridge/certs` from `src/` (tests) and `dist/` (production). */
export function signingCertsDir(): string {
  const override = process.env.QZ_CERTS_DIR?.trim();
  if (override) return override;
  return path.resolve(__dirname, "..", "..", "certs");
}

function loadTenants(): TenantSigningMaterial[] {
  const tenantsDir = path.join(signingCertsDir(), "tenants");
  if (!fs.existsSync(tenantsDir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(tenantsDir);
  } catch {
    return [];
  }

  const tenants: TenantSigningMaterial[] = [];
  for (const entry of entries.sort()) {
    const dir = path.join(tenantsDir, entry);
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    let meta: TenantMeta;
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf-8")) as TenantMeta;
    } catch {
      continue;
    }
    tenants.push({
      slug: meta.slug || entry,
      cn: meta.cn || "",
      domains: (meta.domains || []).map((domain) => domain.toLowerCase()),
      rootCertPath: path.join(dir, "ca-cert.pem"),
      certPath: path.join(dir, "digital-certificate.pem"),
      keyPath: path.join(dir, "private-key.pem"),
      rootFingerprintSha1: meta.root?.fingerprintSha1 || "",
      leafFingerprintSha1: meta.leaf?.fingerprintSha1 || "",
    });
  }
  return tenants;
}

export function listSigningTenants(): TenantSigningMaterial[] {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.tenants;
  const tenants = loadTenants();
  cache = { at: now, tenants };
  return tenants;
}

export function resolveTenantBySlug(slug: string): TenantSigningMaterial | null {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return null;
  return listSigningTenants().find((tenant) => tenant.slug === wanted) ?? null;
}

function normalizeHost(host: string | undefined | null): string {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function resolveTenantByHost(host: string | undefined | null): TenantSigningMaterial | null {
  const normalized = normalizeHost(host);
  if (!normalized || normalized === "localhost" || normalized === "127.0.0.1") return null;
  const tenants = listSigningTenants();
  const exact = tenants.find((tenant) => tenant.domains.includes(normalized));
  if (exact) return exact;
  const label = normalized.split(".")[0];
  if (label && label !== "www" && label !== "test") {
    return tenants.find((tenant) => tenant.slug === label) ?? null;
  }
  return null;
}

/** Strip the scheme and port of an `Origin` header (`https://a.b:443` → `a.b`). */
function originToHost(origin: string | undefined | null): string {
  return normalizeHost(String(origin || "").replace(/^[a-z]+:\/\//i, ""));
}

/**
 * Resolve the tenant for one request. See the module header for the order.
 * `null` means "use the legacy shared certificate".
 */
export function resolveTenantForRequest(req?: {
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
}): TenantSigningMaterial | null {
  const header = (name: string): string | undefined => {
    const value = req?.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const explicit = req?.query?.tenant;
  if (typeof explicit === "string" && explicit.trim()) {
    const bySlug = resolveTenantBySlug(explicit);
    if (bySlug) return bySlug;
  }

  const configured = process.env.PRINT_BRIDGE_TENANT?.trim();
  if (configured) {
    const byEnv = resolveTenantBySlug(configured);
    if (byEnv) return byEnv;
  }

  const fromOrigin = resolveTenantByHost(originToHost(header("origin")));
  if (fromOrigin) return fromOrigin;

  return resolveTenantByHost(header("host"));
}

/** Public origin a tenant is served from (used to redirect installer links). */
export function tenantOrigin(tenant: TenantSigningMaterial): string | null {
  const host = tenant.domains.find((domain) => domain.startsWith("test.")) ?? tenant.domains[0];
  return host ? `https://${host}` : null;
}
