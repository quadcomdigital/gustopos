import { useEffect, useState } from 'react';
import type { PrintBridge } from '@gustopos/shared';
import { usePrintStations } from '../inventory/usePrintStations';
import { filterLegacyAreas, isLegacyAreaKey } from './legacy-areas';

interface ClaimedAreasModalProps {
  bridge: PrintBridge;
  onClose: () => void;
  onSave: (claimedAreas: string[]) => Promise<void>;
}

export default function ClaimedAreasModal({
  bridge,
  onClose,
  onSave,
}: ClaimedAreasModalProps) {
  const { stations } = usePrintStations();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const hadLegacyAreas = Array.isArray(bridge.claimedAreas)
    && bridge.claimedAreas.some((a) => isLegacyAreaKey(a));

  useEffect(() => {
    // Legacy enum keys cannot address a station: never seed them back into the
    // selection, otherwise "Salva" would persist them again.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [bridge-sync] syncs selected stations from bridge.claimedAreas prop
    setSelected(filterLegacyAreas(bridge.claimedAreas));
  }, [bridge.id, bridge.claimedAreas]);

  const toggle = (stationId: string) => {
    setSelected((prev) =>
      prev.includes(stationId) ? prev.filter((a) => a !== stationId) : [...prev, stationId],
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      setError('Seleziona almeno una stazione.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await onSave(selected);
      setSuccess('Stazioni salvate.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  const activeStations = stations.filter((s) => s.isActive);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-md overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider text-secondary">
              Stazioni reclamate
            </h3>
            <p className="text-[11px] text-text-muted">
              Bridge <span className="font-mono">{bridge.name}</span>. Scegli a quali code di
              stampa può attingere.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-2 flex-1">
          {error && (
            <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
          )}
          {success && (
            <p className="rounded border border-success/30 bg-green-50 px-3 py-2 text-xs text-success">{success}</p>
          )}
          {hadLegacyAreas && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Alcune aree legacy (kitchen/bar/cashier) sono state ignorate: non sono più
              valide. Seleziona le stazioni corrette e salva.
            </p>
          )}
          <p className="text-[11px] text-text-muted">
            Un bridge senza stazioni reclamate non riceverà alcun job.
          </p>
          {activeStations.length === 0 && (
            <p className="text-[11px] text-text-muted italic">Nessuna stazione configurata in Magazzino.</p>
          )}
          {activeStations.map((station) => {
            const checked = selected.includes(station.id);
            return (
              <label
                key={station.id}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(station.id)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-bold text-secondary">{station.name}</p>
                  <p className="text-[11px] text-text-muted">
                    {station.kind === 'cashier'
                      ? 'riceve scontrini di chiusura ed emissione fiscale (RT)'
                      : 'riceve job comande e ticket di cucina/bar'}
                  </p>
                </div>
              </label>
            );
          })}
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
            onClick={() => void handleSave()}
            disabled={saving || selected.length === 0}
            className="px-4 py-2 rounded bg-primary text-white text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva stazioni'}
          </button>
        </footer>
      </div>
    </div>
  );
}
