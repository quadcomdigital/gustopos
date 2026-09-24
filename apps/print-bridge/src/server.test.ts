import { describe, it, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { promises as fs } from "node:fs";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import os from "node:os";

// Set test environment variables before importing server
process.env.PRINT_BRIDGE_SPOOL_DIR = path.join(os.tmpdir(), "gustopos-test-spool");
process.env.PRINT_BRIDGE_SECRET = "test-secret-key";
process.env.PRINT_BRIDGE_ALLOWED_ORIGINS = "http://localhost:11900,https://test.example.test";
delete process.env.PRINT_BRIDGE_TENANT;
delete process.env.PRINT_BRIDGE_ORIGIN;

// Hermetic signing material: a fresh checkout has NO private keys (they are
// gitignored on purpose), so build a throwaway PKI — legacy pair plus a
// per-tenant pair — and point the bridge at it. The certificates are the
// committed public ones; the keys are generated here and never committed.
const TEST_CERTS_DIR = path.join(os.tmpdir(), `gustopos-test-certs-${process.pid}`);
const REPO_CERTS_DIR = path.resolve(__dirname, "..", "certs");
const newPrivateKey = () =>
  generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();

mkdirSync(path.join(TEST_CERTS_DIR, "tenants", "demo"), { recursive: true });
copyFileSync(path.join(REPO_CERTS_DIR, "digital-certificate.pem"), path.join(TEST_CERTS_DIR, "digital-certificate.pem"));
copyFileSync(path.join(REPO_CERTS_DIR, "ca-cert.pem"), path.join(TEST_CERTS_DIR, "ca-cert.pem"));
writeFileSync(path.join(TEST_CERTS_DIR, "private-key.pem"), newPrivateKey());
copyFileSync(
  path.join(REPO_CERTS_DIR, "tenants", "casale", "digital-certificate.pem"),
  path.join(TEST_CERTS_DIR, "tenants", "demo", "digital-certificate.pem"),
);
copyFileSync(
  path.join(REPO_CERTS_DIR, "tenants", "casale", "ca-cert.pem"),
  path.join(TEST_CERTS_DIR, "tenants", "demo", "ca-cert.pem"),
);
writeFileSync(path.join(TEST_CERTS_DIR, "tenants", "demo", "private-key.pem"), newPrivateKey());
writeFileSync(
  path.join(TEST_CERTS_DIR, "tenants", "demo", "meta.json"),
  JSON.stringify(
    {
      slug: "demo",
      cn: "GustoPOS demo",
      domains: ["test.example.test"],
      root: { fingerprintSha1: "ROOTSHA1DEMO" },
      leaf: { fingerprintSha1: "LEAFSHA1DEMO" },
    },
    null,
    2,
  ),
);
process.env.QZ_CERTS_DIR = TEST_CERTS_DIR;

// Import app after env setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require("./server");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clearSigningTenantCache } = require("./signing-tenants");

clearSigningTenantCache();

after(() => {
  try {
    rmSync(TEST_CERTS_DIR, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe("Print Bridge Server", () => {
  const testSpoolDir = process.env.PRINT_BRIDGE_SPOOL_DIR!;

  beforeEach(async () => {
    // Clean up test spool directory
    try {
      await fs.rm(testSpoolDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist yet
    }
    await fs.mkdir(testSpoolDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test spool directory
    try {
      await fs.rm(testSpoolDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe("GET /health", () => {
    it("should return health status with port", async () => {
      const res = await request(app).get("/health");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.port, 11905);
      // Should NOT expose spoolDir (security fix)
      assert.strictEqual(res.body.spoolDir, undefined);
    });
  });

  describe("POST /print", () => {
    const validPayload = {
      id: "test-job-1",
      orderId: "order-123",
      area: "kitchen",
      protocol: "escpos",
      payload: Buffer.from("test-print-data").toString("base64"),
    };

    it("should reject requests without auth when secret is set", async () => {
      const res = await request(app)
        .post("/print")
        .send(validPayload)
        .set("Content-Type", "application/json");
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, "Unauthorized: invalid or missing X-Print-Bridge-Key");
    });

    it("should accept requests with valid auth key", async () => {
      const res = await request(app)
        .post("/print")
        .send(validPayload)
        .set("Content-Type", "application/json")
        .set("X-Print-Bridge-Key", "test-secret-key");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.ok(res.body.filePath);
    });

    it("should reject requests missing required fields", async () => {
      const res = await request(app)
        .post("/print")
        .send({ id: "test-job-1" })
        .set("Content-Type", "application/json")
        .set("X-Print-Bridge-Key", "test-secret-key");
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, "Missing required print job fields");
    });

    it("should sanitize area parameter in file path", async () => {
      const payload = {
        ...validPayload,
        area: "kitchen/bar;rm -rf /",
        id: "test-job-2",
      };
      const res = await request(app)
        .post("/print")
        .send(payload)
        .set("Content-Type", "application/json")
        .set("X-Print-Bridge-Key", "test-secret-key");
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.filePath.includes("kitchen_bar_rm_-rf_"));
      assert.ok(!res.body.filePath.includes(";"));
    });

    it("should write binary file from base64 payload", async () => {
      const binaryData = Buffer.from([0x1b, 0x40, 0x1b, 0x33, 0x00]); // ESC/POS commands
      const payload = {
        ...validPayload,
        payload: binaryData.toString("base64"),
        id: "test-job-3",
      };
      const res = await request(app)
        .post("/print")
        .send(payload)
        .set("Content-Type", "application/json")
        .set("X-Print-Bridge-Key", "test-secret-key");
      assert.strictEqual(res.status, 200);

      // Verify file was written as binary
      const filePath = res.body.filePath;
      const fileContent = await fs.readFile(filePath);
      assert.deepStrictEqual(fileContent, binaryData);
    });

    it("should handle CORS preflight requests", async () => {
      const res = await request(app).options("/print");
      assert.strictEqual(res.status, 204);
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
      assert.strictEqual(res.headers["access-control-allow-methods"], "POST, OPTIONS");
    });

    it("should include CORS headers on POST response", async () => {
      const res = await request(app)
        .post("/print")
        .send(validPayload)
        .set("Content-Type", "application/json")
        .set("X-Print-Bridge-Key", "test-secret-key");
      assert.strictEqual(res.headers["access-control-allow-origin"], "*");
    });
  });

  describe("Static file serving", () => {
    it("should serve print-station.html from public directory", async () => {
      const res = await request(app).get("/print-station.html");
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.includes("GustoPOS Print Station"));
    });
  });

  describe("QZ signing endpoint hardening", () => {
    const validDigest = "a".repeat(64);
    const allowedOrigin = "http://localhost:11900";
    const foreignOrigin = "https://evil.example";

    it("rejects requests without an allowed Origin (signing oracle closed)", async () => {
      const noOrigin = await request(app)
        .get(`/signing/sign-message?request=${validDigest}`);
      assert.strictEqual(noOrigin.status, 403);

      const foreign = await request(app)
        .get(`/signing/sign-message?request=${validDigest}`)
        .set("Origin", foreignOrigin);
      assert.strictEqual(foreign.status, 403);
      assert.notStrictEqual(foreign.headers["access-control-allow-origin"], "*");
    });

    it("rejects non-digest input even from an allowed origin", async () => {
      const res = await request(app)
        .get("/signing/sign-message?request=printers.find")
        .set("Origin", allowedOrigin);
      assert.strictEqual(res.status, 400);
    });

    it("signs a valid digest for an allowlisted browser origin", async () => {
      const res = await request(app)
        .get(`/signing/sign-message?request=${validDigest}`)
        .set("Origin", allowedOrigin);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers["access-control-allow-origin"], allowedOrigin);
      assert.ok(res.text.length > 20, "signature should be a base64 blob");
    });

    it("hides debug/whitelist endpoints unless PRINT_BRIDGE_DEBUG_ENDPOINTS=true", async () => {
      for (const route of ["/signing/debug", "/signing/verify-test", "/signing/whitelist-entry", "/signing/whitelist-entry.txt"]) {
        const res = await request(app).get(route);
        assert.strictEqual(res.status, 404, `${route} should be gated off`);
      }
    });
  });

  describe("Per-tenant signing material", () => {
    it("serves the legacy certificate when no tenant matches the request", async () => {
      const res = await request(app).get("/signing/digital-certificate.txt");
      assert.strictEqual(res.status, 200);
      const legacy = await fs.readFile(path.join(TEST_CERTS_DIR, "digital-certificate.pem"), "utf-8");
      assert.strictEqual(res.text, legacy, "an unknown host must keep the legacy certificate");
    });

    it("serves the tenant certificate when the Origin belongs to a tenant", async () => {
      const res = await request(app)
        .get("/signing/digital-certificate.txt")
        .set("Origin", "https://test.example.test");
      assert.strictEqual(res.status, 200);
      const tenantCert = await fs.readFile(
        path.join(TEST_CERTS_DIR, "tenants", "demo", "digital-certificate.pem"),
        "utf-8",
      );
      const legacyCert = await fs.readFile(path.join(TEST_CERTS_DIR, "digital-certificate.pem"), "utf-8");
      assert.strictEqual(res.text, tenantCert, "the tenant's own certificate must be served");
      assert.notStrictEqual(res.text, legacyCert, "tenant and legacy certificates must differ");
    });

    it("serves the tenant trust anchor as override.crt", async () => {
      const res = await request(app)
        .get("/signing/override.crt")
        .set("Origin", "https://test.example.test");
      assert.strictEqual(res.status, 200);
      const tenantCa = await fs.readFile(path.join(TEST_CERTS_DIR, "tenants", "demo", "ca-cert.pem"), "utf-8");
      assert.strictEqual(res.text, tenantCa);
    });

    it("selects the tenant from PRINT_BRIDGE_TENANT when the caller is loopback", async () => {
      process.env.PRINT_BRIDGE_TENANT = "demo";
      try {
        const res = await request(app).get("/signing/digital-certificate.txt");
        assert.strictEqual(res.status, 200);
        const tenantCert = await fs.readFile(
          path.join(TEST_CERTS_DIR, "tenants", "demo", "digital-certificate.pem"),
          "utf-8",
        );
        assert.strictEqual(res.text, tenantCert);
      } finally {
        delete process.env.PRINT_BRIDGE_TENANT;
      }
    });

    it("still signs for an allowlisted browser origin of a known tenant", async () => {
      const res = await request(app)
        .get(`/signing/sign-message?request=${"b".repeat(64)}`)
        .set("Origin", "https://test.example.test");
      assert.strictEqual(res.status, 200);
      assert.ok(res.text.length > 20, "signature should be a base64 blob");
    });

    it("redirects installer links to the tenant origin that renders them", async () => {
      for (const file of ["install-qz-cert.bat", "install-qz-cert.ps1", "install-qz-cert.sh", "debug-qz-cert.ps1"]) {
        const res = await request(app)
          .get(`/${file}`)
          .set("Origin", "https://test.example.test");
        assert.strictEqual(res.status, 302, `${file} must redirect`);
        assert.strictEqual(res.headers.location, `https://test.example.test/signing/${file}`);
      }
    });

    it("explains how to configure the tenant when no origin is known", async () => {
      const res = await request(app).get("/install-qz-cert.bat");
      assert.strictEqual(res.status, 404);
      assert.ok(res.text.includes("PRINT_BRIDGE_TENANT"), res.text);
    });
  });
});
