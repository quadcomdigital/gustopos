import express from "express";
import { createServer } from "node:http";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { resolveTenantForRequest, tenantOrigin } from "./signing-tenants";

const app = express();

// Installer/diagnostics links on the print-station page point at this local
// bridge. The scripts themselves are rendered by the API from the tenant's
// origin (with that tenant's current certificate fingerprints), so redirect
// instead of shipping a copy that goes stale the moment the certificate
// rotates — a stale script whitelists a fingerprint the server no longer
// serves, which is exactly what made QZ Tray reject the certificate on site.
const SIGNING_INSTALLER_FILES = [
  "install-qz-cert.bat",
  "install-qz-cert.ps1",
  "install-qz-cert.sh",
  "debug-qz-cert.bat",
  "debug-qz-cert.ps1",
] as const;

for (const installerFile of SIGNING_INSTALLER_FILES) {
  app.get(`/${installerFile}`, (req, res) => {
    const tenant = resolveTenantForRequest(req);
    const origin =
      (tenant ? tenantOrigin(tenant) : null) || process.env.PRINT_BRIDGE_ORIGIN?.trim().replace(/\/$/, "");
    if (!origin) {
      res
        .status(404)
        .type("text/plain")
        .send(
          `This bridge does not know which tenant it serves. Set PRINT_BRIDGE_TENANT=<slug> ` +
            `(or PRINT_BRIDGE_ORIGIN=https://tenant-domain) in the environment, or open ` +
            `https://<tenant-domain>/signing/${installerFile} directly.`,
        );
      return;
    }
    res.redirect(302, `${origin}/signing/${installerFile}`);
  });
}

// Serve static files (print-station.html, qz-tray.js) from public/
app.use(express.static(path.join(__dirname, "..", "public")));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.url} ${res.statusCode} ${elapsed}ms`);
  });
  next();
});

app.use(express.json({ limit: "2mb" }));

const port = Number(process.env.PRINT_BRIDGE_PORT ?? 11905);
const DEFAULT_SPOOL_DIR = "/var/spool/gustopos-print";
const FALLBACK_SPOOL_DIR = path.resolve(process.cwd(), "spool");

function ensureSpoolDirSync(preferred: string, fallback: string): string {
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    // eslint-disable-next-line no-console
    console.warn(
      `[print-bridge] Cannot use spool directory "${preferred}" (permission denied or unavailable). Falling back to "${fallback}".`,
    );
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const spoolDir = ensureSpoolDirSync(
  process.env.PRINT_BRIDGE_SPOOL_DIR ?? DEFAULT_SPOOL_DIR,
  FALLBACK_SPOOL_DIR,
);
const printBridgeSecret = process.env.PRINT_BRIDGE_SECRET?.trim();

// ─── Print-bridge tenant ID (multi-tenant support) ───────────────────────────
// When using the legacy env-var auth (PRINT_BRIDGE_SECRET), the API needs to know
// which tenant this bridge belongs to. If PRINT_BRIDGE_TENANT_ID is not set,
// the API falls back to DEFAULT_TENANT_ID / "tenant_legacy".
// Bridges onboarded via the onboarding-secret flow already resolve the tenant
// automatically and do not need this variable.
const BRIDGE_TENANT_ID = process.env.PRINT_BRIDGE_TENANT_ID?.trim() || '';

// ─── Print-bridge lifecycle (client side) ────────────────────────────────────

const API_URL = (process.env.API_URL ?? '').replace(/\/$/, '');
const BRIDGE_ID = process.env.PRINT_BRIDGE_ID ?? `bridge_${process.env.PRINT_BRIDGE_HOSTNAME ?? require('os').hostname()}`;
const BRIDGE_NAME = process.env.PRINT_BRIDGE_NAME ?? BRIDGE_ID;
const BRIDGE_AREAS = (process.env.PRINT_BRIDGE_AREAS ?? 'kitchen,bar,cashier')
  .split(',').map((a) => a.trim()).filter((a): a is 'kitchen' | 'bar' | 'cashier' => a === 'kitchen' || a === 'bar' || a === 'cashier');
const BRIDGE_PRINTERS = (() => {
  try {
    const raw = process.env.PRINT_BRIDGE_PRINTERS;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
})();
const HEARTBEAT_INTERVAL_MS = Number(process.env.PRINT_BRIDGE_HEARTBEAT_MS ?? 30_000);
const CLAIM_INTERVAL_MS = Number(process.env.PRINT_BRIDGE_CLAIM_MS ?? 3_000);
const CLAIM_BATCH_SIZE = Number(process.env.PRINT_BRIDGE_CLAIM_BATCH ?? 10);

async function bridgeApi(pathname: string, init?: RequestInit): Promise<any> {
  const url = `${API_URL}${pathname}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (printBridgeSecret) {
    headers['X-Print-Bridge-Key'] = printBridgeSecret;
  }
  if (BRIDGE_TENANT_ID) {
    headers['X-Bridge-Tenant-Id'] = BRIDGE_TENANT_ID;
  }
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === 'object' && body && 'message' in body ? body.message : `HTTP ${res.status}`;
    throw new Error(`bridgeApi ${pathname} failed: ${msg}`);
  }
  return body;
}

const BRIDGE_HOSTNAME = require('os').hostname();

async function sendHeartbeat(): Promise<void> {
  try {
    const host = BRIDGE_HOSTNAME;
    await bridgeApi('/api/print-bridge/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        bridgeId: BRIDGE_ID,
        name: BRIDGE_NAME,
        host,
        areas: BRIDGE_AREAS,
        printers: BRIDGE_PRINTERS,
      }),
    });
    console.log(`[print-bridge] heartbeat ok (bridge=${BRIDGE_ID}, areas=${BRIDGE_AREAS.join(',')})`);
  } catch (err) {
    console.warn(`[print-bridge] heartbeat failed: ${(err as Error).message}`);
  }
}

async function drivePrinterJob(job: { id: string; orderId: string; area: string; protocol: string; payload: string }): Promise<boolean> {
  // Push to connected agents (Electron app on POS machines).
  // Returns true if at least one agent received the job.
  if (broadcastToAgents(job)) {
    console.log(`[print-bridge] pushed job ${job.id} to agent(s)`);
    return true;
  }

  // No agent connected — fall back to spool.
  const safeArea = job.area.replace(/[^a-z0-9_-]/gi, '_');
  const fileName = `${Date.now()}_${safeArea}_${job.id}.escpos`;
  const filePath = path.resolve(spoolDir, safeArea, fileName);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, Buffer.from(job.payload, 'base64'));
  console.log(`[print-bridge] spooled job ${job.id} → ${filePath}`);
  return false;
}

async function claimAndProcess(): Promise<void> {
  let jobs: Array<{ id: string; orderId: string; area: string; protocol: string; payload: string }>;
  try {
    const res = await bridgeApi('/api/print-bridge/claim', {
      method: 'POST',
      body: JSON.stringify({ bridgeId: BRIDGE_ID, limit: CLAIM_BATCH_SIZE }),
    });
    jobs = res?.jobs ?? [];
  } catch (err) {
    console.warn(`[print-bridge] claim failed: ${(err as Error).message}`);
    return;
  }
  for (const job of jobs) {
    try {
      const pushed = await drivePrinterJob(job);
      // If pushed to an agent, the agent will confirm completion via job_done message.
      // If spooled to disk, mark complete immediately.
      if (!pushed) {
        await bridgeApi(`/api/print-bridge/jobs/${job.id}/complete`, {
          method: 'POST',
          body: JSON.stringify({ bridgeId: BRIDGE_ID }),
        });
      }
    } catch (err) {
      const msg = (err as Error).message ?? 'drive failed';
      console.error(`[print-bridge] job ${job.id} failed: ${msg}`);
      try {
        await bridgeApi(`/api/print-bridge/jobs/${job.id}/fail`, {
          method: 'POST',
          body: JSON.stringify({ bridgeId: BRIDGE_ID, error: msg }),
        });
      } catch (reportErr) {
        console.error(`[print-bridge] failed to report error for ${job.id}: ${(reportErr as Error).message}`);
      }
    }
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let claimTimer: ReturnType<typeof setInterval> | null = null;

// ─── WebSocket agent connections ─────────────────────────────────────────
// Agents (Electron app on POS machines) connect here to receive print jobs
// pushed from the bridge. Each agent authenticates with the shared bridge secret.
const agents = new Map<string, { ws: WebSocket; bridgeId: string }>();

function broadcastToAgents(job: { id: string; orderId: string; area: string; protocol: string; payload: string }): boolean {
  let pushed = false;
  agents.forEach((agent) => {
    if (agent.ws.readyState === WebSocket.OPEN) {
      agent.ws.send(JSON.stringify({ type: "job", ...job }));
      pushed = true;
    }
  });
  return pushed;
}

function startBridgeLifecycle(): void {
  if (!API_URL) {
    console.log('[print-bridge] API_URL not set; skipping bridge lifecycle (signing endpoints still active)');
    return;
  }
  if (!printBridgeSecret) {
    console.warn('[print-bridge] PRINT_BRIDGE_SECRET not set; bridge lifecycle requires it to authenticate against the API. Skipping.');
    return;
  }
  if (BRIDGE_AREAS.length === 0) {
    console.log('[print-bridge] PRINT_BRIDGE_AREAS empty; skipping bridge lifecycle');
    return;
  }
  console.log(`[print-bridge] starting lifecycle as bridge=${BRIDGE_ID} tenant=${BRIDGE_TENANT_ID || '(not set)'} areas=${BRIDGE_AREAS.join(',')}`);
  void sendHeartbeat();
  void claimAndProcess();
  heartbeatTimer = setInterval(() => { void sendHeartbeat(); }, HEARTBEAT_INTERVAL_MS);
  claimTimer = setInterval(() => { void claimAndProcess(); }, CLAIM_INTERVAL_MS);
}

function stopBridgeLifecycle(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (claimTimer) clearInterval(claimTimer);
  heartbeatTimer = null;
  claimTimer = null;
}


type PrintRequest = {
  id: string;
  orderId: string;
  area: string;
  protocol: string;
  payload: string; // base64-encoded ESC/POS binary data
};

// CORS headers for /print endpoint (localhost-only, so * is safe)
function setCorsHeaders(res: express.Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Print-Bridge-Key");
}

// Shared secret authentication middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!printBridgeSecret) {
    // Dev mode: no secret set, allow all
    next();
    return;
  }

  const providedKey = req.headers["x-print-bridge-key"];
  if (!providedKey || providedKey !== printBridgeSecret) {
    res.status(401).json({ error: "Unauthorized: invalid or missing X-Print-Bridge-Key" });
    return;
  }
  next();
}

// ─── QZ Tray signing endpoint hardening ──────────────────────────────────
// The POS browser signs QZ requests through this loopback bridge. Browsers
// always send the Origin header on cross-origin requests, so the signing
// endpoint only answers pages whose origin is explicitly allowlisted. This
// stops any other website or local process from using the bridge as an
// arbitrary signing oracle. Override per deployment with
// PRINT_BRIDGE_ALLOWED_ORIGINS (comma-separated origins).
const PRINT_BRIDGE_ALLOWED_ORIGINS = (process.env.PRINT_BRIDGE_ALLOWED_ORIGINS ?? [
  "http://localhost:11900",
  "http://127.0.0.1:11900",
  // Defaults mirror the API's committed CORS_ORIGIN for the test.franksbar.it
  // stack; deployments on other origins must set PRINT_BRIDGE_ALLOWED_ORIGINS.
  "https://test.franksbar.it",
  "http://65.108.42.45:11900",
  "http://65.108.42.45:80",
].join(",")).split(",").map((origin) => origin.trim()).filter(Boolean);

function isAllowedOrigin(origin: string | undefined): boolean {
  return Boolean(origin && PRINT_BRIDGE_ALLOWED_ORIGINS.includes(origin));
}

// Diagnostic endpoints (openssl chain checks, allowed.dat helpers) are handy
// during setup but expose filesystem paths and shell out to openssl. Enable
// them explicitly in production with PRINT_BRIDGE_DEBUG_ENDPOINTS=true.
const PRINT_BRIDGE_DEBUG_ENDPOINTS = process.env.PRINT_BRIDGE_DEBUG_ENDPOINTS === "true";
const DEBUG_SIGNING_ROUTES = [
  "/signing/debug",
  "/signing/verify-test",
  "/signing/whitelist-entry",
  "/signing/whitelist-entry.txt",
];

// QZ Tray signing endpoints
// CORS: the POS browser (BridgeWorker) fetches the certificate + signs
// messages cross-origin from the API origin to this local print-bridge.
// ACAO is set per-route and never "*" for signing (see sign-message below).
app.use("/signing", (req, res, next) => {
  // req.path is relative to the mount ("debug") — compare against the full
  // original URL so the debug-route gate matches the registered routes.
  const fullPath = req.originalUrl.split("?")[0];
  if (!PRINT_BRIDGE_DEBUG_ENDPOINTS && DEBUG_SIGNING_ROUTES.includes(fullPath)) {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const CERTS_DIR = path.resolve(__dirname, "..", "certs");
// Legacy (pre-tenant) material. Per-tenant material lives in
// certs/tenants/<slug>/ and wins whenever the request resolves a tenant.
const PRIVATE_KEY_PATH = path.join(CERTS_DIR, "private-key.pem");
const CERT_PATH = path.join(CERTS_DIR, "digital-certificate.pem");
const CA_CERT_PATH = path.join(CERTS_DIR, "ca-cert.pem");

interface CertBundle {
  cert: string;
  key: string;
  caCert: string;
  mtimeMs: number;
}

// Cache per certificate path: a bridge can serve several tenants, and a
// rotation for one of them must not invalidate (or overwrite) another's.
const certCache = new Map<string, CertBundle>();

function readBundle(certPath: string, keyPath: string, caCertPath: string): CertBundle {
  const cached = certCache.get(certPath);
  const mtimeMs = fs.statSync(certPath).mtimeMs;
  if (cached && cached.mtimeMs === mtimeMs) return cached;

  const bundle: CertBundle = {
    cert: fs.readFileSync(certPath, "utf-8"),
    key: fs.readFileSync(keyPath, "utf-8"),
    caCert: fs.readFileSync(caCertPath, "utf-8"),
    mtimeMs,
  };
  certCache.set(certPath, bundle);
  console.log(`[print-bridge] Reloaded cert/key from disk (${certPath})`);
  return bundle;
}

type SigningRequest = Parameters<typeof resolveTenantForRequest>[0];

/**
 * Signing material for this request: per-tenant first (signing-tenants.ts),
 * legacy shared pair as fallback. The certificate, its key and the CA always
 * come from the same source — mixing tenants would make QZ Tray log
 * "Bad signature on request" and show the access dialog.
 */
function getCerts(req?: SigningRequest) {
  const tenant = resolveTenantForRequest(req);
  try {
    const bundle = readBundle(
      tenant ? tenant.certPath : CERT_PATH,
      tenant ? tenant.keyPath : PRIVATE_KEY_PATH,
      tenant ? tenant.rootCertPath : CA_CERT_PATH,
    );
    return { cert: bundle.cert, key: bundle.key, caCert: bundle.caCert, tenant };
  } catch (err) {
    console.error("[print-bridge] Failed to load certs:", err);
    throw err;
  }
}

// Serve the private key (authenticated — only the agent should have this)
app.get("/signing/private-key.pem", authMiddleware, (req, res) => {
  try {
    const { key } = getCerts(req);
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(key);
  } catch {
    res.status(500).send("Private key not found");
  }
});

// Serve the public certificate (public material — readable cross-origin)
app.get("/signing/digital-certificate.txt", (req, res) => {
  try {
    const { cert } = getCerts(req);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(cert);
  } catch {
    res.status(500).send("Certificate not found");
  }
});

// Sign a SHA-256 hex digest of the canonical request (SHA512-RSA). Only
// browsers may obtain signatures: cross-origin pages must present an
// allowlisted Origin, and same-origin pages (the legacy print-station.html
// served by this bridge) are recognised by their Sec-Fetch-Site header.
// Requests without an Origin and without a browser Sec-Fetch-Site header are
// local processes/scripts — never sign for them. The digest format check
// prevents the bridge from ever being an arbitrary signer.
app.get("/signing/sign-message", (req, res) => {
  const origin = req.headers.origin;
  const secFetchSite = req.headers["sec-fetch-site"];
  const isBrowserSameOrigin =
    !origin &&
    (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none");
  if (!isAllowedOrigin(origin) && !isBrowserSameOrigin) {
    // A foreign/absent Origin with no browser Sec-Fetch-Site means a local
    // process, script or malicious page — never sign for it.
    res.status(403).send("Forbidden: origin not allowed");
    return;
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin as string);
  }

  const request = req.query.request;
  // QZ Tray sends the lowercase SHA-256 hex digest of its canonical request.
  if (typeof request !== "string" || !/^[a-f0-9]{64}$/.test(request)) {
    res.status(400).send("Missing or invalid request parameter");
    return;
  }

  try {
    const { key } = getCerts(req);
    const sign = crypto.createSign("SHA512");
    sign.update(request);
    const signature = sign.sign(key, "base64");
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(signature);
  } catch (err) {
    console.error("[print-bridge] Signing error:", err);
    res.status(500).send("Signing failed");
  }
});

// Serve the root CA certificate for download (for QZ Tray override.crt)
app.get("/signing/override.crt", (req, res) => {
  try {
    const { caCert } = getCerts(req);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/x-x509-ca-cert");
    res.setHeader("Content-Disposition", "attachment; filename=override.crt");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(caCert);
  } catch {
    res.status(500).send("Certificate not found");
  }
});

// Debug endpoint: validate the certificate chain and return diagnostic info
app.get("/signing/debug", (req, res) => {
  try {
    const { cert, caCert } = getCerts(req);
    const { execSync } = require("node:child_process");

    // Parse the leaf cert
    const leafInfo = execSync(
      `echo '${cert.replace(/\n/g, '\\n')}' | openssl x509 -noout -subject -issuer -dates -ext subjectAltName -serial 2>&1`,
      { encoding: "utf-8" },
    );

    // Parse the CA cert
    const caInfo = execSync(
      `echo '${caCert.replace(/\n/g, '\\n')}' | openssl x509 -noout -subject -issuer -dates -ext basicConstraints -serial 2>&1`,
      { encoding: "utf-8" },
    );

    // Verify chain
    let chainResult = "N/A";
    try {
      const tmpLeaf = "/tmp/gustopos-leaf.pem";
      const tmpCa = "/tmp/gustopos-ca.pem";
      fs.writeFileSync(tmpLeaf, cert);
      fs.writeFileSync(tmpCa, caCert);
      chainResult = execSync(`openssl verify -CAfile ${tmpCa} ${tmpLeaf} 2>&1`, { encoding: "utf-8" }).trim();
      fs.unlinkSync(tmpLeaf);
      fs.unlinkSync(tmpCa);
    } catch (e: any) {
      chainResult = `Verify failed: ${e.message}`;
    }

    // Check if private key matches the certificate
    let keyMatch = "N/A";
    try {
      const { key } = getCerts(req);
      const tmpKey = "/tmp/gustopos-key.pem";
      const tmpCert2 = "/tmp/gustopos-cert2.pem";
      fs.writeFileSync(tmpKey, key);
      fs.writeFileSync(tmpCert2, cert);
      const certMod = execSync(`openssl x509 -noout -modulus -in ${tmpCert2} 2>&1`, { encoding: "utf-8" }).trim();
      const keyMod = execSync(`openssl rsa -noout -modulus -in ${tmpKey} 2>&1`, { encoding: "utf-8" }).trim();
      keyMatch = certMod === keyMod ? "YES — private key matches certificate" : "NO — private key does NOT match certificate";
      fs.unlinkSync(tmpKey);
      fs.unlinkSync(tmpCert2);
    } catch (e: any) {
      keyMatch = `Check failed: ${e.message}`;
    }

    res.json({
      leafCertificate: leafInfo.trim(),
      caCertificate: caInfo.trim(),
      chainValidation: chainResult,
      privateKeyMatch: keyMatch,
      filesOnDisk: {
        certPath: CERT_PATH,
        keyPath: PRIVATE_KEY_PATH,
        caCertPath: CA_CERT_PATH,
        overrideCrtPath: path.join(CERTS_DIR, "override.crt"),
      },
      certExists: {
        leaf: fs.existsSync(CERT_PATH),
        key: fs.existsSync(PRIVATE_KEY_PATH),
        ca: fs.existsSync(CA_CERT_PATH),
        override: fs.existsSync(path.join(CERTS_DIR, "override.crt")),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verification test endpoint: simulates QZ Tray's exact verification flow
// QZ Tray Java code does: isSignatureValid(algorithm, signature, jsonString)
//   -> SHA256(jsonString) -> feeds to SHA512withRSA verifier -> verify
app.get("/signing/verify-test", (req, res) => {
  try {
    const { cert, key } = getCerts(req);

    // Simulate a typical QZ Tray call payload
    const testPayload = JSON.stringify({
      call: "printers.find",
      params: {},
      timestamp: Date.now(),
    });

    // Step 1: Sign like our server does (same as what qz-tray.js sends)
    // The JS library hashes with SHA-256 first, then sends the hash to us
    const dataHash = crypto.createHash("sha256").update(testPayload).digest("hex");
    const sign = crypto.createSign("SHA512");
    sign.update(dataHash);
    const signature = sign.sign(key, "base64");

    // Step 2: Verify like QZ Tray Java does
    // Java: DigestUtils.sha256Hex(data) -> feeds to SHA512withRSA verifier
    // The Java side receives the raw JSON string (not the hash), and hashes it itself
    const verifier = crypto.createVerify("SHA512");
    // Java does: verifier.update(SHA256(jsonString).getBytes())
    const javaHash = crypto.createHash("sha256").update(testPayload).digest("hex");
    verifier.update(javaHash);
    const verified = verifier.verify(cert, signature, "base64");

    // Step 3: Also test if we can verify with the raw data (no pre-hash)
    const verifier2 = crypto.createVerify("SHA512");
    verifier2.update(testPayload);
    const verifiedRaw = verifier2.verify(cert, signature, "base64");

    res.json({
      testPayload,
      dataHash,
      javaHash,
      signature: signature.substring(0, 40) + "...",
      hashesMatch: dataHash === javaHash,
      verifiedWithPreHash: verified,
      verifiedWithRawData: verifiedRaw,
      note: "QZ Tray Java hashes data with SHA-256 before feeding to SHA512withRSA verifier. verifiedWithPreHash should be true for correct signing.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Returns the exact line to add to QZ Tray's allowed.dat for whitelist pre-population
app.get("/signing/whitelist-entry", (req, res) => {
  try {
    const { execSync } = require("node:child_process");
    const { cert } = getCerts(req);

    // Write cert to temp file for openssl processing
    const tmpCert = "/tmp/gustopos-wl-cert.pem";
    fs.writeFileSync(tmpCert, cert);

    // Compute SHA-1 fingerprint (same algorithm QZ Tray uses)
    const fpRaw = execSync(`openssl x509 -in ${tmpCert} -noout -fingerprint -sha1`, { encoding: "utf-8" }).trim();
    const fingerprint = fpRaw.replace(/[Ss][Hh][Aa]1 Fingerprint=/, "").replace(/:/g, "");

    // Extract subject fields using separate openssl calls
    const subjectLine = execSync(`openssl x509 -in ${tmpCert} -noout -subject`, { encoding: "utf-8" }).trim();
    const startLine = execSync(`openssl x509 -in ${tmpCert} -noout -startdate`, { encoding: "utf-8" }).trim();
    const endLine = execSync(`openssl x509 -in ${tmpCert} -noout -enddate`, { encoding: "utf-8" }).trim();
    fs.unlinkSync(tmpCert);

    // Parse subject: "subject=C = IT, ST = Rome, O = GustoPOS, CN = GustoPOS"
    // (tenant-neutral leaf since 2026-09-24: same shared CA and key, so every
    // existing install keeps trusting it; only the displayed CN changed).
    const subjectParts = subjectLine.replace(/^subject\s*=\s*/, "").split(",").map((s: string) => s.trim());
    const cn = subjectParts.find((p: string) => p.startsWith("CN = "))?.replace("CN = ", "") || "";
    const org = subjectParts.find((p: string) => p.startsWith("O = "))?.replace("O = ", "") || "";
    const validFrom = startLine.replace("notBefore=", "");
    const validTo = endLine.replace("notAfter=", "");

    // Format as QZ Tray expects (tab-separated)
    const entry = `${fingerprint}\t${cn}\t${org}\t${validFrom}\t${validTo}\tTrue`;

    res.json({
      fingerprint,
      commonName: cn,
      organization: org,
      validFrom,
      validTo,
      entry,
      allowedDatLocations: {
        windows: "%APPDATA%\\qz\\allowed.dat",
        macos: "$HOME/Library/Application Support/qz/allowed.dat",
        linux: "$HOME/.qz/allowed.dat",
      },
      manualInstructions: `Add this line to allowed.dat:\n${entry}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Plain-text whitelist entry for installer scripts (actual tab characters)
app.get("/signing/whitelist-entry.txt", (req, res) => {
  try {
    const { execSync } = require("node:child_process");
    const { cert } = getCerts(req);

    const tmpCert = "/tmp/gustopos-wl-cert.pem";
    fs.writeFileSync(tmpCert, cert);

    const fpRaw = execSync(`openssl x509 -in ${tmpCert} -noout -fingerprint -sha1`, { encoding: "utf-8" }).trim();
    const fingerprint = fpRaw.replace(/[Ss][Hh][Aa]1 Fingerprint=/, "").replace(/:/g, "");

    const subjectLine = execSync(`openssl x509 -in ${tmpCert} -noout -subject`, { encoding: "utf-8" }).trim();
    const startLine = execSync(`openssl x509 -in ${tmpCert} -noout -startdate`, { encoding: "utf-8" }).trim();
    const endLine = execSync(`openssl x509 -in ${tmpCert} -noout -enddate`, { encoding: "utf-8" }).trim();
    fs.unlinkSync(tmpCert);

    const subjectParts = subjectLine.replace(/^subject\s*=\s*/, "").split(",").map((s: string) => s.trim());
    const cn = subjectParts.find((p: string) => p.startsWith("CN = "))?.replace("CN = ", "") || "";
    const org = subjectParts.find((p: string) => p.startsWith("O = "))?.replace("O = ", "") || "";
    const validFrom = startLine.replace("notBefore=", "");
    const validTo = endLine.replace("notAfter=", "");

    // Use actual tab characters (not \t escape)
    const entry = `${fingerprint}\t${cn}\t${org}\t${validFrom}\t${validTo}\tTrue`;
    res.setHeader("Content-Type", "text/plain");
    res.send(entry);
  } catch (err: any) {
    res.status(500).send("Error: " + err.message);
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true, port });
});

app.options("/print", (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(204);
});

app.post("/print", authMiddleware, async (req, res) => {
  setCorsHeaders(res);

  const body = req.body as Partial<PrintRequest>;
  if (!body.id || !body.orderId || !body.area || !body.protocol || !body.payload) {
    res.status(400).json({ error: "Missing required print job fields" });
    return;
  }

  const safeArea = body.area.replace(/[^a-z0-9_-]/gi, "_");
  const fileName = `${Date.now()}_${safeArea}_${body.id}.escpos`;
  const dir = path.resolve(spoolDir, safeArea);
  const filePath = path.resolve(dir, fileName);

  await fs.promises.mkdir(dir, { recursive: true });
  const buffer = Buffer.from(body.payload, "base64");
  await fs.promises.writeFile(filePath, buffer);

  res.json({ ok: true, filePath });
});

// Export app and helpers for testing
export { app, ensureSpoolDirSync, authMiddleware, setCorsHeaders };

// Only start server when run directly (not when imported by tests)
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require.main === module) {
  const server = createServer(app);

  // ─── WebSocket server for agent connections ──────────────────────────
  const wss = new WebSocketServer({ server, path: "/agent" });

  wss.on("connection", (ws) => {
    let agentBridgeId: string | null = null;

    ws.on("message", async (raw) => {
      let msg: { type: string; bridgeId?: string; secret?: string; id?: string; error?: string };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
        return;
      }

      switch (msg.type) {
        case "auth": {
          if (!printBridgeSecret || msg.secret !== printBridgeSecret) {
            ws.send(JSON.stringify({ type: "auth_error", error: "Invalid secret" }));
            ws.close();
            return;
          }
          agentBridgeId = msg.bridgeId ?? BRIDGE_ID;
          agents.set(agentBridgeId, { ws, bridgeId: agentBridgeId });
          console.log(`[print-bridge] agent connected: bridgeId=${agentBridgeId}`);
          ws.send(JSON.stringify({ type: "auth_ok" }));
          break;
        }
        case "job_done": {
          if (!agentBridgeId || !msg.id) break;
          console.log(`[print-bridge] agent confirmed job ${msg.id}`);
          try {
            await bridgeApi(`/api/print-bridge/jobs/${msg.id}/complete`, {
              method: "POST",
              body: JSON.stringify({ bridgeId: agentBridgeId }),
            });
            ws.send(JSON.stringify({ type: "job_done_ack", id: msg.id }));
          } catch (err) {
            console.error(`[print-bridge] failed to mark job ${msg.id} complete: ${(err as Error).message}`);
            ws.send(JSON.stringify({ type: "job_done_ack", id: msg.id, error: (err as Error).message }));
          }
          break;
        }
        case "job_failed": {
          if (!agentBridgeId || !msg.id) break;
          const errMsg = msg.error ?? "agent reported failure";
          console.error(`[print-bridge] agent reported job ${msg.id} failed: ${errMsg}`);
          try {
            await bridgeApi(`/api/print-bridge/jobs/${msg.id}/fail`, {
              method: "POST",
              body: JSON.stringify({ bridgeId: agentBridgeId, error: errMsg }),
            });
            ws.send(JSON.stringify({ type: "job_failed_ack", id: msg.id }));
          } catch (err) {
            console.error(`[print-bridge] failed to report failure for ${msg.id}: ${(err as Error).message}`);
            ws.send(JSON.stringify({ type: "job_failed_ack", id: msg.id, error: (err as Error).message }));
          }
          break;
        }
        default:
          console.warn(`[print-bridge] unknown agent message type: ${msg.type}`);
      }
    });

    ws.on("close", () => {
      if (agentBridgeId) {
        agents.delete(agentBridgeId);
        console.log(`[print-bridge] agent disconnected: bridgeId=${agentBridgeId}`);
      }
    });

    ws.on("error", (err) => {
      console.error(`[print-bridge] agent WebSocket error: ${err.message}`);
    });
  });

  const bindAddress = process.env.PRINT_BRIDGE_BIND ?? "127.0.0.1";

  startBridgeLifecycle();
  server.listen(port, bindAddress, () => {
    // eslint-disable-next-line no-console
    console.log(`[print-bridge] listening on ${bindAddress}:${port}`);
    console.log(`[print-bridge] agent WebSocket at ws://${bindAddress}:${port}/agent`);
    console.log(`[print-bridge] QZ signing allowlist: ${PRINT_BRIDGE_ALLOWED_ORIGINS.length} origin(s) (override with PRINT_BRIDGE_ALLOWED_ORIGINS)`);
  });

  // Periodic ping to detect stale agent connections (NAT/firewall timeouts)
  const PING_INTERVAL_MS = 30_000;
  setInterval(() => {
    agents.forEach((agent, bridgeId) => {
      if (agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.ping();
      } else {
        agents.delete(bridgeId);
      }
    });
  }, PING_INTERVAL_MS);

  // Graceful shutdown
  function gracefulShutdown(signal: string): void {
    // eslint-disable-next-line no-console
    console.log(`[print-bridge] ${signal} received, shutting down gracefully...`);
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log("[print-bridge] server closed");
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error("[print-bridge] forced shutdown after timeout");
      process.exit(1);
    }, 5000);
  }

  process.on("SIGTERM", () => { stopBridgeLifecycle(); gracefulShutdown("SIGTERM"); });
  process.on("SIGINT", () => { stopBridgeLifecycle(); gracefulShutdown("SIGINT"); });

}
