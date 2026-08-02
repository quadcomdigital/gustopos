import { useEffect, useMemo, useState } from 'react';
import type {
  PrintArea,
  PrintBridge,
  PrintBridgePrinterMapping,
} from '@gustopos/shared';

interface BindBridgeMappingModalProps {
  bridge: PrintBridge;
  onClose: () => void;
  onSave: (mappings: PrintBridgePrinterMapping[]) => Promise<void>;
  onTestPrint: (area: PrintArea) => Promise<void>;
}

const AREA_LABELS: Record<PrintArea, string> = {
  kitchen: 'Cucina',
  bar: 'Bar',
  cashier: 'Cassa',
};

export default function BindBridgeMappingModal({
  bridge,
  onClose,
  onSave,
  onTestPrint,
}: BindBridgeMappingModalProps) {
  const claimedAreas = Array.isArray(bridge.claimedAreas)
    ? bridge.claimedAreas.filter((a): a is PrintArea =>
        a === 'kitchen' || a === 'bar' || a === 'cashier',
      )
    : [];
  const isGoAgent = typeof bridge.version === 'string' && bridge.version.startsWith('go-');
  const discoveredPrinterNames = useMemo(() => {
    const names = (Array.isArray(bridge.printers) ? bridge.printers : [])
      .map((printer) => printer.name.trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [bridge.printers]);

  const [rows, setRows] = useState<Record<PrintArea, string>>({
    kitchen: '',
    bar: '',
    cashier: '',
  });
  const [saving, setSaving] = useState(false);
  const [savingArea, setSavingArea] = useState<PrintArea | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Seed rows from existing mappings + claimedAreas (a bridge shouldn't claim an area without a printer).
  useEffect(() => {
    const next: Record<PrintArea, string> = { kitchen: '', bar: '', cashier: '' };
    for (const m of bridge.mappings ?? []) {
      if (m.area === 'kitchen' || m.area === 'bar' || m.area === 'cashier') {
        next[m.area] = m.name;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [bridge-sync] syncs rows from bridge.mappings prop; setters receive primitives derived from props
    setRows(next);
  }, [bridge.id, bridge.mappings]);

  // Require every claimed area to have a printer selected before Save becomes available.
  const allMappingsValid = useMemo(
    () => {
      const claimed = Array.isArray(bridge.claimedAreas)
        ? bridge.claimedAreas.filter((a): a is PrintArea =>
            a === 'kitchen' || a === 'bar' || a === 'cashier',
          )
        : [];
      return claimed.length > 0 && claimed.every((area) => {
        const selected = rows[area]?.trim() ?? '';
        if (!selected) return false;
        return !isGoAgent || discoveredPrinterNames.includes(selected);
      });
    },
    [bridge.claimedAreas, discoveredPrinterNames, isGoAgent, rows],
  );

  const printerOptions = useMemo(() => {
    // Go agents must use names discovered by QZ Tray. Legacy/browser bridges
    // retain the manual value as a backwards-compatible fallback.
    if (isGoAgent) return discoveredPrinterNames;
    const set = new Set<string>(discoveredPrinterNames);
    for (const v of Object.values(rows)) {
      if (v && v.trim()) set.add(v.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [discoveredPrinterNames, isGoAgent, rows]);

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const mappings: PrintBridgePrinterMapping[] = claimedAreas.map((area) => ({
        area,
        name: rows[area]?.trim() ?? '',
      }));
      await onSave(mappings);
      setSuccess('Mappings salvati.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (area: PrintArea) => {
    if (!rows[area]?.trim()) {
      setError(`${AREA_LABELS[area]}: seleziona una stampante prima di testare.`);
      return;
    }
    setSavingArea(area);
    setError('');
    try {
      await onTestPrint(area);
      setSuccess(`Test inviato per ${AREA_LABELS[area]}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test fallito');
    } finally {
      setSavingArea(null);
    }
  };

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

          {claimedAreas.length === 0 ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900">
              <strong>⚠️ Nessuna area reclamata.</strong> Apri prima{' '}
              <em>Aree reclamate</em> per assegnare almeno un'area (kitchen, bar, cashier),
              altrimenti il bridge non riceverà job.
            </div>
          ) : (
            claimedAreas.map((area) => (
              <div
                key={area}
                className="rounded-lg border border-border p-3 space-y-2 bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                    {AREA_LABELS[area]} ({area})
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
                  value={printerOptions.includes(rows[area] ?? '') ? (rows[area] ?? '') : ''}
                  onChange={(e) =>
                    setRows((prev) => ({ ...prev, [area]: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded border border-border text-sm bg-white"
                >
                  <option value="">— Seleziona stampante rilevata —</option>
                  {printerOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {!isGoAgent && (
                  <label className="block text-[10px] text-text-muted">
                    Nome QZ Tray manuale
                    <input
                      value={rows[area] ?? ''}
                      onChange={(e) => setRows((prev) => ({ ...prev, [area]: e.target.value }))}
                      placeholder="es. EPSON TM-T88V"
                      className="mt-1 w-full px-3 py-2 rounded border border-border text-sm bg-white font-mono"
                    />
                  </label>
                )}
                {isGoAgent && discoveredPrinterNames.length === 0 && (
                  <p className="text-[10px] text-amber-700">
                    Nessuna stampante rilevata da QZ Tray. Avvia QZ Tray sul POS e attendi il prossimo heartbeat.
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
