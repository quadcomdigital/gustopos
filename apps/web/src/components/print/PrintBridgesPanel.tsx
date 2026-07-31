import { useCallback, useEffect, useMemo, useState } from "react";
import type { LocalBridgeConfig, PrintArea, PrintBridge, PrintBridgePrinterMapping } from "@gustopos/shared";
import { useAppStore } from "../../store/app-store";
import BridgeCard from "./BridgeCard";
import BindBridgeMappingModal from "./BindBridgeMappingModal";
import ClaimedAreasModal from "./ClaimedAreasModal";
import RegisterLocalBridgeModal from "./RegisterLocalBridgeModal";
import PrintStationWizard from "./PrintStationWizard";

function isLocalBridge(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return host === hostname || host === "127.0.0.1" || host === "0.0.0.0";
}

export default function PrintBridgesPanel() {
  const printBridges = useAppStore((s) => s.printBridges);
  const enabledModules = useAppStore((s) => s.enabledModules);
  const refreshPrintBridges = useAppStore((s) => s.refreshPrintBridges);
  const updateMappings = useAppStore((s) => s.updateBridgeMappings);
  const updateClaimedAreas = useAppStore((s) => s.updateBridgeClaimedAreas);
  const triggerTestPrint = useAppStore((s) => s.triggerBridgeTestPrint);
  const lastFetchedAt = useAppStore((s) => s.printBridgesLastFetchedAt);

  // Browser-as-bridge slice (secondary method: printing from this browser tab).
  const localConfig = useAppStore((s) => (s as any).localBridgeConfig) as LocalBridgeConfig | null;
  const localActive = (localConfig as any)?.active ?? false;
  const localLastError = useAppStore((s) => (s as any).localBridgeLastError) as string | null;
  const setLocalBridgeConfig = useAppStore((s) => (s as any).setLocalBridgeConfig);

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (enabledModules.includes("printing")) {
      void refreshPrintBridges();
    }
  }, [enabledModules, refreshPrintBridges]);

  const [editingMappings, setEditingMappings] = useState<PrintBridge | null>(null);
  const [editingClaimedAreas, setEditingClaimedAreas] = useState<PrintBridge | null>(null);
  const [testingByKey, setTestingByKey] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Anti-spam cooldown for test prints.
  const COOLDOWN_MS = 3_000;
  const [cooldownExpiryByKey, setCooldownExpiryByKey] = useState<Record<string, number>>({});
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setCooldownExpiryByKey((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [k, exp] of Object.entries(prev)) {
          if (exp > now) {
            next[k] = exp;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(() => {
    const arr = [...printBridges];
    arr.sort((a, b) => {
      const aLocal = isLocalBridge(a.host) ? 0 : 1;
      const bLocal = isLocalBridge(b.host) ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal;
      const ageA = Date.now() - new Date(a.lastHeartbeatAt ?? a.updatedAt ?? a.createdAt ?? Date.now()).getTime();
      const ageB = Date.now() - new Date(b.lastHeartbeatAt ?? b.updatedAt ?? b.createdAt ?? Date.now()).getTime();
      if (Math.abs(ageA - ageB) > 5_000) return ageA - ageB;
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [printBridges]);

  const fetchedLabel = lastFetchedAt ? new Date(lastFetchedAt).toLocaleTimeString("it-IT") : "mai";

  const handleTestPrint = useCallback(
    async (bridgeId: string, area: PrintArea) => {
      const key = `${bridgeId}|${area}`;
      const exp = cooldownExpiryByKey[key];
      if (exp && exp > Date.now()) return;
      setTestingByKey(key);
      try {
        await triggerTestPrint(bridgeId, area);
        setCooldownExpiryByKey((prev) => ({ ...prev, [key]: Date.now() + COOLDOWN_MS }));
      } finally {
        setTestingByKey((prev) => (prev === key ? null : prev));
      }
    },
    [cooldownExpiryByKey, triggerTestPrint],
  );

  const handleDisableLocalBridge = useCallback(() => {
    setLocalBridgeConfig(null);
  }, [setLocalBridgeConfig]);

  return (
    <section className="space-y-6">
      {/* ── Collega una stampante remota (flusso Go agent) ─────────────── */}
      <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
              Collega una stampante remota
            </h3>
            <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
              Per un PC lontano (cucina, bar, cassa) installa il{" "}
              <strong>GustoPOS Print Agent</strong> e accoppialo con un codice.
              Genera qui il <strong>codice a 6 cifre</strong> e inseriscilo sul PC remoto:
              il collegamento è immediato e permanente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="px-5 py-3 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors shadow-sm"
          >
            + Genera codice di collegamento
          </button>
        </div>
        <p className="text-[11px] text-text-muted">
          💡 Il Print Agent è un piccolo programma che resta in esecuzione sul PC della
          stampante (Windows, Linux o macOS). Scaricalo dalla pagina{" "}
          <a
            href="/downloads/"
            target="_blank"
            rel="noreferrer"
            className="font-mono bg-gray-100 border border-border rounded px-1 text-primary hover:text-primary/80 underline underline-offset-2"
          >
            /downloads/
          </a>{" "}
          del tuo GustoPOS e avvialo: si aprirà la pagina di accoppiamento da sola.
        </p>
      </div>

      {/* ── Stampanti collegate (pool) ─────────────────────────────────── */}
      <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
              Stampanti collegate
            </h3>
            <p className="text-[11px] text-text-muted">
              Bridge registrati (agent remoti e browser). Aggiornato in tempo reale via Socket.IO.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted font-mono">ultimo fetch: {fetchedLabel}</span>
            <button
              type="button"
              onClick={() => void refreshPrintBridges()}
              className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
            >
              ↻ Aggiorna
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="text-xs text-text-muted py-3 px-3 border border-dashed border-border rounded">
            Nessuna stampante collegata. Usa il pulsante{" "}
            <strong>+ Genera codice di collegamento</strong> qui sopra per accoppiare un PC remoto
            (agente Go), oppure la sezione{" "}
            <strong>Stampa dal browser su questo PC</strong> più in basso.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-text-muted">
              {sorted.length} bridge nel pool
              {sorted.some((b) => isLocalBridge(b.host)) && " · questo PC è già nel pool"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sorted.map((bridge) => {
                const cooldownFor = (area: PrintArea): boolean => {
                  const exp = cooldownExpiryByKey[`${bridge.id}|${area}`];
                  return Boolean(exp && exp > Date.now());
                };
                return (
                  <BridgeCard
                    key={bridge.id}
                    bridge={bridge}
                    isLocal={isLocalBridge(bridge.host)}
                    onEditMappings={setEditingMappings}
                    onEditClaimedAreas={setEditingClaimedAreas}
                    onTestPrint={handleTestPrint}
                    testingArea={
                      testingByKey?.startsWith(`${bridge.id}|`)
                        ? (testingByKey.split("|")[1] as PrintArea)
                        : null
                    }
                    isAreaCoolingDown={cooldownFor}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Stampa dal browser su questo PC (metodo alternativo) ──────── */}
      <div
        className={`rounded-xl border p-4 space-y-3 bg-white ${
          localConfig?.enabled ? "border-emerald-300" : "border-border"
        }`}
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-secondary">
              Stampa dal browser su questo PC
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Alternativa senza installazioni: il browser già aperto + QZ Tray locale
              gestiscono i job delle aree che selezioni.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {localConfig?.enabled ? (
              <button
                type="button"
                onClick={handleDisableLocalBridge}
                className="px-3 py-1.5 rounded border border-red-300 bg-white text-red-700 text-[11px] font-bold uppercase tracking-wider hover:bg-red-50 transition-colors"
              >
                Disattiva
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRegisterOpen(true)}
                className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
              >
                Attiva
              </button>
            )}
          </div>
        </div>

        {localConfig?.enabled && (
          <div className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  localActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <strong>{localActive ? "Bridge attivo" : "In attesa di connessione QZ Tray"}</strong>
              <span className="font-mono text-text-muted">({localConfig.bridgeId})</span>
            </div>
            <div>
              <span className="text-text-muted">Aree: </span>
              <strong>{localConfig.areas.map((a) => a.toUpperCase()).join(", ")}</strong>
            </div>
            <div>
              <span className="text-text-muted">Stampanti: </span>
              {localConfig.printersPerArea.map((m) => (
                <span key={m.area} className="mr-2 font-mono">
                  [{m.area}] {m.printerName || m.ip || "—"}
                  {m.ip ? ` @ ${m.ip}:${m.port ?? 9100}` : ""}
                </span>
              ))}
            </div>
            {localLastError && (
              <div className="rounded border border-red-300 bg-red-50 text-red-700 px-2 py-1 mt-1">
                {localLastError}
              </div>
            )}
          </div>
        )}
      </div>

      {editingMappings && (
        <BindBridgeMappingModal
          bridge={editingMappings}
          onClose={() => setEditingMappings(null)}
          onSave={async (mappings: PrintBridgePrinterMapping[]) => {
            await updateMappings(editingMappings.id, mappings);
            setEditingMappings(null);
          }}
          onTestPrint={async (area) => {
            await handleTestPrint(editingMappings.id, area);
          }}
        />
      )}

      {editingClaimedAreas && (
        <ClaimedAreasModal
          bridge={editingClaimedAreas}
          onClose={() => setEditingClaimedAreas(null)}
          onSave={async (areas) => {
            await updateClaimedAreas(editingClaimedAreas.id, areas);
            setEditingClaimedAreas(null);
          }}
        />
      )}

      {registerOpen && <RegisterLocalBridgeModal onClose={() => setRegisterOpen(false)} />}

      {wizardOpen && <PrintStationWizard onClose={() => setWizardOpen(false)} />}
    </section>
  );
}
