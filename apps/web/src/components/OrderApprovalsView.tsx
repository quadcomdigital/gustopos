import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GroupOrderReviewQueueEntry } from '@gustopos/shared';
import { fetchOrderDrafts, reviewOrderDraft } from '../shared/api/client';

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

const REFRESH_MS = 20_000;

const SOURCE_LABEL: Record<GroupOrderReviewQueueEntry['source'], string> = {
  group_order: 'Ordine di gruppo',
  takeaway: 'Asporto online',
};

type LinesByParticipant = Map<string, { name: string; lines: GroupOrderReviewQueueEntry['items'] }>;

function groupByParticipant(entry: GroupOrderReviewQueueEntry): LinesByParticipant {
  const map: LinesByParticipant = new Map();
  for (const line of entry.items) {
    const key = line.participantId ?? 'unknown';
    const group = map.get(key) ?? { name: line.participantName ?? 'Senza nome', lines: [] };
    group.lines.push(line);
    map.set(key, group);
  }
  return map;
}

/**
 * Staff approval inbox for EVERY public draft still waiting: group orders and
 * public takeaway orders alike.
 *
 * A submitted draft is not a real order yet — nothing is printed, deducted or
 * sent to the kitchen until someone approves it here, and only then does it
 * reach the POS. The list refreshes on a timer because a guest can submit at any
 * moment: the alternative (pushing drafts over realtime) would leak unapproved
 * orders into the POS/kitchen feeds.
 */
export default function OrderApprovalsView() {
  const [entries, setEntries] = useState<GroupOrderReviewQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setEntries(await fetchOrderDrafts());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Caricamento ordini non riuscito');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const decide = async (orderId: string, action: 'approve' | 'reject', reason?: string) => {
    setBusyId(orderId);
    setError('');
    try {
      await reviewOrderDraft(orderId, action === 'reject' ? { action, reason } : { action });
      setRejectingId('');
      setRejectReason('');
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Operazione non riuscita');
    } finally {
      setBusyId('');
    }
  };

  const total = useMemo(() => entries.reduce((sum, entry) => sum + entry.order.total, 0), [entries]);

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Caricamento ordini da approvare…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Ordini da approvare</h1>
          <p className="text-sm text-text-muted">
            Gli ordini inviati online restano in bozza: stampa, scarico e conto partono solo dopo l&apos;approvazione.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-[40px] rounded-lg border border-border px-3 text-xs font-bold uppercase tracking-widest"
        >
          Aggiorna
        </button>
      </header>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-6 text-center text-sm text-text-muted">
          Nessun ordine in attesa di approvazione.
        </div>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {entries.length} in attesa · totale {formatEuro(total)}
          </p>
          {entries.map((entry) => {
            const grouped = groupByParticipant(entry);
            const busy = busyId === entry.order.id;
            const isGroupOrder = entry.source === 'group_order';
            return (
              <section key={entry.order.id} className="rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-bold">{entry.order.ticketNumber ?? entry.order.id}</p>
                    <p className="text-xs text-text-muted">
                      <span className="font-semibold uppercase tracking-widest">{SOURCE_LABEL[entry.source]}</span>
                      {entry.order.customerName ? ` · ${entry.order.customerName}` : ''}
                      {entry.order.customerPhone ? ` · ${entry.order.customerPhone}` : ''}
                    </p>
                  </div>
                  <strong className="tabular-nums">{formatEuro(entry.order.total)}</strong>
                </div>

                <div className="mt-3 space-y-3">
                  {isGroupOrder ? (
                    [...grouped.entries()].map(([participantId, group]) => (
                      <div key={participantId}>
                        <p className="text-xs font-bold uppercase tracking-widest text-text-muted">{group.name}</p>
                        <ul className="mt-1 space-y-1">
                          {group.lines.map((line) => (
                            <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                              <span>
                                {line.quantity}× {line.name}
                                {line.ingredientOverrideLabels.length > 0 && (
                                  <span className="font-semibold text-amber-700">
                                    {' '}
                                    ({line.ingredientOverrideLabels.join(', ')})
                                  </span>
                                )}
                                {line.selectedModifiers.length > 0 && (
                                  <span className="text-text-muted"> · {line.selectedModifiers.length} modificatori</span>
                                )}
                              </span>
                              <span className="tabular-nums text-text-muted">{formatEuro(line.price * line.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <ul className="space-y-1">
                      {entry.items.map((line) => (
                        <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span>
                            {line.quantity}× {line.name}
                            {line.ingredientOverrideLabels.length > 0 && (
                              <span className="font-semibold text-amber-700">
                                {' '}
                                ({line.ingredientOverrideLabels.join(', ')})
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-text-muted">{formatEuro(line.price * line.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {entry.order.notes && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="font-bold uppercase tracking-widest">Nota ordine</span> · {entry.order.notes}
                  </p>
                )}

                {rejectingId === entry.order.id ? (
                  <div className="mt-4 space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Motivo del rifiuto (opzionale)"
                      rows={2}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectingId('')}
                        className="min-h-[40px] flex-1 rounded-lg border border-border text-xs font-bold uppercase tracking-widest"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(entry.order.id, 'reject', rejectReason.trim() || undefined)}
                        className="min-h-[40px] flex-1 rounded-lg bg-rose-600 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                      >
                        Conferma rifiuto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRejectingId(entry.order.id);
                        setRejectReason('');
                      }}
                      className="min-h-[44px] flex-1 rounded-lg border border-border text-xs font-bold uppercase tracking-widest disabled:opacity-50"
                    >
                      Rifiuta
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(entry.order.id, 'approve')}
                      className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      {busy ? 'Invio…' : 'Approva e stampa'}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
