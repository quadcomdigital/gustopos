import { useEffect, useMemo, useState } from 'react';
import type { PrintBridge } from '@gustopos/shared';
import { filterLegacyAreas } from './legacy-areas';
import { usePrintStations } from '../inventory/usePrintStations';

type Freshness = 'fresh' | 'slow' | 'offline';

interface BridgeCardProps {
  bridge: PrintBridge;
  isLocal: boolean;
  onEditMappings: (bridge: PrintBridge) => void;
  onEditClaimedAreas: (bridge: PrintBridge) => void;
  onDelete: (bridge: PrintBridge) => void;
  onTestPrint: (bridgeId: string, area: string) => Promise<void>;
  onScanNetwork: (bridgeId: string) => Promise<void>;
  onTestDevice: (bridgeId: string, device: { ip: string; port?: number; label?: string }) => Promise<void>;
  onUpdateAgent: (bridgeId: string) => Promise<void>;
  testingArea: string | null;
  isAreaCoolingDown?: (area: string) => boolean;
}

const GREEN_THRESHOLD_MS = 90_000;
const AMBER_THRESHOLD_MS = 180_000;

function classifyFreshness(lastHeartbeatAt: string | null | undefined): Freshness {
  if (!lastHeartbeatAt) return 'offline';
  const ms = Math.max(0, Date.now() - new Date(lastHeartbeatAt).getTime());
  if (ms < GREEN_THRESHOLD_MS) return 'fresh';
  if (ms < AMBER_THRESHOLD_MS) return 'slow';
  return 'offline';
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return 'mai';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'ora';
  if (seconds < 60) return `${seconds}s fa`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

export default function BridgeCard({
  bridge,
  isLocal,
  onEditMappings,
  onEditClaimedAreas,
  onDelete,
  onTestPrint,
  onScanNetwork,
  onTestDevice,
  onUpdateAgent,
  testingArea,
  isAreaCoolingDown,
}: BridgeCardProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const { stations } = usePrintStations();
  const stationName = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const [scanning, setScanning] = useState(false);
  const [deviceTesting, setDeviceTesting] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState('');

  const networkDevices = useMemo(
    () => (Array.isArray(bridge.printers) ? bridge.printers : []).filter((p) => p.source === 'net' && p.ip),
    [bridge.printers],
  );
  const isGoAgent = typeof bridge.version === 'string' && bridge.version.startsWith('go-');

  const handleScan = async () => {
    setScanning(true);
    setFeedback('');
    try {
      await onScanNetwork(bridge.id);
      setFeedback('Scansione avviata: i risultati arrivano tra pochi secondi.');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Scansione non avviata');
    } finally {
      setScanning(false);
    }
  };

  const handleTestDevice = async (ip: string, port: number | null | undefined, label: string) => {
    setDeviceTesting(ip);
    setFeedback('');
    try {
      await onTestDevice(bridge.id, { ip, port: port ?? undefined, label });
      setFeedback(`Test inviato a ${ip}.`);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Test fallito');
    } finally {
      setDeviceTesting(null);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setFeedback('');
    try {
      await onUpdateAgent(bridge.id);
      setFeedback('Aggiornamento richiesto: l\'agente si aggiorna e riavvia tra pochi secondi.');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Aggiornamento non richiesto');
    } finally {
      setUpdating(false);
    }
  };

  const freshness = classifyFreshness(bridge.lastHeartbeatAt);
  const dot =
    freshness === 'fresh' ? 'bg-green-500' :
    freshness === 'slow' ? 'bg-amber-500' :
    'bg-red-500';
  const statusLabel =
    freshness === 'fresh' ? 'online' :
    freshness === 'slow' ? 'rallentato' :
    'offline';

  const printerCount = Array.isArray(bridge.printers) ? bridge.printers.length : 0;
  const claimedAreas = filterLegacyAreas(bridge.claimedAreas);
  const mappingsByArea = new Map<string, string>(
    (bridge.mappings ?? []).map((m) => [String(m.area ?? ''), String(m.name ?? '')]),
  );

  return (
    <div className={`relative border rounded-xl p-4 bg-white shadow-sm space-y-3 ${isLocal ? 'border-primary' : 'border-border'}`}>
      {isLocal && (
        <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary rounded px-2 py-0.5">
          questo PC
        </span>
      )}

      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} aria-label={statusLabel} />
        <span className="text-sm font-bold text-secondary">{bridge.name}</span>
        <span className="text-[11px] text-text-muted">·</span>
        <span className="text-[11px] text-text-muted font-mono">{bridge.host || '—'}</span>
      </div>

      <div className="text-[11px] text-text-muted flex flex-wrap gap-x-3">
        <span className="capitalize">stato: <span className="font-semibold text-secondary">{statusLabel}</span></span>
        <span>ultimo heartbeat: <span className="font-semibold text-secondary">{relTime(bridge.lastHeartbeatAt)}</span></span>
        {bridge.version && <span>v{bridge.version}</span>}
      </div>

      <p className="text-[10px] text-text-muted">
        {printerCount > 0
          ? `vede ${printerCount} stampante${printerCount === 1 ? '' : 'i'} via QZ Tray`
          : 'nessuna stampante visibile via QZ Tray'}
      </p>

      {/* ─── Action chips ─────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => onEditClaimedAreas(bridge)}
          className="px-2.5 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 flex items-center gap-1.5"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${claimedAreas.length > 0 ? 'bg-primary' : 'bg-gray-300'}`} />
          Aree reclamate ({claimedAreas.length})
        </button>
        <button
          type="button"
          onClick={() => onEditMappings(bridge)}
          className="px-2.5 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 flex items-center gap-1.5"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${(bridge.mappings?.length ?? 0) > 0 ? 'bg-primary' : 'bg-gray-300'}`} />
          Mappings ({bridge.mappings?.length ?? 0})
        </button>
        <button
          type="button"
          onClick={() => onDelete(bridge)}
          className="px-2.5 py-1 rounded border border-red-300 text-red-700 text-[10px] font-bold uppercase tracking-wider hover:bg-red-50 flex items-center gap-1.5"
        >
          🗑 Rimuovi
        </button>
        {isGoAgent && (
          <button
            type="button"
            onClick={() => void handleUpdate()}
            disabled={updating || freshness === 'offline'}
            title={freshness === 'offline' ? 'Bridge offline' : "Scarica e installa l'ultima versione dell'agente"}
            className="px-2.5 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5"
          >
            {updating ? 'Aggiornamento…' : '⟳ Aggiorna agente'}
          </button>
        )}
      </div>

      {/* ─── Per-area test buttons ─────────────────── */}
      {claimedAreas.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {claimedAreas.map((area) => {
            const mapped = mappingsByArea.get(area);
            const coolingDown = isAreaCoolingDown?.(area) ?? false;
            const disabled = !mapped || testingArea === area || coolingDown || freshness === 'offline';
            const title = !mapped
              ? `Configura prima il mapping per ${stationName.get(area) ?? area}`
              : coolingDown
                ? 'Cooldown 3s — aspetta prima del prossimo test'
                : freshness === 'offline'
                  ? 'Bridge offline'
                  : `Invia test su ${mapped}`;
            const isTestingThis = testingArea === area;
            const label = isTestingThis
              ? 'Invio…'
              : coolingDown
                ? `⏳ ${stationName.get(area) ?? area}`
                : `🖨 ${stationName.get(area) ?? area}`;
            return (
              <button
                key={area}
                type="button"
                onClick={() => void onTestPrint(bridge.id, area)}
                disabled={disabled}
                title={title}
                className={`px-2 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  !mapped
                    ? 'border-dashed border-border text-text-muted'
                    : 'border-primary text-primary hover:bg-primary hover:text-white'
                } disabled:opacity-40`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Rete locale: scansione + stampanti trovate ─────────── */}
      <div className="border-t border-border pt-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Rete locale ({networkDevices.length})
          </span>
          <button
            type="button"
            onClick={() => void handleScan()}
            disabled={scanning || freshness === 'offline'}
            title={freshness === 'offline' ? 'Bridge offline' : 'Cerca stampanti di rete (porta 9100)'}
            className="px-2.5 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider hover:bg-gray-50 disabled:opacity-40"
          >
            {scanning ? 'Scansione…' : '⇄ Scansiona rete'}
          </button>
        </div>
        {networkDevices.length === 0 ? (
          <p className="text-[10px] text-text-muted">
            Nessuna stampante di rete trovata. Avvia una scansione per cercare dispositivi con
            porta 9100 aperta.
          </p>
        ) : (
          <ul className="space-y-1">
            {networkDevices.map((device) => {
              const ip = device.ip as string;
              return (
                <li
                  key={ip}
                  className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-secondary truncate">
                      {ip}:{device.port ?? 9100}
                    </p>
                    {device.vendor && (
                      <p className="text-[10px] text-text-muted truncate">{device.vendor}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleTestDevice(
                        ip,
                        device.port,
                        device.vendor ? `${device.vendor} ${ip}` : ip,
                      )
                    }
                    disabled={deviceTesting === ip || freshness === 'offline'}
                    className="shrink-0 px-2 py-1 rounded border border-primary text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-white disabled:opacity-40"
                  >
                    {deviceTesting === ip ? 'Invio…' : 'Test'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {feedback && <p className="text-[10px] text-text-muted">{feedback}</p>}
      </div>

      <p className="text-[10px] text-text-muted font-mono pt-1 border-t border-border">id: {bridge.id}</p>
    </div>
  );
}
