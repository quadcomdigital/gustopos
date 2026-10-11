import { useCallback, useEffect, useState } from 'react';
import type { PrintStation, PrintStationKind, UiSettings } from '@gustopos/shared';
import {
  createPrintStation,
  deletePrintStation,
  fetchPrintStations,
  updatePrintStation,
} from '../../shared/api/client';
import Button from '../../shared/ui/atoms/Button';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import { Plus, Trash2, Star } from 'lucide-react';

interface PrintStationsManagerProps {
  /** Draft of the printing settings: the "which zones print" filter lives here. */
  draft: UiSettings;
  onSetDraft: React.Dispatch<React.SetStateAction<UiSettings>>;
  onSavePrinting: () => Promise<void>;
  savingSettings: boolean;
  printingSuccess: string;
}

/**
 * Section A · Zone di stampa — the zone registry (Cucina, Pizzeria, Bar, …).
 * Station ids route print jobs; products/categories are assigned to them in
 * Magazzino, printers are bound in the configuration, and which zones actually
 * print is chosen right here (one surface per concept).
 */
export default function PrintStationsManager({
  draft,
  onSetDraft,
  onSavePrinting,
  savingSettings,
  printingSuccess,
}: PrintStationsManagerProps) {
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<PrintStationKind>('production');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const setPrinting = (patch: Partial<UiSettings['printing']>) => {
    onSetDraft((prev) => ({ ...prev, printing: { ...prev.printing, ...patch } }));
  };

  // ── "Quali zone stampano" (settings.printing.activeStationIds) ────────────
  // EMPTY list = every active station (that is exactly how the API reads it at
  // ticket-creation time). Once something is deselected the list becomes
  // explicit, and it must never reach zero: [] already means "all", so "none
  // at all" is expressed by switching the protocol to Disattiva.
  const selectedZoneIds = draft.printing.activeStationIds;
  const allZonesMode = selectedZoneIds.length === 0;
  const knownZoneIds = new Set(stations.map((station) => station.id));
  const staleZoneIds = selectedZoneIds.filter((id) => !knownZoneIds.has(id));
  const printingZones = stations.filter(
    (station) => station.isActive && (allZonesMode || selectedZoneIds.includes(station.id)),
  );
  const activeZoneIds = stations.filter((station) => station.isActive).map((station) => station.id);

  const toggleZone = (zoneId: string) => {
    if (allZonesMode) {
      // Refining "all": start from the whole active set minus this zone.
      setPrinting({ activeStationIds: activeZoneIds.filter((id) => id !== zoneId) });
      return;
    }
    const exists = selectedZoneIds.includes(zoneId);
    if (exists && selectedZoneIds.length === 1) return; // [] would mean "all"
    setPrinting({
      activeStationIds: exists
        ? selectedZoneIds.filter((id) => id !== zoneId)
        : [...selectedZoneIds, zoneId],
    });
  };

  const zonePillClass = (active: boolean) =>
    `px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
      active ? 'bg-accent text-white border-accent' : 'bg-white text-secondary border-border'
    }`;

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
      <SectionHeader title="Zone di stampa" />
      <div className="p-4 space-y-3">
        {error && (
          <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
        )}
        <p className="text-[11px] text-text-muted">
          Le zone instradano i ticket: una zona per prodotto/categoria, assegnata in Magazzino. La
          stampante fisica si associa nella card del bridge, mentre <strong>quali zone stampano</strong>{' '}
          si sceglie in &laquo;Zone che stampano&raquo; più sotto.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome zona (es. Pizzeria)"
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
          {stations.map((station) => {
            const assignedProducts = station.usage?.menuItems ?? 0;
            const assignedCategories = station.usage?.categories ?? 0;
            const assignedTotal = assignedProducts + assignedCategories;
            const confirming = confirmingId === station.id;
            return (
            <div key={station.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <input
                defaultValue={station.name}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== station.name) void patch(station.id, { name: value });
                }}
                className="flex-1 min-w-[140px] px-2 py-1.5 rounded border border-border text-sm"
              />
              <span
                title={
                  assignedTotal > 0
                    ? `${assignedProducts} prodotti e ${assignedCategories} categorie stampano su questa zona (assegnati in Magazzino)`
                    : 'Nessun prodotto o categoria assegnato: questa zona non riceverà articoli'
                }
                className={`text-[10px] font-bold uppercase tracking-wider tabular-nums ${
                  assignedTotal > 0 ? 'text-text-muted' : 'text-amber-700'
                }`}
              >
                {assignedTotal > 0
                  ? `${assignedProducts} prod. · ${assignedCategories} cat.`
                  : 'vuota'}
              </span>
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
              {confirming ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] text-danger">
                    {assignedTotal > 0
                      ? `${assignedProducts} prodotti / ${assignedCategories} categorie perderanno la zona`
                      : 'Eliminare questa zona?'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingId(null);
                      void remove(station.id);
                    }}
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-danger text-white"
                  >
                    Sì, elimina
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-border"
                  >
                    Annulla
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => (assignedTotal > 0 ? setConfirmingId(station.id) : void remove(station.id))}
                  disabled={station.isDefault || saving}
                  title={
                    station.isDefault
                      ? 'La zona predefinita non può essere eliminata'
                      : assignedTotal > 0
                        ? 'Elimina (chiederà conferma: i prodotti/categorie assegnati perderanno la zona)'
                        : 'Elimina'
                  }
                  className="p-1.5 rounded border border-border text-danger disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            );
          })}
          {!loading && stations.length === 0 && (
            <p className="px-3 py-3 text-xs text-text-muted">Nessuna zona configurata.</p>
          )}
        </div>

        {/* ── Quali zone stampano (settings.printing.activeStationIds) ─── */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Zone che stampano
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPrinting({ activeStationIds: [] })}
              aria-pressed={allZonesMode}
              className={zonePillClass(allZonesMode)}
            >
              Tutte le zone attive
            </button>
            {stations.map((station) => {
              const active = allZonesMode || selectedZoneIds.includes(station.id);
              const locked = !allZonesMode && active && selectedZoneIds.length === 1;
              return (
                <button
                  key={station.id}
                  type="button"
                  disabled={!station.isActive || locked}
                  aria-pressed={active}
                  title={
                    !station.isActive
                      ? 'Zona inattiva: riattivala qui sopra'
                      : locked
                        ? 'Almeno una zona deve restare selezionata — oppure scegli "Tutte le zone attive"'
                        : undefined
                  }
                  onClick={() => toggleZone(station.id)}
                  className={`${zonePillClass(active)} ${!station.isActive || locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {station.name}
                  {station.kind === 'cashier' ? ' · cassa' : ''}
                </button>
              );
            })}
          </div>
          <p className="text-[11px]">
            {printingZones.length === 0 ? (
              <span className="text-danger font-bold">
                ⚠ Nessuna zona attiva selezionata: al salvataggio il filtro torna a &laquo;Tutte
                le zone attive&raquo;. Per non stampare nulla, spegni invece il Protocollo.
              </span>
            ) : (
              <span className="text-text-muted">
                Al salvataggio partirà un ticket per:{' '}
                <strong className="text-secondary">{printingZones.map((zone) => zone.name).join(' · ')}</strong>
              </span>
            )}
          </p>
          {staleZoneIds.length > 0 && (
            <p className="text-[11px] text-amber-700">
              {staleZoneIds.length} zona/e non più presente/i: verranno tolte al prossimo salvataggio.
            </p>
          )}
          <p className="text-[11px] text-text-muted">
            Vale per tutti i cassieri e decide <strong>quali ticket</strong> vengono creati, non{' '}
            <strong>dove</strong> vengono stampati: quello lo decidono le Configurazioni e i
            Collegamenti.
          </p>
          <div className="flex items-center gap-3 pt-1">
            {printingSuccess && <p className="text-xs text-success font-medium">{printingSuccess}</p>}
            <button
              type="button"
              onClick={() => void onSavePrinting()}
              disabled={savingSettings}
              className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {savingSettings ? 'Salvataggio...' : 'Salva zone attive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
