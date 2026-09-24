import { useCallback, useEffect, useState } from 'react';
import type { PrintStation, PrintStationKind } from '@gustopos/shared';
import {
  createPrintStation,
  deletePrintStation,
  fetchPrintStations,
  updatePrintStation,
} from '../../shared/api/client';
import Button from '../../shared/ui/atoms/Button';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import { Plus, Trash2, Star } from 'lucide-react';

/**
 * Print station registry (Cucina, Pizzeria, Bar, …). Station ids route print
 * jobs; products/categories are assigned to them in Magazzino. Printer binding
 * happens per-bridge in "Bridge di stampa".
 */
export default function PrintStationsManager() {
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<PrintStationKind>('production');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStations(await fetchPrintStations());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Caricamento stazioni fallito');
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
      await createPrintStation({ name: newName.trim(), kind: newKind });
      setNewName('');
      setNewKind('production');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creazione stazione fallita');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, payload: { name?: string; isActive?: boolean; isDefault?: boolean; kind?: PrintStationKind; ownItemsOnly?: boolean }) => {
    setSaving(true);
    setError('');
    try {
      await updatePrintStation(id, payload);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aggiornamento stazione fallito');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await deletePrintStation(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione stazione fallita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <SectionHeader title="Stazioni di stampa" />
      <div className="p-4 space-y-3">
        {error && (
          <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
        )}
        <p className="text-[11px] text-text-muted">
          Le stazioni instradano i ticket (una stazione per prodotto/categoria, decisa in Magazzino).
          La stampante fisica si associa nella card del bridge.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome stazione (es. Pizzeria)"
            className="px-3 py-2 rounded border border-border text-sm"
          />
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as PrintStationKind)}
            className="px-3 py-2 rounded border border-border text-sm"
          >
            <option value="production">Produzione</option>
            <option value="cashier">Cassa (ricevute)</option>
          </select>
          <Button variant="primary" onClick={() => void handleCreate()} disabled={saving || newName.trim().length === 0}>
            <Plus size={14} />
            Aggiungi
          </Button>
        </div>

        <div className="divide-y divide-border border border-border rounded-lg">
          {loading && stations.length === 0 && (
            <p className="px-3 py-3 text-xs text-text-muted">Caricamento…</p>
          )}
          {stations.map((station) => (
            <div key={station.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <input
                defaultValue={station.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== station.name) void patch(station.id, { name: value });
                }}
                className="flex-1 min-w-[140px] px-2 py-1.5 rounded border border-border text-sm"
              />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${station.kind === 'cashier' ? 'text-amber-600' : 'text-text-muted'}`}>
                {station.kind === 'cashier' ? 'Cassa' : 'Produzione'}
              </span>
              {station.isDefault ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                  <Star size={12} /> Predefinita
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void patch(station.id, { isDefault: true })}
                  className="text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-accent"
                >
                  Rendi predefinita
                </button>
              )}
              <button
                type="button"
                onClick={() => void patch(station.id, { isActive: !station.isActive })}
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${station.isActive ? 'border-success/40 text-success' : 'border-border text-text-muted'}`}
              >
                {station.isActive ? 'Attiva' : 'Inattiva'}
              </button>
              {station.kind === 'production' && (
                <button
                  type="button"
                  onClick={() => void patch(station.id, { ownItemsOnly: !station.ownItemsOnly })}
                  title={
                    station.ownItemsOnly
                      ? 'Stampa solo gli articoli di questa stazione'
                      : 'Stampa l\u2019intero ordine (articoli del reparto in grande)'
                  }
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${station.ownItemsOnly ? 'border-accent/50 text-accent' : 'border-border text-text-muted'}`}
                >
                  {station.ownItemsOnly ? 'Solo reparto' : 'Intero ordine'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void remove(station.id)}
                disabled={station.isDefault || saving}
                title={station.isDefault ? 'La stazione predefinita non può essere eliminata' : 'Elimina'}
                className="p-1.5 rounded border border-border text-danger disabled:opacity-30"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!loading && stations.length === 0 && (
            <p className="px-3 py-3 text-xs text-text-muted">Nessuna stazione configurata.</p>
          )}
        </div>
      </div>
    </div>
  );
}
