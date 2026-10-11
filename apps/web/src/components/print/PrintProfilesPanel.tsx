import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PrintBridge,
  PrintProfile,
  PrintProfileActivateResponse,
  PrintProfileBridge,
  PrintProfileUpdateRequest,
} from '@gustopos/shared';
import { useAppStore } from '../../store/app-store';
import { usePrintStations } from '../inventory/usePrintStations';
import { filterLegacyAreas } from './legacy-areas';
import { findClaimedStationConflicts, findLiveBridge } from './print-profile-utils';
import PrintProfileEditorModal from './PrintProfileEditorModal';
import Button from '../../shared/ui/atoms/Button';
import SectionHeader from '../../shared/ui/molecules/SectionHeader';
import { Pencil, Play, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';

// ─── Pure view helpers (no DB, no network) ────────────────────────────────

type Routable = {
  mappings?: PrintBridge['mappings'];
  claimedAreas?: string[];
};

/** Pairs each profile entry with its live bridge; entries without one are
 *  reported separately as "missing", never as a routing divergence. */
function comparableBridges(
  profile: PrintProfile,
  bridges: readonly PrintBridge[],
): Array<{ snapshot: PrintProfileBridge; live: PrintBridge }> {
  return profile.bridges.flatMap((entry) => {
    const live = findLiveBridge(entry, bridges);
    return live ? [{ snapshot: entry, live }] : [];
  });
}

function routingKeys(source: Routable): string[] {
  const keys: string[] = [];
  for (const mapping of source.mappings ?? []) {
    keys.push(`map|${mapping.area ?? ''}|${mapping.ip ?? ''}:${mapping.port ?? ''}|${mapping.name}`);
  }
  for (const area of filterLegacyAreas(source.claimedAreas ?? [])) {
    keys.push(`area|${area}`);
  }
  return keys.sort();
}

/** True when the live routing no longer matches what the profile would apply. */
function isProfileDirty(profile: PrintProfile, bridges: readonly PrintBridge[]): boolean {
  const pairs = comparableBridges(profile, bridges);
  const snapshot = pairs.flatMap(({ snapshot: entry }) => routingKeys(entry)).sort();
  const live = pairs.flatMap(({ live: bridge }) => routingKeys(bridge)).sort();
  return JSON.stringify(snapshot) !== JSON.stringify(live);
}

/**
 * Where the ACTIVE configuration stands relative to the live routing.
 *
 * The configuration is the source of truth, so a mismatch always means one of
 * two OPPOSITE things and they need opposite copy:
 *  - `pending` → the configuration was saved AFTER the last activation (the
 *                 usual case): the live is behind, press Attiva to make it
 *                 count;
 *  - `drift`   → the live routing changed OUTSIDE the configuration (API or
 *                 integration): press Attiva to put the configuration back in
 *                 charge.
 *
 * Content comparison alone cannot tell them apart; `profile.updatedAt` vs the
 * activation timestamp (`activeAt`) can. Bridge timestamps cannot — every
 * heartbeat rewrites them.
 *
 * `inactive` = not the active configuration, so there is nothing to report.
 */
type ProfileApplyStatus = 'inactive' | 'applied' | 'pending' | 'drift';

function profileApplyStatus(
  profile: PrintProfile,
  activeId: string | null,
  activeAt: string | null,
  bridges: readonly PrintBridge[],
): ProfileApplyStatus {
  if (profile.id !== activeId) return 'inactive';
  if (!isProfileDirty(profile, bridges)) return 'applied';

  const applied = activeAt ? Date.parse(activeAt) : NaN;
  // Activation time unknown (state written before we tracked it): the safe,
  // actionable call is "apply it again", not a drift alarm.
  if (!Number.isFinite(applied)) return 'pending';

  const saved = Date.parse(profile.updatedAt);
  if (!Number.isFinite(saved)) return 'drift';
  return saved > applied ? 'pending' : 'drift';
}

function missingBridges(profile: PrintProfile, bridges: readonly PrintBridge[]): PrintProfileBridge[] {
  return profile.bridges.filter((entry) => findLiveBridge(entry, bridges) === null);
}

/** Unique stations the profile would make its bridges claim. */
function profileStationCount(profile: PrintProfile): number {
  const ids = new Set(profile.bridges.flatMap((entry) => filterLegacyAreas(entry.claimedAreas ?? [])));
  return ids.size;
}

/** A station claimed by two bridges (live pool): pending jobs would race. */
function findOverlaps(bridges: readonly PrintBridge[]) {
  return findClaimedStationConflicts(
    bridges.map((bridge) => ({ bridgeId: bridge.id, claimedAreas: bridge.claimedAreas })),
  );
}

function describeActivation(
  profileName: string,
  result: PrintProfileActivateResponse,
  stationName: Map<string, string>,
): { tone: 'ok' | 'warn'; lines: string[] } {
  const lines: string[] = [];
  if (result.missing.length > 0) {
    lines.push(
      `Bridge non più presenti e ignorati: ${result.missing.map((entry) => entry.label ?? entry.bridgeId).join(', ')}.`,
    );
  }
  if (result.skipped.length > 0) {
    lines.push(
      `Bridge senza routing nel profilo lasciati invariati: ${result.skipped.map((entry) => entry.label ?? entry.bridgeId).join(', ')}.`,
    );
  }
  for (const dropped of result.droppedStations) {
    lines.push(
      `${dropped.label ?? dropped.bridgeId}: stazioni non più attive ignorate: ${dropped.stationIds
        .map((id) => stationName.get(id) ?? id)
        .join(', ')}.`,
    );
  }
  for (const overlap of result.overlaps) {
    lines.push(
      `Stazione "${stationName.get(overlap.stationId) ?? overlap.stationId}" assegnata a ${overlap.bridgeIds.length} bridge: i job in coda potrebbero andare a un bridge a caso.`,
    );
  }
  return {
    tone: lines.length > 0 ? 'warn' : 'ok',
    lines: [
      `Configurazione "${profileName}" attivata su ${result.applied.length} bridge.`,
      ...(result.applied.length > 0
        ? ['✅ Applicata: gli agenti la riceveranno al prossimo heartbeat.']
        : []),
      ...lines,
    ],
  };
}

// ─── Panel ────────────────────────────────────────────────────────────────

/** Busy key for the inline "save current state as new profile" form. */
const CREATE_KEY = '__create__';

/**
 * A brand-new configuration. It is persisted ONLY when the editor saves, and
 * until then it exists nowhere but in the editor — building one requires no
 * live bridge, because its printer addresses come from the acquired registry.
 */
const BLANK_PROFILE: PrintProfile = {
  id: '',
  name: '',
  bridges: [],
  createdAt: '',
  updatedAt: '',
};

interface PrintProfilesPanelProps {
  /**
   * A bridge card handed a bridge over ("Modifica nella configurazione").
   * The panel opens the ACTIVE configuration focused on that bridge's entry;
   * with no active configuration it opens the create form and explains why.
   */
  focusRequest?: { bridgeId: string } | null;
  onFocusRequestHandled?: () => void;
}

export default function PrintProfilesPanel({
  focusRequest,
  onFocusRequestHandled,
}: PrintProfilesPanelProps) {
  const printProfiles = useAppStore((state) => state.printProfiles);
  const printBridges = useAppStore((state) => state.printBridges);
  const refreshPrintBridges = useAppStore((state) => state.refreshPrintBridges);
  const refreshPrintProfiles = useAppStore((state) => state.refreshPrintProfiles);
  const createPrintProfile = useAppStore((state) => state.createPrintProfile);
  const updatePrintProfile = useAppStore((state) => state.updatePrintProfile);
  const deletePrintProfile = useAppStore((state) => state.deletePrintProfile);
  const activatePrintProfile = useAppStore((state) => state.activatePrintProfile);
  const deactivatePrintProfile = useAppStore((state) => state.deactivatePrintProfile);
  const { stations } = usePrintStations();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editing, setEditing] = useState<PrintProfile | null>(null);
  const [focusBridgeId, setFocusBridgeId] = useState<string | null>(null);
  const [confirmActivateId, setConfirmActivateId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn'; lines: string[] } | null>(null);

  const stationName = useMemo(() => new Map(stations.map((station) => [station.id, station.name])), [stations]);
  // Dirty/overlap checks compare profiles against the live pool, so they are
  // meaningless until the bridges have been fetched at least once.
  const bridgesLoaded = printBridges.length > 0;
  const overlaps = useMemo(
    () => (bridgesLoaded ? findOverlaps(printBridges) : []),
    [bridgesLoaded, printBridges],
  );

  useEffect(() => {
    let alive = true;
    void Promise.all([refreshPrintProfiles(), refreshPrintBridges()]).finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [refreshPrintBridges, refreshPrintProfiles]);

  // A bridge card asked to edit its routing: the configuration is the only
  // writer, so open it (focused on that bridge) — or start the first one.
  useEffect(() => {
    if (!focusRequest) return;
    const active = printProfiles.profiles.find((profile) => profile.id === printProfiles.activeId);
    if (active) {
      setNotice(null);
      setFocusBridgeId(focusRequest.bridgeId);
      setEditing(active);
    } else {
      setCreating(true);
      setNotice({
        tone: 'warn',
        lines: [
          'Nessuna configurazione attiva: creane una con «Nuova configurazione» (o salva quella corrente) — da lì si scelgono stazioni e stampanti di ogni zona, anche a bridge spenti.',
        ],
      });
    }
    onFocusRequestHandled?.();
  }, [focusRequest, onFocusRequestHandled, printProfiles]);

  const run = useCallback(
    async (key: string | null, action: () => Promise<void>) => {
      setBusyId(key);
      setError('');
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Operazione fallita');
      } finally {
        setBusyId(null);
        setConfirmActivateId(null);
        setConfirmDeleteId(null);
      }
    },
    [],
  );

  const handleCreate = () =>
    run(CREATE_KEY, async () => {
      const description = newDescription.trim();
      await createPrintProfile({
        name: newName.trim(),
        ...(description ? { description } : {}),
      });
      setNewName('');
      setNewDescription('');
      setCreating(false);
      setNotice({
        tone: 'ok',
        lines: ['Configurazione salvata dallo stato attuale dei bridge.'],
      });
    });

  const handleActivate = (profile: PrintProfile) =>
    run(profile.id, async () => {
      const result = await activatePrintProfile(profile.id);
      setNotice(describeActivation(profile.name, result, stationName));
    });

  const handleSnapshot = (profile: PrintProfile) =>
    run(profile.id, async () => {
      await updatePrintProfile(profile.id, { snapshot: true });
      setNotice({
        tone: 'ok',
        lines: [`Configurazione "${profile.name}" aggiornata dallo stato attuale dei bridge.`],
      });
    });

  // The editor owns name + description + content: one editing surface, saved
  // atomically by a single PATCH (draft only — live changes on activation).
  const handleEditSave = async (profile: PrintProfile, payload: PrintProfileUpdateRequest) => {
    const name = (payload.name ?? profile.name).trim() || 'Configurazione';

    // COLD CREATE: content comes from the acquired-printer registry, so it is
    // persisted without touching any bridge — nothing goes live until "Attiva".
    if (!profile.id) {
      await createPrintProfile({
        name,
        ...(payload.description ? { description: payload.description } : {}),
        bridges: payload.bridges ?? [],
      });
      setEditing(null);
      setFocusBridgeId(null);
      setNotice({
        tone: 'ok',
        lines: [`Configurazione "${name}" creata. Non è ancora attiva: usa «Attiva» per applicarla.`],
      });
      return;
    }

    await updatePrintProfile(profile.id, payload);
    setEditing(null);
    setFocusBridgeId(null);
    setNotice({
      tone: 'ok',
      lines: [`Configurazione "${name}" aggiornata.`],
    });
  };

  const handleDelete = (profile: PrintProfile) =>
    run(profile.id, async () => {
      await deletePrintProfile(profile.id);
      setNotice({ tone: 'ok', lines: [`Configurazione "${profile.name}" eliminata.`] });
    });

  const handleDeactivate = () =>
    run(printProfiles.activeId, async () => {
      await deactivatePrintProfile();
      setNotice({
        tone: 'ok',
        lines: ['Nessuna configurazione attiva: il routing resta quello attuale.'],
      });
    });

  const profiles = printProfiles.profiles;
  const activeId = printProfiles.activeId;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <SectionHeader
        title="Configurazioni stampa"
        description="Fonte unica del routing: ogni configurazione salva quali zone stampa ogni bridge e con quale stampante. Una sola alla volta — attivarla riscrive il routing dei bridge coinvolti; le modifiche alle card bridge passano sempre da qui."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNotice(null);
                setCreating(false);
                setFocusBridgeId(null);
                setEditing(BLANK_PROFILE);
              }}
            >
              <Plus size={14} />
              Nuova configurazione
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCreating((value) => !value);
                setError('');
              }}
            >
              Salva configurazione corrente
            </Button>
          </div>
        }
      />

      <div className="p-4 space-y-3">
        {error && (
          <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">{error}</p>
        )}

        {notice && (
          <div
            className={`rounded border px-3 py-2 text-xs space-y-1 ${
              notice.tone === 'ok'
                ? 'border-success/30 bg-green-50 text-success'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            {notice.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="font-bold uppercase tracking-wider underline underline-offset-2"
            >
              Chiudi
            </button>
          </div>
        )}

        {overlaps.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
            <p className="font-bold uppercase tracking-wider">Stazione assegnata a più bridge</p>
            {overlaps.map((overlap) => (
              <p key={overlap.stationId}>
                {stationName.get(overlap.stationId) ?? overlap.stationId}: {overlap.bridgeIds.length} bridge.
                I job in coda potrebbero essere reclamati da uno qualsiasi.
              </p>
            ))}
          </div>
        )}

        {creating && (
          <div className="rounded-lg border border-border bg-gray-50 p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Nome (es. Servizio pranzo)"
                className="px-3 py-2 rounded border border-border text-sm"
              />
              <input
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Descrizione (opzionale)"
                maxLength={200}
                className="px-3 py-2 rounded border border-border text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={busyId === CREATE_KEY}
                disabled={busyId !== null || newName.trim().length === 0}
                onClick={() => void handleCreate()}
              >
                Salva
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Annulla
              </Button>
            </div>
            <p className="text-[11px] text-text-muted">
              Vengono salvati i bridge collegati in questo momento. La creazione non cambia il routing.
            </p>
          </div>
        )}

        <div className="divide-y divide-border border border-border rounded-lg">
          {loading && profiles.length === 0 && (
            <>
              <div className="px-3 py-3 space-y-2 animate-pulse">
                <div className="h-3 w-1/3 bg-gray-200 rounded" />
                <div className="h-3 w-1/2 bg-gray-100 rounded" />
              </div>
              <div className="px-3 py-3 space-y-2 animate-pulse">
                <div className="h-3 w-1/4 bg-gray-200 rounded" />
                <div className="h-3 w-2/5 bg-gray-100 rounded" />
              </div>
            </>
          )}

          {!loading && profiles.length === 0 && (
            <div className="px-4 py-6 text-center space-y-2">
              <p className="text-sm font-bold text-secondary uppercase tracking-wider">
                Nessuna configurazione salvata
              </p>
              <p className="text-xs text-text-muted max-w-[65ch] mx-auto leading-relaxed">
                Salva il routing attuale come prima configurazione (es. &laquo;Servizio pranzo&raquo;,
                &laquo;Asporto&raquo;) per poterlo riattivare con un clic quando cambia il servizio.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />
                Salva configurazione corrente
              </Button>
            </div>
          )}

          {profiles.map((profile) => {
            const isActive = profile.id === activeId;
            // Configuration = source of truth. `pending` (saved but not yet
            // applied) and `drift` (live changed outside) are OPPOSITE states
            // that only the activation timestamp can tell apart.
            const applyStatus = profileApplyStatus(
              profile,
              activeId,
              printProfiles.activeAt,
              printBridges,
            );
            const missing = bridgesLoaded ? missingBridges(profile, printBridges) : [];
            const stationCount = profileStationCount(profile);
            const conflicts = findClaimedStationConflicts(profile.bridges);
            const confirmingActivate = confirmActivateId === profile.id;
            const confirmingDelete = confirmDeleteId === profile.id;
            const busy = busyId === profile.id;

            return (
              <div key={profile.id} className="px-3 py-2.5 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-secondary truncate">{profile.name}</p>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full border border-accent/50 text-accent text-[10px] font-bold uppercase tracking-wider">
                          Attiva
                        </span>
                      )}
                      {applyStatus === 'applied' && (
                        <span className="px-2 py-0.5 rounded-full border border-success/50 text-success text-[10px] font-bold uppercase tracking-wider">
                          ✅ Applicata
                        </span>
                      )}
                      {applyStatus === 'pending' && (
                        <span
                          title="Salvata ma non ancora applicata ai bridge"
                          className="px-2 py-0.5 rounded-full border border-amber-400 text-amber-700 text-[10px] font-bold uppercase tracking-wider"
                        >
                          Da applicare
                        </span>
                      )}
                      {applyStatus === 'drift' && (
                        <span
                          title="Il routing dei bridge è cambiato fuori da questa configurazione"
                          className="px-2 py-0.5 rounded-full border border-danger/50 text-danger text-[10px] font-bold uppercase tracking-wider"
                        >
                          Drift live
                        </span>
                      )}
                      {conflicts.length > 0 && (
                        <span
                          title={conflicts
                            .map(
                              (conflict) =>
                                `${stationName.get(conflict.stationId) ?? conflict.stationId}: ${conflict.bridgeIds.length} bridge`,
                            )
                            .join(' · ')}
                          className="px-2 py-0.5 rounded-full border border-danger/50 text-danger text-[10px] font-bold uppercase tracking-wider tabular-nums"
                        >
                          {conflicts.length} conflitto{conflicts.length > 1 ? 'i' : ''}
                        </span>
                      )}
                      {missing.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full border border-border text-text-muted text-[10px] font-bold uppercase tracking-wider tabular-nums">
                          {missing.length} bridge assente
                        </span>
                      )}
                    </div>
                    {profile.description && (
                      <p className="text-[11px] text-text-muted mt-0.5">{profile.description}</p>
                    )}
                    <p className="text-[11px] text-text-muted tabular-nums mt-0.5">
                      {profile.bridges.length} bridge · {stationCount} stazioni · aggiornata{' '}
                      {new Date(profile.updatedAt).toLocaleDateString('it-IT')}
                    </p>
                    {applyStatus === 'pending' && (
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Salvata ma non ancora applicata: premi <strong>Attiva</strong> per farla
                        valere sui bridge.
                      </p>
                    )}
                    {applyStatus === 'drift' && (
                      <p className="text-[11px] text-danger mt-0.5">
                        Il routing dei bridge è cambiato fuori da questa configurazione
                        (API/integrazione): premi <strong>Attiva</strong> per rimetterla in carico.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
                    {confirmingDelete ? (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={busy}
                          onClick={() => void handleDelete(profile)}
                        >
                          Conferma elimina
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          Annulla
                        </Button>
                      </>
                    ) : confirmingActivate ? (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={busy}
                          onClick={() => void handleActivate(profile)}
                        >
                          Conferma attivazione
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmActivateId(null)}>
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <>
                        {isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            onClick={() => void handleDeactivate()}
                          >
                            <Power size={13} />
                            Disattiva
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={busy}
                            onClick={() => setConfirmActivateId(profile.id)}
                          >
                            <Play size={13} />
                            Attiva
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Modifica nome, descrizione, bridge associati e stampanti"
                          aria-label={`Modifica ${profile.name}`}
                          disabled={busy}
                          onClick={() => setEditing(profile)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          title="Aggiorna dallo stato attuale dei bridge"
                          loading={busy}
                          onClick={() => void handleSnapshot(profile)}
                        >
                          <RefreshCw size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Elimina"
                          disabled={busy}
                          onClick={() => setConfirmDeleteId(profile.id)}
                        >
                          <Trash2 size={13} className="text-danger" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {confirmingActivate && (
                  <div className="rounded border border-border bg-gray-50 px-3 py-2 text-[11px] text-text-muted space-y-1">
                    <p>
                      Verranno riscritti mapping e stazioni reclamate di{' '}
                      <strong>{profile.bridges.length} bridge</strong>. I job non ancora stampati
                      seguiranno la nuova configurazione.
                    </p>
                    {missing.length > 0 && (
                      <p className="text-amber-700">
                        Bridge del profilo non più presenti: {missing.map((entry) => entry.label ?? entry.bridgeId).join(', ')}.
                      </p>
                    )}
                    <p className="text-amber-700">
                      ⚠ Riscrive questa configurazione con il routing <strong>attuale</strong> dei
                      bridge: i contenuti salvati verranno sovrascritti (è il modo per riportare
                      dentro la configurazione una modifica avvenuta fuori).
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!loading && profiles.length > 0 && (
          <p className="text-[11px] text-text-muted">
            <strong>Modifica</strong> cambia nome, bridge associati, stazioni e stampanti senza
            toccare la stampa in servizio. <strong>Attiva</strong> riscrive il routing di tutti i
            bridge del profilo; <strong>Disattiva</strong> lascia il routing attuale invariato.
          </p>
        )}
      </div>

      {editing && (
        <PrintProfileEditorModal
          profile={editing}
          focusBridgeId={focusBridgeId}
          onClose={() => {
            setEditing(null);
            setFocusBridgeId(null);
          }}
          onSave={(payload) => handleEditSave(editing, payload)}
        />
      )}
    </div>
  );
}
