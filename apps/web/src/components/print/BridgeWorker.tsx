import { useEffect, useRef } from "react";
import { useAppStore } from "../../store/app-store";
import { authorizedFetch, API_URL } from "../../shared/api/client";
import { loadQzScript, getQzConfig, connectAndDiscover } from "../../shared/qz-tray";
import { useWakeLock } from "../../hooks/useWakeLock";
import type { LocalBridgeConfig, PrintJob } from "@gustopos/shared";

/**
 * Phase E "browser-as-bridge" — HEADLESS component mounted once at the
 * App root (BackofficeEntry). Lives outside React routes so it keeps
 * running across all pages, and survives route changes for as long as
 * the tab is open.
 *
 * v2 fixes (per code-review):
 * - Leader election: navigator.locks.request('gustopos-bridge-worker', ...)
 *   so only one tab performs heartbeats per browser session.
 * - AbortController per interval tick: pending fetches are aborted on unmount.
 * - Dynamic QZ host/port read from /api/printing/qz-config at enable time.
 */
export default function BridgeWorker() {
  const config = useAppStore((s) => (s as any).localBridgeConfig) as LocalBridgeConfig | null;
  const authToken = useAppStore((s) => (s as any).authToken) as string | undefined;
  const setLocalBridgeActive = useAppStore((s) => (s as any).setLocalBridgeActive);
  const setLocalBridgeLastError = useAppStore((s) => (s as any).setLocalBridgeLastError);

  const enabled = Boolean(config?.enabled && authToken);

  // Wake Lock + Web Worker + leader election are independent effects guarded by `enabled`.
  useWakeLock(Boolean(enabled && config?.enableWakeLock));

  const instanceIdRef = useRef<string>(crypto.randomUUID());
  const workerRef = useRef<Worker | null>(null);
  const qzRef = useRef<any>(null);
  const authTokenRef = useRef<string | undefined>(authToken);
  const isLeaderRef = useRef<boolean>(false);
  const configRef = useRef<LocalBridgeConfig | null>(config);
  useEffect(() => {
    authTokenRef.current = authToken;
    configRef.current = config;
  }, [authToken, config]);

  // beforeunload warning — prevent accidental tab closure.
  useEffect(() => {
    if (!enabled) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [enabled]);

  // Leader election via navigator.locks — single tab per browser session is leader.
  useEffect(() => {
    if (!enabled) {
      isLeaderRef.current = false;
      return;
    }
    if (typeof navigator === "undefined" || !navigator?.locks?.request) {
      // No lock support: best-effort, all tabs run independently.
      isLeaderRef.current = true;
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const acquire = async () => {
      while (!cancelled) {
        try {
          await navigator.locks.request(
            "gustopos-bridge-worker",
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
              if (cancelled) return;
              if (lock === null) {
                // Another tab holds the lock — we are not the leader.
                isLeaderRef.current = false;
                return;
              }
              isLeaderRef.current = true;
              // Hold the lock until cancelled.
              await new Promise<void>((resolve) => {
                const tick = () => {
                  if (cancelled) {
                    resolve();
                    return;
                  }
                setTimeout(tick, 300);
                };
                setTimeout(tick, 300);
              });
            },
          );
        } catch {
          /* swallow — lock contention is non-fatal */
        }
        if (cancelled) break;
        if (!isLeaderRef.current) {
          // Retry acquisition after a short backoff so we take over if leader tab dies.
          await new Promise<void>((resolve) => {
            retryTimer = setTimeout(resolve, 5000);
          });
        }
      }
    };
    void acquire();
    return () => {
      cancelled = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      isLeaderRef.current = false;
    };
  }, [enabled]);

  // Web Worker keepalive.
  useEffect(() => {
    if (!enabled || !config?.enableKeepaliveWorker) return;
    try {
      const w = new Worker("/keepalive.worker.js");
      w.onmessage = () => {
        // Empty handler — the act of the worker running keeps the main
        // thread alive even when the tab is backgrounded.
      };
      w.onerror = (err) => {
         
        console.warn("[BridgeWorker] keepalive worker error:", err);
      };
      w.postMessage({ type: "START", ms: 2000 });
      workerRef.current = w;
      return () => {
        try {
          w.postMessage({ type: "STOP" });
          w.terminate();
        } catch {
          /* noop */
        }
        if (workerRef.current === w) workerRef.current = null;
      };
    } catch (err) {
       
      console.warn("[BridgeWorker] keepalive worker boot failed:", err);
    }
  }, [enabled, config?.enableKeepaliveWorker]);

  // QZ Tray connection lifecycle — uses dynamic host/port from tenant module config.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let abortController: AbortController | null = null;
    (async () => {
      try {
        // Fetch tenant-specific QZ config first.
        abortController = new AbortController();
        const qzConfig = await getQzConfig();
        if (cancelled) return;
        await loadQzScript();
        if (cancelled) return;
        const qz = (window as any).qz;
        qzRef.current = qz;
        try {
          qz.websocket.setClosedCallbacks?.(() => {
            if (!cancelled) setLocalBridgeActive?.(false);
          });
          qz.websocket.setErrorCallbacks?.((e: unknown) => {
            if (!cancelled) setLocalBridgeLastError?.("qz error: " + safeStr(e));
          });
        } catch {
          /* some qz builds don't expose setters */
        }
        await connectAndDiscover(qzConfig);
        if (!cancelled) setLocalBridgeActive?.(true);
      } catch (err) {
        if (!cancelled) {
          setLocalBridgeLastError?.("qz connect failed: " + safeStr(err));
          setLocalBridgeActive?.(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      abortController?.abort();
    };
  }, [enabled, setLocalBridgeActive, setLocalBridgeLastError]);

  // Heartbeat loop — gated by leader election, with AbortController per tick.
  useEffect(() => {
    if (!enabled || !config) return;
    const intervalMs = config.heartbeatIntervalMs ?? 15000;
    const id = setInterval(async () => {
      if (!isLeaderRef.current) return;
      const ctrl = new AbortController();
      try {
        const host = typeof window !== "undefined" ? window.location.hostname : "browser";
        const printers = await safeListPrinters(qzRef.current);
        // Include network printers configured as IP:port so they show up in the
        // bridge pool heartbeat (not discoverable via QZ printers.find()).
        // Dedupe by name to avoid collisions with QZ-discovered drivers.
        const known = new Set(printers.map((p) => p.name));
        for (const m of configRef.current?.printersPerArea ?? []) {
          if (m.ip) {
            const name = m.printerName || m.ip;
            if (known.has(name)) continue;
            known.add(name);
            printers.push({ area: m.area ?? null, name, ip: m.ip, port: m.port ?? null });
          }
        }
        const res = await authorizedFetch(`${API_URL}/api/print-bridge/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bridge-instance-id": instanceIdRef.current,
          },
          body: JSON.stringify({
            bridgeId: configRef.current?.bridgeId,
            name: configRef.current?.deviceName,
            host,
            version: "browser-bridge",
            areas: configRef.current?.areas,
            printers,
          }),
          signal: ctrl.signal,
        });
        if (res.ok) setLocalBridgeActive?.(true);
        else setLocalBridgeLastError?.("heartbeat " + res.status);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setLocalBridgeLastError?.("heartbeat throw: " + safeStr(err));
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, config?.heartbeatIntervalMs, config?.bridgeId, config?.areas, config, setLocalBridgeActive, setLocalBridgeLastError]);

  // Claim + print loop — gated by leader election, with AbortController per tick.
  useEffect(() => {
    if (!enabled || !config) return;
    const intervalMs = config.claimIntervalMs ?? 3000;
    const id = setInterval(async () => {
      if (!isLeaderRef.current) return;
      const ctrl = new AbortController();
      try {
        const res = await authorizedFetch(`${API_URL}/api/print-bridge/claim`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bridge-instance-id": instanceIdRef.current,
          },
          body: JSON.stringify({ bridgeId: configRef.current?.bridgeId, limit: 5 }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setLocalBridgeLastError?.("claim " + res.status);
          return;
        }
        const body = (await res.json()) as { jobs: PrintJob[] };
        for (const job of body.jobs ?? []) {
          await printAndComplete(
            job,
            configRef.current as LocalBridgeConfig,
            qzRef.current,
            instanceIdRef.current,
            setLocalBridgeLastError,
          );
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setLocalBridgeLastError?.("claim throw: " + safeStr(err));
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, config?.claimIntervalMs, config?.bridgeId, config, setLocalBridgeLastError]);

  // Headless — no UI.
  return null;
}

// ─── Helpers (module-scope) ──────────────────────────────────────────

async function safeListPrinters(qz: any): Promise<Array<{ area?: string | null; name: string; ip: string | null; port: number | null }>> {
  if (!qz?.printers?.find) return [];
  try {
    const list: string[] = await qz.printers.find();
    return list.map((p) => ({ area: null, name: p, ip: null, port: null }));
  } catch {
    return [];
  }
}

async function printAndComplete(
  job: PrintJob,
  config: LocalBridgeConfig,
  qz: any,
  instanceId: string,
  setLocalBridgeLastError?: (msg: string | null) => void,
): Promise<void> {
  const mapping = config.printersPerArea?.find((m) => m.area === (job.area as any));
  const printerName = mapping?.printerName;
  const printerIp = mapping?.ip;
  const printerPort = mapping?.port;
  // Network printers are addressed by IP:port; local drivers by name.
  const printerIdentifier = printerIp || printerName;
  if (!printerIdentifier || !qz?.print || !qz?.configs?.create) {
    await failJobApi(job, config, instanceId, "no-printer-mapped", setLocalBridgeLastError);
    return;
  }
  try {
    const configOptions: Record<string, unknown> = {};
    if (printerIp && printerPort) {
      configOptions.port = printerPort;
    }
    const cfg = qz.configs.create(printerIdentifier, configOptions);
    await qz.print(cfg, [
      {
        type: "raw",
        format: "command",
        flavor: "base64",
        data: job.payload,
        options: { language: job.protocol ?? "escpos" },
      },
    ]);
    await completeJobApi(job, config, instanceId);
  } catch (err) {
    await failJobApi(job, config, instanceId, safeStr(err), setLocalBridgeLastError);
  }
}

async function completeJobApi(
  job: PrintJob,
  config: LocalBridgeConfig,
  instanceId: string,
): Promise<void> {
  await authorizedFetch(`${API_URL}/api/print-bridge/jobs/${encodeURIComponent(job.id)}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-instance-id": instanceId,
    },
    body: JSON.stringify({ bridgeId: config.bridgeId, notes: "browser-bridge printed" }),
  });
}

async function failJobApi(
  job: PrintJob,
  config: LocalBridgeConfig,
  instanceId: string,
  error: string,
  setLocalBridgeLastError?: (msg: string | null) => void,
): Promise<void> {
  setLocalBridgeLastError?.(`job ${job.id} fail: ${error}`);
  await authorizedFetch(`${API_URL}/api/print-bridge/jobs/${encodeURIComponent(job.id)}/fail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-instance-id": instanceId,
    },
    body: JSON.stringify({ bridgeId: config.bridgeId, error }),
  });
}

function safeStr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
