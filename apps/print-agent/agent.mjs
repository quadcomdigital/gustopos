#!/usr/bin/env node

// GustoPOS Print Agent — bridges print-bridge WebSocket ↔ QZ Tray
//
// Zero npm dependencies. Requires Node.js 22+ (built-in WebSocket).
// Run:  node agent.mjs
//
// Config file (optional):  ~/.gustopos-print-agent/config.json
//   { "bridgeUrl": "ws://vps:11905", "bridgeSecret": "pbos_...", "bridgeId": "kitchen-1" }
// Or via env:  BRIDGE_URL, BRIDGE_SECRET, BRIDGE_ID, QZ_PORT (default 8181)
//
// TLS notes:
//   - QZ Tray on localhost uses ws:// (no TLS needed)
//   - Bridge wss:// needs a proper CA-signed cert (Let's Encrypt) or set
//     NODE_EXTRA_CA_CERTS=/path/to/ca-cert.pem for self-signed bridge certs

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Guard: Node 22+ required for built-in WebSocket
if (typeof WebSocket === "undefined") {
  console.error(`Node.js 22+ required (built-in WebSocket). Running ${process.version}`);
  process.exit(1);
}

// ─── Configuration ──────────────────────────────────────────────────────────

function loadConfig() {
  // 1. Check JSON config file
  const configDir = path.join(os.homedir(), ".gustopos-print-agent");
  const configPath = path.join(configDir, "config.json");
  let fileConfig = {};
  try {
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      log("info", `loaded config from ${configPath}`);
    }
  } catch (e) {
    log("warn", `failed to read config file: ${e.message}`);
  }

  // 2. Env vars override file config
  const bridgeUrl = process.env.BRIDGE_URL || fileConfig.bridgeUrl;
  const bridgeSecret = process.env.BRIDGE_SECRET || fileConfig.bridgeSecret;
  const bridgeId = process.env.BRIDGE_ID || fileConfig.bridgeId || `agent_${os.hostname()}`;
  const qzPort = parseInt(process.env.QZ_PORT || fileConfig.qzPort || "8181", 10);

  // 3. Validate
  if (!bridgeUrl) {
    console.error("Missing bridgeUrl. Set BRIDGE_URL env var or add to config.json");
    process.exit(1);
  }
  if (!bridgeSecret) {
    console.error("Missing bridgeSecret. Set BRIDGE_SECRET env var or add to config.json");
    process.exit(1);
  }

  return { bridgeUrl, bridgeSecret, bridgeId, qzPort, configDir, configPath };
}

// ─── Logging ────────────────────────────────────────────────────────────────

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = level === "err" ? "ERROR" : level === "warn" ? "WARN " : "INFO ";
  console.log(`[${ts}] ${prefix} ${msg}`);
}

// ─── Signing (SHA-256 hash → RSA-SHA512 sign) ───────────────────────────────

function signQzMessage(jsonPayload, privateKeyPem) {
  const hash = crypto.createHash("sha256").update(jsonPayload).digest("hex");
  const sign = crypto.createSign("SHA512");
  sign.update(hash);
  return sign.sign(privateKeyPem, "base64");
}

// ─── PEM fetching from bridge ───────────────────────────────────────────────

async function fetchBridgePem(bridgeBaseUrl, endpoint, secret) {
  const url = `${bridgeBaseUrl.replace(/\/$/, "")}${endpoint}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { "X-Print-Bridge-Key": secret },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Agent state ────────────────────────────────────────────────────────────

const state = {
  connected: false,
  certPem: null,
  privateKeyPem: null,
  pendingJobs: new Map(), // uid → jobId
};

let bridgeWs = null;
let qzWs = null;
let reconnectAttempt = 0;
let reconnectTimer = null;

// ─── Bridge WebSocket ───────────────────────────────────────────────────────

function connectBridge(config) {
  if (bridgeWs) {
    bridgeWs.close();
    bridgeWs = null;
  }

  const { bridgeUrl, bridgeSecret, bridgeId } = config;
  log("info", `connecting to bridge ${bridgeUrl}/agent`);

  const ws = new WebSocket(`${bridgeUrl}/agent`);
  bridgeWs = ws;

  ws.onopen = () => {
    log("info", "bridge connected, sending auth");
    ws.send(JSON.stringify({ type: "auth", bridgeId, secret: bridgeSecret }));
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "auth_ok":
        log("info", "bridge authenticated");
        reconnectAttempt = 0;
        fetchCertsAndConnectQz(config);
        break;

      case "auth_error":
        log("err", `bridge auth failed: ${msg.error}`);
        scheduleReconnect(config);
        break;

      case "job":
        handleJob(msg, config).catch((err) => log("err", `job ${msg.id} error: ${err.message}`));
        break;

      case "job_done_ack":
        log("info", `job ${msg.id} done confirmed by bridge`);
        break;

      case "job_failed_ack":
        log("info", `job ${msg.id} failure confirmed by bridge`);
        break;
    }
  };

  ws.onclose = () => {
    log("warn", "bridge disconnected");
    disconnectQz();
    state.connected = false;
    scheduleReconnect(config);
  };

  ws.onerror = () => {
    log("err", "bridge WebSocket error — will reconnect");
  };
}

function scheduleReconnect(config) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30_000);
  reconnectAttempt++;
  log("warn", `reconnecting in ${delay / 1000}s (attempt ${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => connectBridge(config), delay);
}

// ─── Cert fetching & QZ Tray connection ─────────────────────────────────────

async function fetchCertsAndConnectQz(config) {
  try {
    log("info", "fetching certs from bridge");
    const [cert, key] = await Promise.all([
      fetchBridgePem(config.bridgeUrl, "/signing/digital-certificate.txt", config.bridgeSecret),
      fetchBridgePem(config.bridgeUrl, "/signing/private-key.pem", config.bridgeSecret),
    ]);
    state.certPem = cert;
    state.privateKeyPem = key;
    log("info", "certs loaded");
    await connectQzTray(config);
  } catch (err) {
    log("err", `cert fetch failed: ${err.message}`);
    scheduleReconnect(config);
  }
}

async function connectQzTray(config) {
  if (qzWs) {
    qzWs.close();
    qzWs = null;
  }

  // QZ Tray on localhost always uses ws:// (no TLS needed for local IPC).
  // The built-in WebSocket doesn't support custom TLS agents, and encrypting
  // a localhost connection provides no security benefit.
  const url = `ws://localhost:${config.qzPort}`;
  log("info", `connecting to QZ Tray ${url}`);

  const ws = new WebSocket(url);
  qzWs = ws;

  ws.onopen = () => {
    log("info", "QZ Tray connected, sending certificate");
    if (state.certPem) {
      ws.send(Buffer.from(state.certPem, "utf-8"));
    }
    state.connected = true;
    log("info", "ready — agent is online");
  };

  ws.onmessage = (event) => {
    try {
      const text = event.data.toString();
      const resp = JSON.parse(text);
      if (resp.error) {
        log("err", `QZ error: ${resp.error}`);
        const uid = resp.uid;
        if (uid && state.pendingJobs.has(uid)) {
          const jobId = state.pendingJobs.get(uid);
          state.pendingJobs.delete(uid);
          sendJobFailed(jobId, resp.error);
        }
      } else if (resp.uid && state.pendingJobs.has(resp.uid)) {
        const jobId = state.pendingJobs.get(resp.uid);
        state.pendingJobs.delete(resp.uid);
        sendJobDone(jobId);
        log("info", `job ${jobId} printed OK`);
      }
    } catch {
      // binary ack — ignore
    }
  };

  ws.onclose = () => {
    log("warn", "QZ Tray disconnected");
    state.connected = false;
  };

  ws.onerror = () => {
    log("err", "QZ Tray WebSocket error");
    ws.close();
  };
}

function disconnectQz() {
  if (qzWs) {
    qzWs.close();
    qzWs = null;
  }
  state.connected = false;
  state.pendingJobs.clear();
}

// ─── Job handling ───────────────────────────────────────────────────────────

async function handleJob(job, config) {
  if (!qzWs || qzWs.readyState !== WebSocket.OPEN) {
    sendJobFailed(job.id, "QZ Tray not connected");
    return;
  }
  if (!state.certPem || !state.privateKeyPem) {
    sendJobFailed(job.id, "no certs loaded");
    return;
  }

  const uid = `gstp_${job.id}`;
  const printRequest = {
    uid,
    call: "print",
    params: [
      { name: config.bridgeId },
      [{ type: "raw", format: "command", data: job.payload }],
    ],
  };

  const json = JSON.stringify(printRequest);
  const sig = signQzMessage(json, state.privateKeyPem);

  state.pendingJobs.set(uid, job.id);

  qzWs.send(Buffer.from(sig, "base64"));
  qzWs.send(json);
  log("info", `job ${job.id} sent to QZ (area=${job.area})`);

  // Timeout: if QZ doesn't respond in 30s, consider it failed
  setTimeout(() => {
    if (state.pendingJobs.has(uid)) {
      state.pendingJobs.delete(uid);
      log("err", `job ${job.id} timed out waiting for QZ response`);
      sendJobFailed(job.id, "QZ Tray response timeout");
    }
  }, 30_000);
}

function sendJobDone(jobId) {
  if (bridgeWs && bridgeWs.readyState === WebSocket.OPEN) {
    bridgeWs.send(JSON.stringify({ type: "job_done", id: jobId }));
  }
}

function sendJobFailed(jobId, error) {
  if (bridgeWs && bridgeWs.readyState === WebSocket.OPEN) {
    bridgeWs.send(JSON.stringify({ type: "job_failed", id: jobId, error }));
  }
}

// ─── Save config helper ─────────────────────────────────────────────────────

function saveConfig(config) {
  try {
    fs.mkdirSync(config.configDir, { recursive: true });
    fs.writeFileSync(config.configPath, JSON.stringify({
      bridgeUrl: config.bridgeUrl,
      bridgeSecret: config.bridgeSecret,
      bridgeId: config.bridgeId,
      qzPort: config.qzPort,
    }, null, 2), "utf-8");
    log("info", `config saved to ${config.configPath}`);
  } catch (e) {
    log("err", `failed to save config: ${e.message}`);
  }
}

// ─── CLI & Start ────────────────────────────────────────────────────────────

const config = loadConfig();

// Handle --save flag (first-run setup from env vars)
if (process.argv.includes("--save")) {
  saveConfig(config);
}

log("info", `starting: bridge=${config.bridgeUrl} id=${config.bridgeId} qz=ws://localhost:${config.qzPort}`);
connectBridge(config);

// Graceful shutdown
process.on("SIGINT", () => {
  log("warn", "SIGINT — shutting down");
  if (bridgeWs) bridgeWs.close();
  if (qzWs) qzWs.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("warn", "SIGTERM — shutting down");
  if (bridgeWs) bridgeWs.close();
  if (qzWs) qzWs.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  process.exit(0);
});
