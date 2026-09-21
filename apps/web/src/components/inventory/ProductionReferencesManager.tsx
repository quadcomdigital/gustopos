import { useCallback, useEffect, useState } from 'react';
import type { ProductionReference } from '@gustopos/shared';
import {
  createProductionReference,
  deleteProductionReference,
  fetchProductionReferences,
  updateProductionReference,
} from '../../shared/api/client';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import Button from '../../shared/ui/atoms/Button';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Catalog of production containers/bases (BUN, Piadina, Panino, A piatto…).
 * Products/categories/modifiers are assigned to these; the RIEPILOGO block on
 * station tickets counts them so the kitchen can prep containers and assemble.
 */
export default function ProductionReferencesManager() {
  const [references, setReferences] = useState<ProductionReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReferences(await fetchProductionReferences());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento referenze fallito');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (newName.trim().length === 0) return;
    setSaving(true);
    setError('');
    try {
      await createProductionReference({ name: newName.trim() });
      setNewName('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creazione referenza fallita');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, payload: { name?: string; isActive?: boolean; sortOrder?: number }) => {
    setSaving(true);
    setError('');
    try {
      await updateProductionReference(id, payload);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aggiornamento referenza fallito');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await deleteProductionReference(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione referenza fallita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <SectionHeader title="Referenze di conteggio" />
      <div className="p-4 space-y-3">
        {error && (
          <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
        )}
        <p className="text-[11px] text-text-muted">
          I contenitori/basi (es. BUN, Piadina, Panino, A piatto) che la cucina deve preparare.
          Si assegnano per categoria, con override per prodotto o dal modifier principale. Il
          RIEPILOGO in stampa mostra solo questi conteggi.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome referenza (es. BUN, Piadina, A piatto)"
            className="px-3 py-2 rounded border border-border text-sm"
          />
          <Button variant="primary" onClick={() => void handleCreate()} disabled={saving || newName.trim().length === 0}>
            <Plus size={14} />
            Aggiungi
          </Button>
        </div>

        <div className="divide-y divide-border border border-border rounded-lg">
          {loading && references.length === 0 && (
            <p className="px-3 py-3 text-xs text-text-muted">Caricamento…</p>
          )}
          {references.map((reference) => (
            <div key={reference.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <input
                defaultValue={reference.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== reference.name) void patch(reference.id, { name: value });
                }}
                className="flex-1 min-w-[140px] px-2 py-1.5 rounded border border-border text-sm"
              />
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted">
                Ordine
                <input
                  type="number"
                  defaultValue={reference.sortOrder}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value) && value !== reference.sortOrder) void patch(reference.id, { sortOrder: value });
                  }}
                  className="w-16 px-2 py-1 rounded border border-border text-sm tabular-nums"
                />
              </label>
              <button
                type="button"
                onClick={() => void patch(reference.id, { isActive: !reference.isActive })}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${reference.isActive ? 'border-success/40 text-success' : 'border-border text-text-muted'}`}
              >
                {reference.isActive ? 'Attiva' : 'Inattiva'}
              </button>
              <button
                type="button"
                onClick={() => void remove(reference.id)}
                disabled={saving}
                title="Elimina"
                className="p-1.5 rounded border border-border text-danger disabled:opacity-30"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!loading && references.length === 0 && (
            <p className="px-3 py-3 text-xs text-text-muted">Nessuna referenza configurata.</p>
          )}
        </div>
      </div>
    </div>
  );
}
