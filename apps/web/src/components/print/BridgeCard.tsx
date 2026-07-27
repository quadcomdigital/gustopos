import { useEffect, useState } from 'react';
import type { PrintArea, PrintBridge, PrintBridgePrinterMapping } from '@gustopos/shared';

type Freshness = 'fresh' | 'slow' | 'offline';

interface BridgeCardProps {
  bridge: PrintBridge;
  isLocal: boolean;
  onEditMappings: (bridge: PrintBridge) => void;
  onEditClaimedAreas: (bridge: PrintBridge) => void;
  onTestPrint: (bridgeId: string, area: PrintArea) => Promise<void>;
  testingArea: PrintArea | null;
  isAreaCoolingDown?: (area: PrintArea) => boolean;
}

const GREEN_THRESHOLD_MS = 90_000;
const AMBER_THRESHOLD_MS = 180_000;

const AREA_LABELS: Record<PrintArea, string> = {
  kitchen: 'Cucina',
  bar: 'Bar',
  cashier: 'Cassa',
};

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
  onTestPrint,
  testingArea,
  isAreaCoolingDown,
}: BridgeCardProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

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
  const claimedAreas = Array.isArray(bridge.claimedAreas)
    ? bridge.claimedAreas.filter((a): a is PrintArea =>
        a === 'kitchen' || a === 'bar' || a === 'cashier',
      )
    : [];
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
      </div>

      {/* ─── Per-area test buttons ─────────────────── */}
      {claimedAreas.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {claimedAreas.map((area) => {
            const mapped = mappingsByArea.get(area);
            const coolingDown = isAreaCoolingDown?.(area) ?? false;
            const disabled = !mapped || testingArea === area || coolingDown || freshness === 'offline';
            const title = !mapped
              ? `Configura prima il mapping per ${AREA_LABELS[area]}`
              : coolingDown
                ? 'Cooldown 3s — aspetta prima del prossimo test'
                : freshness === 'offline'
                  ? 'Bridge offline'
                  : `Invia test su ${mapped}`;
            const isTestingThis = testingArea === area;
            const label = isTestingThis
              ? 'Invio…'
              : coolingDown
                ? `⏳ ${AREA_LABELS[area]}`
                : `🖨 ${AREA_LABELS[area]}`;
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

      <p className="text-[10px] text-text-muted font-mono pt-1 border-t border-border">id: {bridge.id}</p>
    </div>
  );
}
