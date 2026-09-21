import { useEffect, useMemo, useState } from 'react';
import type {
  PrintBridge,
  PrintBridgePrinterMapping,
} from '@gustopos/shared';
import { usePrintStations } from '../inventory/usePrintStations';
import { filterLegacyAreas, isLegacyAreaKey } from './legacy-areas';

interface BindBridgeMappingModalProps {
  bridge: PrintBridge;
  onClose: () => void;
  onSave: (mappings: PrintBridgePrinterMapping[]) => Promise<void>;
  onTestPrint: (stationId: string) => Promise<void>;
  onTestDevice: (device: { ip: string; port?: number; label?: string }) => Promise<void>;
}

export default function BindBridgeMappingModal({
  bridge,
  onClose,
  onSave,
  onTestPrint,
  onTestDevice,
}: BindBridgeMappingModalProps) {
  const { stations } = usePrintStations();
  const stationName = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);

  const claimedAreas = useMemo(
    () => filterLegacyAreas(bridge.claimedAreas),
    [bridge.claimedAreas],
  );
  const hadLegacyAreas = useMemo(
    () => Array.isArray(bridge.claimedAreas) && bridge.claimedAreas.some((a) => isLegacyAreaKey(a)),
    [bridge.claimedAreas],
  );
  const isGoAgent = typeof bridge.version === 'string' && bridge.version.startsWith('go-');
  const discoveredPrinterNames = useMemo(() => {
    const names = (Array.isArray(bridge.printers) ? bridge.printers : [])
      .filter((printer) => printer.source !== 'net')
      .map((printer) => printer.name.trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [bridge.printers]);
  const networkDevices = useMemo(
    () =>
      (Array.isArray(bridge.printers) ? bridge.printers : [])
        .filter((printer) => printer.source === 'net' && printer.ip)
        .sort((a, b) => String(a.ip).localeCompare(String(b.ip))),
    [bridge.printers],
  );

  const [rows, setRows] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingArea, setSavingArea] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Seed rows from existing mappings. Encoded value: "net:<ip>:<port>" or "qz:<name>".
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of bridge.mappings ?? []) {
      if (typeof m.area === 'string' && m.area) {
        if (m.ip) next[m.area] = `net:${m.ip}:${m.port ?? 9100}`;
        else if (m.name) next[m.area] = `qz:${m.name}`;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [bridge-sync] syncs rows from bridge.mappings prop
    setRows(next);
  }, [bridge.id, bridge.mappings]);

  const allMappingsValid = useMemo(
    () => claimedAreas.length > 0 && claimedAreas.every((area) => {
      const selected = rows[area]?.trim() ?? '';
      if (!selected) return false;
      if (selected.startsWith('net:')) return selected.split(':')[1]?.length > 0;
      const name = selected.startsWith('qz:') ? selected.slice(3) : selected;
      return !isGoAgent || discoveredPrinterNames.includes(name);
    }),
    [claimedAreas, discoveredPrinterNames, isGoAgent, rows],
  );

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const mappings: PrintBridgePrinterMapping[] = claimedAreas.map((area) => {
        const value = rows[area]?.trim() ?? '';
        if (value.startsWith('net:')) {
          const [, ip, portStr] = value.split(':');
          const port = Number.parseInt(portStr ?? '', 10);
          return { area, name: `${ip}:${Number.isFinite(port) ? port : 9100}`, ip, port: Number.isFinite(port) ? port : 9100 };
        }
        const name = value.startsWith('qz:') ? value.slice(3) : value;
        return { area, name };
      });
      await onSave(mappings);
      setSuccess('Mappings salvati.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (area: string) => {
    const value = rows[area]?.trim() ?? '';
    if (!value) {
      setError('Seleziona una stampante prima di testare.');
      return;
    }
    setSavingArea(area);
    setError('');
    try {
      if (value.startsWith('net:')) {
        const [, ip, portStr] = value.split(':');
        const port = Number.parseInt(portStr ?? '', 10);
        await onTestDevice({
          ip,
          port: Number.isFinite(port) ? port : 9100,
          label: stationName.get(area) ?? area,
        });
      } else {
        await onTestPrint(area);
      }
      setSuccess('Test inviato.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test fallito');
    } finally {
      setSavingArea(null);
    }
  };

  // Combined select options: QZ printers (source qz) + discovered network
  // printers (source net -> "net:ip:port").
  const targetOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    for (const name of discoveredPrinterNames) {
      options.push({ value: `qz:${name}`, label: `${name} · QZ locale` });
    }
    for (const device of networkDevices) {
      const ip = device.ip as string;
      const port = device.port ?? 9100;
      options.push({
        value: `net:${ip}:${port}`,
        label: `${ip}:${port}${device.vendor ? ` · ${device.vendor}` : ''} · rete`,
      });
    }
    return options;
  }, [discoveredPrinterNames, networkDevices]);

  const optionValues = useMemo(() => new Set(targetOptions.map((o) => o.value)), [targetOptions]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider text-secondary">
              Mappings stampanti
            </h3>
            <p className="text-[11px] text-text-muted">
              Bridge <span className="font-mono">{bridge.name}</span> · host{' '}
              <span className="font-mono">{bridge.host || '—'}</span>
            </p>
            <p className="text-[11px] text-text-muted mt-1">
              Le opzioni del menu a tendina sono le stampanti che QZ Tray vede su questo PC.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50"
          >
            ✕ Chiudi
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          {error && (
            <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
          )}
          {success && (
            <p className="rounded border border-success/30 bg-green-50 px-3 py-2 text-xs text-success">{success}</p>
          )}

          {hadLegacyAreas && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <strong>⚠️ Aree legacy rilevate.</strong> Le vecchie chiavi (kitchen/bar/cashier)
              non sono più valide e sono state ignorate. Rimappale dalla sezione{' '}
              <em>Stazioni reclamate</em> scegliendo le stazioni corrette.
            </div>
          )}

          {claimedAreas.length === 0 ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <strong>⚠️ Nessuna stazione reclamata.</strong> Apri prima{' '}
              <em>Stazioni reclamate</em> per assegnare almeno una stazione, altrimenti il
              bridge non riceverà job.
            </div>
          ) : (
            claimedAreas.map((area) => (
              <div
                key={area}
                className="rounded-lg border border-border p-3 space-y-2 bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    {stationName.get(area) ?? 'Stazione eliminata'}
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleTest(area)}
                    disabled={savingArea === area || !rows[area]?.trim()}
                    className="px-3 py-1.5 rounded border border-primary text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-colors disabled:opacity-40"
                    title={!rows[area]?.trim() ? 'Scegli prima una stampante' : undefined}
                  >
                    {savingArea === area ? 'Invio…' : '🖨 Test via pool'}
                  </button>
                </div>
                <select
                  value={optionValues.has(rows[area] ?? '') ? (rows[area] ?? '') : ''}
                  onChange={(e) =>
                    setRows((prev) => ({ ...prev, [area]: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded border border-border text-sm bg-white"
                >
                  <option value="">— Seleziona stampante (QZ o rete) —</option>
                  {targetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {!isGoAgent && (
                  <label className="block text-[10px] text-text-muted">
                    Nome QZ Tray manuale
                    <input
                      value={rows[area]?.startsWith('qz:') ? rows[area].slice(3) : (rows[area] ?? '')}
                      onChange={(e) => setRows((prev) => ({ ...prev, [area]: e.target.value }))}
                      placeholder="es. EPSON TM-T88V"
                      className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white font-mono"
                    />
                  </label>
                )}
                {isGoAgent && targetOptions.length === 0 && (
                  <p className="text-[10px] text-amber-700">
                    Nessuna stampante rilevata. Avvia QZ Tray sul POS, oppure usa
                    &quot;Scansiona rete&quot; sulla card del bridge per cercare stampanti di rete.
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <footer className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={saving || claimedAreas.length === 0 || !allMappingsValid}
            className="px-4 py-2 rounded bg-primary text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva mappings'}
          </button>
        </footer>
      </div>
    </div>
  );
}
