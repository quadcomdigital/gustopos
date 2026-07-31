import { useCallback, useEffect, useState } from "react";
import type { LocalBridgeArea, LocalBridgeConfig } from "@gustopos/shared";
import { useAppStore } from "../../store/app-store";
import { loadQzScript, getQzConfig, connectAndDiscover } from "../../shared/qz-tray";

interface Props {
  onClose: () => void;
}

const AREAS: LocalBridgeArea[] = ["kitchen", "bar", "cashier"];

/**
 * Phase E "Register this PC as a bridge" modal — v2 fixes:
 * - Save button requires EVERY active area to have a printer mapped
 *   (silent first-print failure was a v1 ship-blocker).
 * - Reads tenant-specific QZ host/port from /api/printing/qz-config so
 *   non-stock localhost:8182 deployments work.
 */
export default function RegisterLocalBridgeModal({ onClose }: Props) {
  const setLocalBridgeConfig = useAppStore((s) => (s as any).setLocalBridgeConfig);
  const refreshPrintBridges = useAppStore((s) => (s as any).refreshPrintBridges);

  const [qzStatus, setQzStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [qzError, setQzError] = useState<string | null>(null);
  const [qzHostLabel, setQzHostLabel] = useState<string>("localhost:8182");
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [areas, setAreas] = useState<LocalBridgeArea[]>(["cashier"]);
  const [printersPerArea, setPrintersPerArea] = useState<Record<LocalBridgeArea, string>>({
    kitchen: "",
    bar: "",
    cashier: "",
  });
  // Optional network-printer target: when an IP is set for an area it takes
  // precedence over the locally-discovered printer name (raw ESC/POS over IP:port).
  const [printersIp, setPrintersIp] = useState<Record<LocalBridgeArea, string>>({
    kitchen: "",
    bar: "",
    cashier: "",
  });
  const [printersPort, setPrintersPort] = useState<Record<LocalBridgeArea, string>>({
    kitchen: "",
    bar: "",
    cashier: "",
  });
  const [bridgeId, setBridgeId] = useState<string>(defaultBridgeId());
  const [deviceName, setDeviceName] = useState<string>(defaultDeviceName());

  // Probe QZ Tray + tenant config on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setQzStatus("connecting");
      try {
        // Fetch tenant-specific QZ config + connect + discover printers.
        const qzConfig = await getQzConfig();
        const port = (qzConfig.port.insecure ?? qzConfig.port.secure ?? [8182])[0];
        setQzHostLabel(`${qzConfig.host}:${port}${qzConfig.usingSecure ? " (TLS)" : ""}`);
        if (cancelled) return;

        await loadQzScript();
        if (cancelled) return;
        const { printers: list } = await connectAndDiscover(qzConfig);
        if (!cancelled) {
          setAvailablePrinters(list);
          setQzStatus("connected");
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setQzError(err instanceof Error ? err.message : String(err));
          setQzStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Validation: every active area must have a printer mapped before saving.
  // An area is considered mapped if a local printer name OR an IP:port is set.
  const allMapped =
    areas.length > 0 &&
    areas.every((a) => Boolean(printersPerArea[a]) || Boolean(printersIp[a].trim()));
  const canSave = qzStatus === "connected" && allMapped;

  const onSave = useCallback(() => {
    if (!canSave) return; // defensive double-check
    const config: LocalBridgeConfig = {
      enabled: true,
      bridgeId: bridgeId.trim(),
      deviceName: deviceName.trim() || defaultDeviceName(),
      areas,
      printersPerArea: areas.map((area) => {
        const ip = printersIp[area].trim();
        // Treat empty/0 as "unset" so QZ falls back to the default raw port 9100.
        const rawPort = Number(printersPort[area]);
        const port = rawPort >= 1 && rawPort <= 65535 ? Math.round(rawPort) : NaN;
        return {
          area,
          printerName: printersPerArea[area],
          ...(ip ? { ip } : {}),
          ...(ip && Number.isFinite(port) ? { port } : {}),
        };
      }),
      enableWakeLock: true,
      enableKeepaliveWorker: true,
      heartbeatIntervalMs: 15000,
      claimIntervalMs: 3000,
      enabledAt: new Date().toISOString(),
    };
    setLocalBridgeConfig(config);
    void refreshPrintBridges();
    onClose();
  }, [canSave, areas, bridgeId, deviceName, printersPerArea, printersIp, printersPort, setLocalBridgeConfig, refreshPrintBridges, onClose]);

  const toggleArea = (a: LocalBridgeArea) => {
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold">Registra questo PC come bridge di stampa</h3>
          <p className="text-[11px] text-text-muted mt-1">
            Zero installazioni. Funziona con QZ Tray già in esecuzione e GustoPOS aperto qui.
            La tab resta &ldquo;sveglia&rdquo; via Web Worker + Wake Lock.
          </p>
        </div>

        <div className="rounded border p-3 text-[11px] space-y-1">
          <div>
            <strong>Endpoint QZ Tray: </strong>
            <span className="font-mono">{qzHostLabel}</span>
          </div>
          <div>
            <strong>Stato: </strong>
            {qzStatus === "connected" && (
              <span className="text-emerald-600">
                connesso — {availablePrinters.length} stampanti rilevate
              </span>
            )}
            {qzStatus === "connecting" && <span className="text-amber-600">connessione in corso&hellip;</span>}
            {qzStatus === "error" && <span className="text-red-600">errore: {qzError}</span>}
            {qzStatus === "disconnected" && <span className="text-text-muted">in attesa&hellip;</span>}
          </div>
        </div>

        {qzStatus === "connected" && (
          <>
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-[11px] text-emerald-900">
              <strong>Stampanti rilevate da QZ Tray:</strong>
              <ul className="list-disc pl-5 mt-1 font-mono space-y-0.5">
                {availablePrinters.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px]">
                <div className="text-text-muted mb-1">Bridge ID (hostname unico)</div>
                <input
                  className="w-full border rounded px-2 py-1 text-xs font-mono"
                  value={bridgeId}
                  onChange={(ev) => setBridgeId(ev.target.value.replace(/[^A-Za-z0-9_-]/g, ""))}
                />
              </label>
              <label className="text-[11px]">
                <div className="text-text-muted mb-1">Nome visibile</div>
                <input
                  className="w-full border rounded px-2 py-1 text-xs"
                  value={deviceName}
                  onChange={(ev) => setDeviceName(ev.target.value)}
                />
              </label>
            </div>

            <div>
              <div className="text-[11px] text-text-muted mb-1">Questo PC gestisce quali aree?</div>
              <div className="flex gap-2 flex-wrap">
                {AREAS.map((a) => {
                  const on = areas.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      className={`px-3 py-1.5 rounded border text-[11px] font-bold uppercase tracking-wider transition-colors ${
                        on
                          ? "bg-emerald-100 border-emerald-400 text-emerald-900"
                          : "border-border hover:bg-gray-50"
                      }`}
                      onClick={() => toggleArea(a)}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-text-muted">Mappa stampante per ogni area attiva</div>
              {areas.map((area) => {
                const mapped = Boolean(printersPerArea[area]) || Boolean(printersIp[area].trim());
                return (
                  <div key={area} className="block text-[11px] border border-border rounded p-2 space-y-1.5">
                    <label className="flex items-center">
                      <span className="inline-block min-w-20 uppercase font-bold">{area}</span>
                      <select
                        className={`ml-2 flex-1 border rounded px-2 py-1 text-xs font-mono ${mapped ? "" : "border-red-300 bg-red-50"}`}
                        value={printersPerArea[area]}
                        onChange={(ev) =>
                          setPrintersPerArea((prev) => ({ ...prev, [area]: ev.target.value }))
                        }
                      >
                        <option value="">— stampante locale —</option>
                        {availablePrinters.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {!mapped && <span className="ml-2 text-red-600 text-[10px]">richiesto</span>}
                    </label>
                    <div className="flex items-center gap-1 pl-20">
                      <span className="text-text-muted">oppure IP:</span>
                      <input
                        className="flex-1 border rounded px-2 py-1 text-xs font-mono"
                        placeholder="192.168.1.50"
                        value={printersIp[area]}
                        onChange={(ev) =>
                          setPrintersIp((prev) => ({ ...prev, [area]: ev.target.value }))
                        }
                      />
                      <span className="text-text-muted">port:</span>
                      <input
                        className="w-20 border rounded px-2 py-1 text-xs font-mono"
                        placeholder="9100"
                        value={printersPort[area]}
                        onChange={(ev) =>
                          setPrintersPort((prev) => ({ ...prev, [area]: ev.target.value.replace(/[^0-9]/g, "") }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {!allMapped && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-2">
                Ogni area attiva deve avere una stampante mappata prima del salvataggio.
              </p>
            )}
          </>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50"
            onClick={onClose}
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={!canSave}
            className="px-3 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            onClick={onSave}
          >
            Registra e attiva
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultBridgeId(): string {
  if (typeof window === "undefined") return "browser-bridge";
  const host = window.location.hostname || "browser";
  return `${host}-bridge`;
}

function defaultDeviceName(): string {
  if (typeof window === "undefined") return "Browser Bridge";
  const host = window.location.hostname || "browser";
  return `Browser Bridge (${host})`;
}
