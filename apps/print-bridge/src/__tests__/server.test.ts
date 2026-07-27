/**
 * Unit Test for print-bridge server.ts
 * Tests the /print endpoint binary write behavior and input validation.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

function createTestApp(spoolDir: string) {
  const express = require("express");
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  type PrintRequest = {
    id: string;
    orderId: string;
    area: string;
    protocol: string;
    payload: string; // base64-encoded ESC/POS binary data
  };

  app.get("/health", (_req: any, res: any) => {
    res.json({ ok: true, port: 11905 });
  });

  app.post("/print", async (req: any, res: any) => {
    const body = req.body as Partial<PrintRequest>;
    if (!body.id || !body.orderId || !body.area || !body.protocol || !body.payload) {
      res.status(400).json({ error: "Missing required print job fields" });
      return;
    }

    const safeArea = body.area.replace(/[^a-z0-9_-]/gi, "_");
    const fileName = `${Date.now()}_${safeArea}_${body.id}.escpos`;
    const dir = path.resolve(spoolDir, safeArea);
    const filePath = path.resolve(dir, fileName);

    await fs.mkdir(dir, { recursive: true });
    const buffer = Buffer.from(body.payload, "base64");
    await fs.writeFile(filePath, buffer);

    res.json({ ok: true, filePath });
  });

  return app;
}

describe("print-bridge server", () => {
  let server: http.Server;
  let testSpoolDir: string;

  before(async () => {
    testSpoolDir = await fs.mkdtemp(path.join(os.tmpdir(), "print-bridge-test-"));
    const app = createTestApp(testSpoolDir);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    server.close();
    await fs.rm(testSpoolDir, { recursive: true, force: true });
  });

  function getPort(): number {
    const addr = server.address() as import("net").AddressInfo;
    return addr.port;
  }

  function httpPost(jsonPath: string, body: object): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const port = getPort();
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: jsonPath,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: string) => (data += chunk));
          res.on("end", () => {
            resolve({
              status: res.statusCode ?? 0,
              data: JSON.parse(data),
            });
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  function httpGet(jsonPath: string): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const port = getPort();
      http.get(`http://127.0.0.1:${port}${jsonPath}`, (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            data: JSON.parse(data),
          });
        });
      }).on("error", reject);
    });
  }

  it("GET /health returns ok", async () => {
    const { status, data } = await httpGet("/health");
    assert.equal(status, 200);
    assert.equal(data.ok, true);
  });

  it("POST /print rejects missing fields", async () => {
    const { status, data } = await httpPost("/print", { id: "1" });
    assert.equal(status, 400);
    assert.equal(data.error, "Missing required print job fields");
  });

  it("POST /print writes base64 payload as binary buffer", async () => {
    const escPosBytes = Buffer.from([0x1b, 0x40, 0x1b, 0x61, 0x01, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const base64Payload = escPosBytes.toString("base64");

    const printJob = {
      id: "test-1",
      orderId: "order-1",
      area: "kitchen",
      protocol: "escpos",
      payload: base64Payload,
    };

    const { status, data } = await httpPost("/print", printJob);
    assert.equal(status, 200);
    assert.equal(data.ok, true);

    const writtenBytes = await fs.readFile(data.filePath);
    assert.ok(Buffer.isBuffer(writtenBytes));
    assert.equal(writtenBytes.length, escPosBytes.length);
    assert.equal(writtenBytes.toString("hex"), escPosBytes.toString("hex"));

    const textContent = writtenBytes.toString("utf8");
    assert.notEqual(textContent, base64Payload);
  });

  it("POST /print preserves high-byte values as binary", async () => {
    const rawBytes = Buffer.from([0x80, 0x90, 0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf0]);
    const base64Payload = rawBytes.toString("base64");

    const printJob = {
      id: "test-2",
      orderId: "order-2",
      area: "bar",
      protocol: "escpos",
      payload: base64Payload,
    };

    const { status, data } = await httpPost("/print", printJob);
    assert.equal(status, 200);

    const writtenBytes = await fs.readFile(data.filePath);
    assert.equal(writtenBytes.toString("hex"), rawBytes.toString("hex"));
  });
});
