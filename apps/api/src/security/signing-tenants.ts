/**
 * Tenant resolution for the QZ Tray signing material.
 *
 * Every tenant owns `apps/print-bridge/certs/tenants/<slug>/` with its own
 * root (installed as that tenant's QZ `override.crt`) and its own leaf
 * (served as `/signing/digital-certificate.txt` and used to sign). Two
 * invariants must hold or QZ Tray rejects the connection:
 *
 *   1. the certificate a machine is given and the key used to sign must be
 *      the same pair — so BOTH the serve path and the sign path resolve the
 *      tenant the same way (by request host, `meta.json` domains);
 *   2. a host that matches no tenant falls back to the legacy shared pair so
 *      existing installs keep working during the migration.
 *
 * Resolution order for `resolveSigningMaterial(req)`:
 *   1. `?tenant=<slug>` (installers/diagnostics, explicit);
 *   2. request host → `meta.json` `domains[]` (exact match);
 *   3. request host label → tenant slug (`casale.example.it` → `casale`);
 *   4. null → the caller serves the legacy shared certificate.
 *
 * The private key never leaves this module's caller: only `keyPath` is read,
 * by the signing endpoint.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export interface TenantSigningMaterial {
  /** `tenants.slug` — directory name, also the `?tenant=` selector. */
  slug: string;
  /** CN shown in the QZ Tray access dialog. */
  cn: string;
  /** Hosts this tenant is served from (`meta.json` domains). */
  domains: string[];
  /** Root CA → served as QZ Tray's `override.crt`. */
  rootCertPath: string;
  /** Root private key (never served). */
  rootKeyPath: string;
  /** Leaf certificate → `/signing/digital-certificate.txt`. */
  certPath: string;
  /** Leaf private key → used by the signing endpoint (never served). */
  keyPath: string;
  /** SHA-1 fingerprints from `meta.json` (uppercase, no colons). */
  rootFingerprintSha1: string;
  leafFingerprintSha1: string;
  leafNotBefore: string;
  leafNotAfter: string;
}

interface TenantMeta {
  slug?: string;
  cn?: string;
  domains?: string[];
  root?: { fingerprintSha1?: string };
  leaf?: { fingerprintSha1?: string; notBefore?: string; notAfter?: string };
}

const CACHE_TTL_MS = 5_000;
let cache: { at: number; tenants: TenantSigningMaterial[] } | null = null;

/** Clear the memoised tenant list (tests, and after a PKI rotation). */
export function clearSigningTenantCache(): void {
  cache = null;
}

/**
 * Locate `apps/print-bridge/certs` from either `src/` (tests) or `dist/`
 * (production) by walking up until the directory exists. `QZ_CERTS_DIR`
 * overrides it for deployments that keep the PKI elsewhere.
 */
export function signingCertsDir(): string {
  const override = process.env.QZ_CERTS_DIR?.trim();
  if (override) return override;

  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, "print-bridge", "certs");
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to the layout used by the API bootstrap (apps/api/dist → apps/).
  return join(__dirname, "..", "..", "..", "print-bridge", "certs");
}

function readMeta(metaPath: string): TenantMeta | null {
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8")) as TenantMeta;
  } catch {
    return null;
  }
}

function loadTenants(): TenantSigningMaterial[] {
  const tenantsDir = join(signingCertsDir(), "tenants");
  if (!existsSync(tenantsDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(tenantsDir);
  } catch {
    return [];
  }

  const tenants: TenantSigningMaterial[] = [];
  for (const entry of entries.sort()) {
    const dir = join(tenantsDir, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const meta = readMeta(join(dir, "meta.json"));
    if (!meta) continue;

    tenants.push({
      slug: meta.slug || entry,
      cn: meta.cn || "",
      domains: (meta.domains || []).map((domain) => domain.toLowerCase()),
      rootCertPath: join(dir, "ca-cert.pem"),
      rootKeyPath: join(dir, "ca-key.pem"),
      certPath: join(dir, "digital-certificate.pem"),
      keyPath: join(dir, "private-key.pem"),
      rootFingerprintSha1: meta.root?.fingerprintSha1 || "",
      leafFingerprintSha1: meta.leaf?.fingerprintSha1 || "",
      leafNotBefore: meta.leaf?.notBefore || "",
      leafNotAfter: meta.leaf?.notAfter || "",
    });
  }
  return tenants;
}

/** All tenants that have PKI material on disk (memoised for 5s). */
export function listSigningTenants(): TenantSigningMaterial[] {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.tenants;
  const tenants = loadTenants();
  cache = { at: now, tenants };
  return tenants;
}

/** `casale.example.it` → `casale`; strips the port and lowercases. */
function normalizeHost(host: string | undefined | null): string {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function resolveTenantBySlug(slug: string): TenantSigningMaterial | null {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return null;
  return listSigningTenants().find((tenant) => tenant.slug === wanted) ?? null;
}

/** Match a request host against every tenant's declared domains. */
export function resolveTenantByHost(host: string | undefined | null): TenantSigningMaterial | null {
  const normalized = normalizeHost(host);
  if (!normalized || normalized === "localhost" || normalized === "127.0.0.1") return null;

  const tenants = listSigningTenants();
  const exact = tenants.find((tenant) => tenant.domains.includes(normalized));
  if (exact) return exact;

  // Fallback: a host whose first label is a known slug (`casale.example.it`).
  const label = normalized.split(".")[0];
  if (label && label !== "www" && label !== "test") {
    const byLabel = tenants.find((tenant) => tenant.slug === label);
    if (byLabel) return byLabel;
  }
  return null;
}

interface SigningMaterialRequest {
  headers: { host?: string | string[]; [key: string]: unknown };
  query?: { tenant?: unknown; [key: string]: unknown };
}

/**
 * Pick the tenant's signing material for a request, or `null` when the host
 * is unknown (legacy shared pair). Used by BOTH the certificate/CA routes and
 * the signing endpoint so the served certificate and the signing key always
 * belong to the same tenant.
 */
export function resolveSigningMaterial(req: SigningMaterialRequest): TenantSigningMaterial | null {
  const requested = req.query?.tenant;
  if (typeof requested === "string" && requested.trim()) {
    const bySlug = resolveTenantBySlug(requested);
    if (bySlug) return bySlug;
  }

  const header = Array.isArray(req.headers?.host) ? req.headers.host[0] : req.headers?.host;
  return resolveTenantByHost(header);
}

/** True when the given absolute path sits inside the tenant PKI tree. */
export function isTenantKeyPath(path: string): boolean {
  return isAbsolute(path) && /[\\/]certs[\\/]tenants[\\/]/.test(path);
}
