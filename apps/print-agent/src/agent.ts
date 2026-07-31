import WebSocket from "ws";
import { signQzMessage, fetchBridgePem } from "./signing";

// ─── Types ──────────────────────────────────────────────────────────────

interface AgentConfig {
  bridgeUrl: string; // e.g., "ws://192.168.1.100:11905" or "wss://vps.example.com"
  bridgeSecret: string; // shared PRINT_BRIDGE_SECRET
  bridgeId: string; // unique ID for this POS machine
  qzPort: number; // QZ Tray port (8181 insecure, 8182 secure)
  qzSecure: boolean; // use wss:// for QZ Tray
}

interface BridgeJob {
  type: "job";
  id: string;
  orderId: string;
  area: string;
  payload: string; // base64-encoded ESC/POS data
}

interface PrintState {
  connected: boolean;
  certPem: string | null;
  privateKeyPem: string | null;
  /** Map of pending QZ request uid → jobId. Used to match QZ responses to bridge jobs. */
  pendingJobs: Map<string, string>;
}

// ─── Agent Core ─────────────────────────────────────────────────────────

export class PrintAgent {
  private config: AgentConfig;
  private state: PrintState = { connected: false, certPem: null, privateKeyPem: null, pendingJobs: new Map() };
  private bridgeWs: WebSocket | null = null;
  private qzWs: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private onStatusChange?: (status: string) => void;

  constructor(config: AgentConfig, onStatusChange?: (status: string) => void) {
    this.config = config;
    this.onStatusChange = onStatusChange;
  }

  async start(): Promise<void> {
    this.status("starting");
    await this.connectBridge();
  }

  stop(): void {
    this.status("stopping");
    this.clearReconnect();
    this.disconnectBridge();
    this.disconnectQz();
  }

  // ─── Status reporting ──────────────────────────────────────────────

  private status(msg: string): void {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[print-agent ${ts}] ${msg}`);
    this.onStatusChange?.(msg);
  }

  // ─── Bridge WebSocket ───────────────────────────────────────────────

  private async connectBridge(): Promise<void> {
    if (this.bridgeWs) {
      this.bridgeWs.close();
      this.bridgeWs = null;
    }

    const { bridgeUrl } = this.config;
    this.status(`connecting to bridge ${bridgeUrl}/agent`);

    return new Promise((resolve, _reject) => {
      const ws = new WebSocket(`${bridgeUrl}/agent`);
      this.bridgeWs = ws;

      ws.on("open", () => {
        this.status("bridge connected, authenticating");
        ws.send(
          JSON.stringify({
            type: "auth",
            bridgeId: this.config.bridgeId,
            secret: this.config.bridgeSecret,
          }),
        );
      });

      ws.on("message", async (raw) => {
        let msg: { type: string; id?: string; error?: string };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }

        switch (msg.type) {
          case "auth_ok":
            this.status("bridge authenticated");
            this.reconnectAttempt = 0;
            await this.fetchCertsAndConnectQz();
            resolve();
            break;

          case "auth_error":
            this.status(`bridge auth failed: ${msg.error}`);
            this.scheduleReconnect();
            break;

          case "job":
            await this.handleJob(msg as unknown as BridgeJob);
            break;

          default:
            // ignore (job_done_ack, job_failed_ack, etc.)
            break;
        }
      });

      ws.on("close", () => {
        this.status("bridge disconnected");
        this.disconnectQz();
        this.state.connected = false;
        this.scheduleReconnect();
      });

      ws.on("error", (err) => {
        this.status(`bridge error: ${err.message}`);
        ws.close();
      });
    });
  }

  private disconnectBridge(): void {
    if (this.bridgeWs) {
      this.bridgeWs.close();
      this.bridgeWs = null;
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), 30_000);
    this.reconnectAttempt++;
    this.status(`reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => {
      void this.connectBridge();
    }, delay);
  }

  // ─── Certs & QZ Tray ────────────────────────────────────────────────

  private async fetchCertsAndConnectQz(): Promise<void> {
    try {
      this.status("fetching certs from bridge");
      const [cert, key] = await Promise.all([
        fetchBridgePem(this.config.bridgeUrl, "/signing/digital-certificate.txt", this.config.bridgeSecret),
        fetchBridgePem(this.config.bridgeUrl, "/signing/private-key.pem", this.config.bridgeSecret),
      ]);
      this.state.certPem = cert;
      this.state.privateKeyPem = key;
      this.status("certs loaded");
      await this.connectQzTray();
    } catch (err) {
      this.status(`cert fetch failed: ${(err as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private async connectQzTray(): Promise<void> {
    if (this.qzWs) {
      this.qzWs.close();
      this.qzWs = null;
    }

    const { qzPort, qzSecure } = this.config;
    const protocol = qzSecure ? "wss" : "ws";
    const url = `${protocol}://localhost:${qzPort}`;
    this.status(`connecting to QZ Tray ${url}`);

    return new Promise((resolve) => {
      const ws = new WebSocket(url, {
        rejectUnauthorized: false, // QZ Tray uses self-signed certs
      });
      this.qzWs = ws;

      ws.on("open", () => {
        this.status("QZ Tray connected, sending certificate");
        // Send the certificate as the first message so QZ Tray can verify
        // future signed messages. Binary message with the PEM data.
        if (this.state.certPem) {
          ws.send(Buffer.from(this.state.certPem, "utf-8"));
        }
        this.state.connected = true;
        resolve();
      });

      ws.on("message", (raw) => {
        try {
          const text = raw.toString();
          const resp = JSON.parse(text);
          // QZ Tray response format: { uid, result, error, ... }
          if (resp.error) {
            this.status(`QZ response error: ${resp.error}`);
            // Match to a pending job and report failure
            const uid = resp.uid as string | undefined;
            if (uid) {
              const jobId = this.state.pendingJobs.get(uid);
              if (jobId) {
                this.state.pendingJobs.delete(uid);
                this.sendJobFailed(jobId, resp.error);
              }
            }
          } else if (resp.uid && this.state.pendingJobs.has(resp.uid)) {
            // Successful print result — mark job as done
            const jobId = this.state.pendingJobs.get(resp.uid)!;
            this.state.pendingJobs.delete(resp.uid);
            this.sendJobDone(jobId);
          }
        } catch {
          // binary ack, ignore
        }
      });

      ws.on("close", () => {
        this.status("QZ Tray disconnected");
        this.state.connected = false;
      });

      ws.on("error", (err) => {
        this.status(`QZ Tray error: ${err.message}`);
        ws.close();
      });
    });
  }

  private disconnectQz(): void {
    if (this.qzWs) {
      this.qzWs.close();
      this.qzWs = null;
    }
    this.state.connected = false;
    // Clear pending jobs — they'll be re-claimed by the bridge if needed
    this.state.pendingJobs.clear();
  }

  // ─── Job handling ────────────────────────────────────────────────────

  private async handleJob(job: BridgeJob): Promise<void> {
    if (!this.qzWs || this.qzWs.readyState !== WebSocket.OPEN) {
      this.sendJobFailed(job.id, "QZ Tray not connected");
      return;
    }

    if (!this.state.certPem || !this.state.privateKeyPem) {
      this.sendJobFailed(job.id, "no certs loaded");
      return;
    }

    const { id, area, payload } = job;
    const printerName = this.config.bridgeId;

    const uid = `gstp_${id}`;
    const printRequest = {
      uid,
      call: "print",
      params: [
        { name: printerName },
        [
          {
            type: "raw",
            format: "command",
            data: payload,
          },
        ],
      ],
    };

    const json = JSON.stringify(printRequest);

    try {
      const sig = signQzMessage(json, this.state.privateKeyPem);

      // Track this job before sending to QZ Tray
      this.state.pendingJobs.set(uid, id);

      // Send to QZ Tray: signature first (binary), then JSON (text)
      this.qzWs.send(Buffer.from(sig, "base64"));
      this.qzWs.send(json);
      this.status(`job ${id} sent to QZ Tray (area=${area})`);

      // Don't send job_done yet — wait for QZ Tray response.
      // If QZ doesn't respond within 30 seconds, consider it failed.
      setTimeout(() => {
        if (this.state.pendingJobs.has(uid)) {
          this.state.pendingJobs.delete(uid);
          this.status(`job ${id} timed out waiting for QZ response`);
          this.sendJobFailed(id, "QZ Tray response timeout");
        }
      }, 30_000);
    } catch (err) {
      this.status(`job ${id} signing failed: ${(err as Error).message}`);
      this.sendJobFailed(id, (err as Error).message);
    }
  }

  private sendJobDone(jobId: string): void {
    if (this.bridgeWs?.readyState === WebSocket.OPEN) {
      this.bridgeWs.send(JSON.stringify({ type: "job_done", id: jobId }));
    }
  }

  private sendJobFailed(jobId: string, error: string): void {
    if (this.bridgeWs?.readyState === WebSocket.OPEN) {
      this.bridgeWs.send(JSON.stringify({ type: "job_failed", id: jobId, error }));
    }
  }
}
