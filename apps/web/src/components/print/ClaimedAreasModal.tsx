import { useEffect, useState } from 'react';
import type { PrintArea, PrintBridge } from '@gustopos/shared';

interface ClaimedAreasModalProps {
  bridge: PrintBridge;
  onClose: () => void;
  onSave: (claimedAreas: PrintArea[]) => Promise<void>;
}

const AREA_DESCRIPTIONS: Record<PrintArea, string> = {
  kitchen: 'riceve job comande dalla cucina',
  bar: 'riceve job comande dal bar',
  cashier: 'riceve job scontrini di chiusura',
};

export default function ClaimedAreasModal({
  bridge,
  onClose,
  onSave,
}: ClaimedAreasModalProps) {
  const [selected, setSelected] = useState<PrintArea[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const sanitized = Array.isArray(bridge.claimedAreas)
      ? bridge.claimedAreas.filter((a): a is PrintArea =>
          a === 'kitchen' || a === 'bar' || a === 'cashier',
        )
      : [];
    setSelected(sanitized);
  }, [bridge.id, bridge.claimedAreas]);

  const toggle = (area: PrintArea) => {
    setSelected((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      setError('Seleziona almeno un\'area.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await onSave(selected);
      setSuccess('Aree salvate.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

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
              Aree reclamate
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
          <p className="text-[11px] text-text-muted">
            Un bridge senza aree reclamate non riceverà alcun job.
          </p>
          {(['kitchen', 'bar', 'cashier'] as PrintArea[]).map((area) => {
            const checked = selected.includes(area);
            return (
              <label
                key={area}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(area)}
                  className="mt-0.5 w-4 h-4 accent-primary"
                />
                <div>
                  <p className="text-sm font-bold text-secondary capitalize">{area}</p>
                  <p className="text-[11px] text-text-muted">{AREA_DESCRIPTIONS[area]}</p>
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
            {saving ? 'Salvataggio…' : 'Salva aree'}
          </button>
        </footer>
      </div>
    </div>
  );
}
