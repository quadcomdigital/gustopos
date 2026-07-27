import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

// Set test environment variables before importing server
process.env.PRINT_BRIDGE_SPOOL_DIR = path.join(os.tmpdir(), "gustopos-test-spool");
process.env.PRINT_BRIDGE_SECRET = "test-secret-key";

// Import app after env setup
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app } = require("./server");

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
});
