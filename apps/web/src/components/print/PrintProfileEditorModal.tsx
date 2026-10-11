import { useEffect, useMemo, useState } from 'react';
import type {
  PrintBridge,
  PrintProfile,
  PrintProfileBridge,
  PrintProfileUpdateRequest,
} from '@gustopos/shared';
import { useAppStore } from '../../store/app-store';
import { usePrintStations } from '../inventory/usePrintStations';
import { filterLegacyAreas } from './legacy-areas';
import { findClaimedStationConflicts, findLiveBridge } from './print-profile-utils';
import { usePrintEndpoints } from './usePrintEndpoints';
import {
  encodePrinterTarget,
  isGoAgent,
  parsePrinterTarget,
  printerTargetOptions,
  targetToMapping,
} from './printer-target-options';
import Button from '../../shared/ui/atoms/Button';
import { Plus, Trash2 } from 'lucide-react';

// ─── Draft model ──────────────────────────────────────────────────────────
//
// A configuration is edited as a DRAFT: nothing here reaches a bridge until
// the admin saves and then activates it. That is what makes a saved
// configuration reconfigurable whenever and however we want.

interface DraftEntry {
  key: string;
  bridgeId: string;
  instanceId: string | null;
  label: string;
  claimedAreas: string[];
  /** stationId → encoded target (`qz:<name>` / `net:<ip>:<port>`). */
  targets: Record<string, string>;
}

let keySeq = 0;
const nextKey = (bridgeId: string) => `${bridgeId}#${(keySeq += 1)}`;

function targetsFromMappings(
  mappings: PrintProfileBridge['mappings'] | PrintBridge['mappings'],
): Record<string, string> {
  const targets: Record<string, string> = {};
  for (const mapping of mappings ?? []) {
    if (typeof mapping.area === 'string' && mapping.area && !targets[mapping.area]) {
      targets[mapping.area] = encodePrinterTarget(mapping);
    }
  }
  return targets;
}

function seedEntries(profile: PrintProfile): DraftEntry[] {
  return profile.bridges.map((entry) => ({
    key: nextKey(entry.bridgeId),
    bridgeId: entry.bridgeId,
    instanceId: entry.instanceId ?? null,
    label: entry.label ?? entry.bridgeId,
    claimedAreas: filterLegacyAreas(entry.claimedAreas ?? []),
    targets: targetsFromMappings(entry.mappings),
  }));
}

/** New entries enter the profile seeded from that bridge's CURRENT routing. */
function seedFromLiveBridge(bridge: PrintBridge): DraftEntry {
  return {
    key: nextKey(bridge.id),
    bridgeId: bridge.id,
    instanceId: bridge.instanceId ?? null,
    label: bridge.name,
    claimedAreas: filterLegacyAreas(bridge.claimedAreas ?? []),
    targets: targetsFromMappings(bridge.mappings),
  };
}

interface PrintProfileEditorModalProps {
  profile: PrintProfile;
  /** Bridge handed over by its card: scroll its entry into view + highlight. */
  focusBridgeId?: string | null;
  onClose: () => void;
  onSave: (payload: PrintProfileUpdateRequest) => Promise<void>;
}

export default function PrintProfileEditorModal({
  profile,
  focusBridgeId,
  onClose,
  onSave,
}: PrintProfileEditorModalProps) {
  const printBridges = useAppStore((state) => state.printBridges);
  const { stations } = usePrintStations();
  // Acquired printers: the options source, so a zone can be bound to ip:port
  // even while its bridge is offline (cold build).
  const { endpoints } = usePrintEndpoints();

  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? '');
  const [entries, setEntries] = useState<DraftEntry[]>(() => seedEntries(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The card handed this bridge over: bring its entry into view. Layout can
  // still be settling (stations/bridges load async), hence the short delay.
  useEffect(() => {
    if (!focusBridgeId) return;
    const id = window.setTimeout(() => {
      document
        .getElementById(`print-profile-entry-${focusBridgeId}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(id);
  }, [focusBridgeId]);

  const stationName = useMemo(
    () => new Map(stations.map((station) => [station.id, station.name])),
    [stations],
  );
  const activeStations = useMemo(() => stations.filter((station) => station.isActive), [stations]);
  const activeStationIds = useMemo(
    () => new Set(activeStations.map((station) => station.id)),
    [activeStations],
  );

  // Draft conflicts: the same station claimed by two entries of THIS profile.
  const conflicts = useMemo(() => findClaimedStationConflicts(entries), [entries]);

  const missingEntries = useMemo(
    () => entries.filter((entry) => findLiveBridge(entry, printBridges) === null),
    [entries, printBridges],
  );

  // Claimed stations that would receive jobs with no printer to print them on.
  const unmappedTargets = useMemo(() => {
    const rows: string[] = [];
    for (const entry of entries) {
      for (const stationId of entry.claimedAreas) {
        if (!parsePrinterTarget(entry.targets[stationId] ?? '')) {
          rows.push(`${entry.label} → ${stationName.get(stationId) ?? stationId}`);
        }
      }
    }
    return rows;
  }, [entries, stationName]);

  const availableBridges = useMemo(() => {
    const represented = new Set(
      entries.map((entry) => findLiveBridge(entry, printBridges)?.id ?? entry.bridgeId),
    );
    return printBridges.filter((bridge) => !represented.has(bridge.id));
  }, [entries, printBridges]);

  const patchEntry = (key: string, patch: Partial<DraftEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    );
  };

  const toggleStation = (entry: DraftEntry, stationId: string) => {
    const exists = entry.claimedAreas.includes(stationId);
    patchEntry(entry.key, {
      claimedAreas: exists
        ? entry.claimedAreas.filter((id) => id !== stationId)
        : [...entry.claimedAreas, stationId],
    });
  };

  const handleAddBridge = (bridgeId: string) => {
    const bridge = printBridges.find((candidate) => candidate.id === bridgeId);
    if (!bridge) return;
    setEntries((prev) => [...prev, seedFromLiveBridge(bridge)]);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    setError('');
    try {
      const trimmedDescription = description.trim();
      const bridges: PrintProfileBridge[] = entries.map((entry) => ({
        bridgeId: entry.bridgeId,
        instanceId: entry.instanceId,
        ...(entry.label ? { label: entry.label } : {}),
        claimedAreas: entry.claimedAreas,
        // Only claimed stations can carry a target: an unclaimed mapping can
        // never be reached (jobs are bounded by claimedAreas).
        mappings: entry.claimedAreas.flatMap((stationId) => {
          const target = parsePrinterTarget(entry.targets[stationId] ?? '');
          return target ? [targetToMapping(stationId, target)] : [];
        }),
      }));
      await onSave({
        name: trimmedName,
        description: trimmedDescription ? trimmedDescription : null,
        bridges,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-3xl max-h-[92dvh] overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold uppercase tracking-wider text-secondary">
              {profile.id ? 'Modifica configurazione' : 'Nuova configurazione'}
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Nessuna modifica tocca la stampa in servizio: il routing cambia solo quando la
              configurazione viene <strong>attivata</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 shrink-0"
          >
            ✕ Chiudi
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          {conflicts.length > 0 && (
            <div className="rounded border border-danger/40 bg-red-50 px-3 py-2 text-xs text-danger space-y-1">
              <p className="font-bold uppercase tracking-wider">
                Stazione assegnata a più bridge
              </p>
              {conflicts.map((conflict) => (
                <p key={conflict.stationId}>
                  {stationName.get(conflict.stationId) ?? conflict.stationId}: attribuita a{' '}
                  {conflict.bridgeIds
                    .map(
                      (bridgeId) =>
                        entries.find((entry) => entry.bridgeId === bridgeId)?.label ?? bridgeId,
                    )
                    .join(', ')}
                  . I job in coda verrebbero reclamati da uno qualsiasi.
                </p>
              ))}
            </div>
          )}

          {unmappedTargets.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
              <p className="font-bold uppercase tracking-wider">Stazioni senza stampante</p>
              <p>
                {unmappedTargets.join(' · ')} — il bridge reclamerebbe la stazione ma non avrebbe
                dove stampare.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="print-profile-name"
                className="text-[10px] font-bold uppercase tracking-wider text-text-muted"
              >
                Nome
              </label>
              <input
                id="print-profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="print-profile-description"
                className="text-[10px] font-bold uppercase tracking-wider text-text-muted"
              >
                Descrizione
              </label>
              <input
                id="print-profile-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={200}
                placeholder="es. solo asporto, tavoli esterni"
                className="mt-1 w-full px-3 py-2 rounded border border-border text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Bridge associati ({entries.length})
              </p>
              <p className="text-[11px] text-text-muted">
                Scegli quali bridge compongono questa configurazione e cosa deve stampare ognuno.
              </p>
            </div>
            {availableBridges.length > 0 && (
              <div className="flex gap-2 items-center">
                <label htmlFor="print-profile-add-bridge" className="sr-only">
                  Aggiungi bridge
                </label>
                <select
                  id="print-profile-add-bridge"
                  defaultValue=""
                  onChange={(event) => {
                    const value = event.target.value;
                    event.target.value = '';
                    if (value) handleAddBridge(value);
                  }}
                  className="px-3 py-2 rounded border border-border text-sm max-w-[240px]"
                >
                  <option value="">— Aggiungi bridge dal pool —</option>
                  {availableBridges.map((bridge) => (
                    <option key={bridge.id} value={bridge.id}>
                      {bridge.name}
                      {bridge.host ? ` · ${bridge.host}` : ''}
                    </option>
                  ))}
                </select>
                <Plus size={16} className="text-text-muted" />
              </div>
            )}
          </div>

          {entries.length === 0 && (
            <div className="rounded border border-dashed border-border px-4 py-5 text-center space-y-2">
              <p className="text-sm font-bold text-secondary uppercase tracking-wider">
                Nessun bridge in questa configurazione
              </p>
              <p className="text-xs text-text-muted">
                Attivarla non cambierebbe nulla. Aggiungi almeno un bridge dal pool qui sopra.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {entries.map((entry) => {
              const live = findLiveBridge(entry, printBridges);
              const options = printerTargetOptions(live, endpoints);
              // A bridge we cannot see publishes no capability list: allow the
              // manual QZ name rather than pretending it is a Go agent.
              const goAgent = live ? isGoAgent(live) : false;
              const claimedInactive = entry.claimedAreas.filter((id) => !activeStationIds.has(id));

              return (
                <div
                  key={entry.key}
                  id={`print-profile-entry-${entry.bridgeId}`}
                  className={`rounded-lg border p-3 space-y-2 transition-shadow ${
                    focusBridgeId === entry.bridgeId
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-secondary truncate">
                          {live?.name ?? entry.label}
                        </p>
                        {!live && (
                          <span className="px-2 py-0.5 rounded-full border border-amber-400 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                            Non più presente
                          </span>
                        )}
                        {entry.claimedAreas.length === 0 && (
                          <span className="px-2 py-0.5 rounded-full border border-border text-text-muted text-[10px] font-bold uppercase tracking-wider">
                            Nessuna stazione
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted font-mono truncate">
                        {live?.host ?? entry.bridgeId}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Rimuovi il bridge dalla configurazione (non tocca il live)"
                      onClick={() => setEntries((prev) => prev.filter((item) => item.key !== entry.key))}
                    >
                      <Trash2 size={14} className="text-danger" />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {activeStations.map((station) => {
                      const checked = entry.claimedAreas.includes(station.id);
                      const hasConflict = conflicts.some(
                        (conflict) => conflict.stationId === station.id,
                      );
                      return (
                        <div
                          key={station.id}
                          className={`flex items-start gap-3 rounded border px-2 py-1.5 transition-colors ${
                            checked
                              ? hasConflict
                                ? 'border-danger/50 bg-red-50'
                                : 'border-primary/40 bg-primary/5'
                              : 'border-transparent hover:bg-gray-50'
                          }`}
                        >
                          <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStation(entry, station.id)}
                              className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-[13px] font-bold text-secondary">
                                {station.name}
                              </span>
                              <span className="block text-[10px] text-text-muted">
                                {station.kind === 'cashier' ? 'Cassa / fiscalisti' : 'Produzione'}
                              </span>
                            </span>
                          </label>
                          {checked && (
                            <div className="flex-1 min-w-[180px] space-y-1">
                              <label className="sr-only" htmlFor={`${entry.key}-${station.id}`}>
                                Stampante per {station.name}
                              </label>
                              <select
                                id={`${entry.key}-${station.id}`}
                                value={entry.targets[station.id] ?? ''}
                                onChange={(event) =>
                                  patchEntry(entry.key, {
                                    targets: { ...entry.targets, [station.id]: event.target.value },
                                  })
                                }
                                className="w-full px-2 py-1.5 rounded border border-border text-xs bg-white"
                              >
                                <option value="">— Seleziona stampante —</option>
                                {options.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {/* Manual QZ name: only when this bridge has no
                                  capability list or the target is a QZ name —
                                  never silently converted from a LAN target. */}
                              {!goAgent && !String(entry.targets[station.id] ?? '').startsWith('net:') && (
                                <input
                                  value={
                                    entry.targets[station.id]?.startsWith('qz:')
                                      ? (entry.targets[station.id] as string).slice(3)
                                      : (entry.targets[station.id] ?? '')
                                  }
                                  onChange={(event) =>
                                    patchEntry(entry.key, {
                                      targets: {
                                        ...entry.targets,
                                        [station.id]: event.target.value
                                          ? `qz:${event.target.value}`
                                          : '',
                                      },
                                    })
                                  }
                                  placeholder="Nome QZ Tray manuale"
                                  className="w-full px-2 py-1.5 rounded border border-border text-xs font-mono"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {claimedInactive.length > 0 && (
                      <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 space-y-1">
                        <p className="font-bold uppercase tracking-wider text-[10px]">
                          Stazioni non attive nel profilo
                        </p>
                        {claimedInactive.map((stationId) => (
                          <p key={stationId} className="flex items-center justify-between gap-2">
                            <span>
                              {stationName.get(stationId) ?? stationId} — verranno ignorate
                              all&apos;attivazione.
                            </span>
                            <button
                              type="button"
                              className="font-bold uppercase tracking-wider underline underline-offset-2"
                              onClick={() => toggleStation(entry, stationId)}
                            >
                              Togli
                            </button>
                          </p>
                        ))}
                      </div>
                    )}

                    {options.length === 0 && entry.claimedAreas.length > 0 && (
                      <p className="text-[10px] text-amber-700">
                        Nessuna stampante disponibile: acquisiscine una con &laquo;Scansiona
                        rete&raquo; nel blocco Collegamenti (o avvia QZ Tray sul PC).
                        {!goAgent && ' Puoi anche scrivere il nome manualmente qui sopra.'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {missingEntries.length > 0 && (
            <p className="text-[11px] text-amber-700">
              {missingEntries.length} bridge del profilo non sono più nel pool: restano salvati (con
              il loro nome) e verranno segnalati come <strong>assenti</strong> all&apos;attivazione.
            </p>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-text-muted">
            Salva la configurazione: la stampa in servizio cambia solo con <strong>Attiva</strong>.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Annulla
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={!name.trim()}
              onClick={() => void handleSave()}
            >
              {profile.id ? 'Salva configurazione' : 'Crea configurazione'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
