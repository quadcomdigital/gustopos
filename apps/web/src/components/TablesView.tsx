import React, { useState, useMemo, useEffect } from 'react';
import {
  AppData,
  GhostOrder,
  SelfOrderSessionRotateResponse,
  hasTenantOverride,
  formatCurrency,
} from '@gustopos/shared';
import { cn } from '../lib/utils';
import { X, QrCode, Link as LinkIcon, Receipt, Send, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmDialog from './ConfirmDialog';
import { useAppStore } from '../store/app-store';

interface TablesViewProps {
  data: AppData;
  onSelectTable: (tableNumber: string) => void;
  onRotateSelfOrderQr?: (tableId: string) => Promise<SelfOrderSessionRotateResponse>;
  onSelectOrder?: (orderId: string) => void;
  onSuspendTable?: (tableId: string, options: { printPreBill?: boolean }) => Promise<{ printed: boolean } | void>;
  onResumeTable?: (tableId: string) => Promise<void>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Nuovo',
  preparing: 'In prep',
  ready: 'Pronto',
  served: 'Ritirato',
};

const ORDER_STATUS_TONES: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
  served: 'bg-slate-100 text-slate-600',
};

function ghostAge(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'ora';
  return `${minutes} min`;
}

export default function TablesView({
  data,
  onSelectTable,
  onRotateSelfOrderQr,
  onSelectOrder,
  onSuspendTable,
  onResumeTable,
}: TablesViewProps) {
  const [showQrSheet, setShowQrSheet] = useState(false);
  const [qrSelectedTableId, setQrSelectedTableId] = useState('');
  const [selfOrderQr, setSelfOrderQr] = useState<{ tableNumber: string; url: string; expiresAt: string } | null>(null);
  const [qrError, setQrError] = useState('');
  const [qrGenerating, setQrGenerating] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [suspendTableNumber, setSuspendTableNumber] = useState<string | null>(null);
  const [resumeTableNumber, setResumeTableNumber] = useState<string | null>(null);
  const [suspendPreBill, setSuspendPreBill] = useState(true);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);

  // ─── Ghost orders (unsent waiter carts) ────────────────────────────────
  const ghostOrders = useAppStore((s) => s.ghostOrders);
  // Il preconto esiste solo se il modulo stampa è attivo: senza, non possiamo
  // promettere "Sospendi e stampa".
  const printingModuleEnabled = useAppStore((s) => s.enabledModules.includes('printing'));
  // Presenza POS (socket, cross-terminale): chi sta lavorando su quale tavolo.
  const posPresence = useAppStore((s) => s.posPresence);
  const currentUser = useAppStore((s) => s.currentUser);
  const tenantContext = useAppStore((s) => s.tenantContext);
  const refreshGhostOrders = useAppStore((s) => s.refreshGhostOrders);
  const commitGhostOrder = useAppStore((s) => s.commitGhostOrder);
  const discardGhostOrder = useAppStore((s) => s.discardGhostOrder);
  const ghostOrdersEnabled = useMemo(
    () => hasTenantOverride('ghostOrders', tenantContext?.tenantSlug, tenantContext?.tenantId),
    [tenantContext?.tenantSlug, tenantContext?.tenantId],
  );
  const canCommitGhosts =
    currentUser?.role === 'admin' || (currentUser?.permissions ?? []).includes('ghost_orders:commit');
  const [ghostConfirm, setGhostConfirm] = useState<{ ghost: GhostOrder; print: boolean } | null>(null);
  const [ghostDiscard, setGhostDiscard] = useState<GhostOrder | null>(null);
  const [ghostBusyId, setGhostBusyId] = useState<string | null>(null);
  const [expandedGhostId, setExpandedGhostId] = useState<string | null>(null);
  const [claimedTable, setClaimedTable] = useState<{ number: string; staffNames: string[] } | null>(null);

  useEffect(() => {
    if (ghostOrdersEnabled) void refreshGhostOrders();
  }, [ghostOrdersEnabled, refreshGhostOrders]);

  const handleCommitGhost = async () => {
    if (!ghostConfirm) return;
    const { ghost, print } = ghostConfirm;
    setGhostBusyId(ghost.id);
    setActionError('');
    try {
      await commitGhostOrder(ghost.id, {
        expectedVersion: ghost.version,
        expectedTotal: ghost.total,
        print,
      });
      setGhostConfirm(null);
      setActionSuccess(print ? 'Bozza inviata in cucina' : 'Bozza inviata senza stampa');
    } catch (error) {
      setGhostConfirm(null);
      setActionError(error instanceof Error ? error.message : 'Invio bozza non riuscito');
      void refreshGhostOrders();
    } finally {
      setGhostBusyId(null);
    }
  };

  const handleDiscardGhost = async () => {
    if (!ghostDiscard) return;
    setGhostBusyId(ghostDiscard.id);
    setActionError('');
    try {
      await discardGhostOrder(ghostDiscard.id, {
        expectedVersion: ghostDiscard.version,
        reason: 'Scartata dalla cassa',
      });
      setGhostDiscard(null);
      setActionSuccess('Bozza scartata');
    } catch (error) {
      setGhostDiscard(null);
      setActionError(error instanceof Error ? error.message : 'Scarto bozza non riuscito');
      void refreshGhostOrders();
    } finally {
      setGhostBusyId(null);
    }
  };

  React.useEffect(() => {
    if (!actionSuccess && !actionError) return;
    const handle = window.setTimeout(() => {
      setActionSuccess('');
      setActionError('');
    }, 4000);
    return () => window.clearTimeout(handle);
  }, [actionSuccess, actionError]);

  const orderedTables = useMemo(() => {
    return [...data.tables].filter((table) => !table.isVirtual).sort((a, b) => {
      const aNum = Number(a.number);
      const bNum = Number(b.number);
      const aIsNum = Number.isFinite(aNum);
      const bIsNum = Number.isFinite(bNum);
      if (aIsNum && bIsNum) return aNum - bNum;
      return a.number.localeCompare(b.number, 'it', { numeric: true, sensitivity: 'base' });
    });
  }, [data.tables]);

  // Zones present on this tenant's physical tables. Empty = the tenant has no
  // zone concept yet (e.g. franks) and the filter bar is not rendered at all.
  const zones = useMemo(() => {
    const set = new Set<string>();
    for (const table of orderedTables) {
      if (table.zone) set.add(table.zone);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' }));
  }, [orderedTables]);

  // Keep the selection valid when tables/zones change (e.g. zone edited away).
  const activeZone = zoneFilter !== null && zones.includes(zoneFilter) ? zoneFilter : null;

  const visibleTables = useMemo(() => {
    if (activeZone === null) return orderedTables;
    return orderedTables.filter((table) => table.zone === activeZone);
  }, [orderedTables, activeZone]);

  // Open takeaway/delivery "conti", grouped by their virtual table so multiple
  // sends (added items) collapse into a single card. Ordered by least-advanced
  // status first, then oldest, matching the kitchen "work remaining" view.
  const openConti = useMemo(() => {
    const statusRank: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3 };
    const byKey = new Map<string, {
      key: string;
      orderType: 'takeaway' | 'delivery';
      orderId: string;
      label: string;
      ticketNumber?: string;
      total: number;
      itemCount: number;
      status: string;
      timestamp: string;
    }>();

    for (const order of data.orders) {
      if (order.orderType !== 'takeaway' && order.orderType !== 'delivery') continue;
      if (order.status === 'paid' || order.status === 'cancelled') continue;
      const key = order.table ?? order.id;
      const existing = byKey.get(key);
      const orderStatus = order.status as string;
      if (!existing) {
        byKey.set(key, {
          key,
          orderType: order.orderType,
          orderId: order.id,
          label: order.customerName || order.ticketNumber || (order.orderType === 'takeaway' ? 'Asporto' : 'Consegna'),
          ticketNumber: order.ticketNumber,
          total: order.total,
          itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
          status: orderStatus,
          timestamp: order.timestamp,
        });
        continue;
      }
      existing.total += order.total;
      existing.itemCount += order.items.reduce((sum, item) => sum + item.quantity, 0);
      existing.status = (statusRank[orderStatus] ?? 0) < (statusRank[existing.status] ?? 0) ? orderStatus : existing.status;
      if (order.timestamp < existing.timestamp) {
        existing.timestamp = order.timestamp;
        existing.orderId = order.id;
        existing.label = order.customerName || existing.label;
      }
    }

    const all = [...byKey.values()];
    return {
      takeaway: all
        .filter((conto) => conto.orderType === 'takeaway')
        .sort((a, b) => (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0) || a.timestamp.localeCompare(b.timestamp)),
      delivery: all
        .filter((conto) => conto.orderType === 'delivery')
        .sort((a, b) => (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0) || a.timestamp.localeCompare(b.timestamp)),
    };
  }, [data.orders]);


  const handleRotateSelfOrderQr = async (tableId: string) => {
    if (!onRotateSelfOrderQr) return;
    // La generazione resta DENTRO la sheet: chiudendola subito l'operatore
    // vedeva solo un banner in basso per 4 secondi e non sapeva se il QR era
    // stato creato o se aveva sovrascritto quello precedente.
    setQrError('');
    setQrGenerating(true);
    try {
      const payload = await onRotateSelfOrderQr(tableId);
      setSelfOrderQr({ tableNumber: payload.tableNumber, url: payload.publicUrl, expiresAt: payload.expiresAt });
      setShowQrSheet(false);
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'Rigenerazione QR non riuscita');
    } finally {
      setQrGenerating(false);
    }
  };

  const handleSuspendConfirmed = async (tableId: string) => {
    if (!onSuspendTable) return;
    setActionError('');
    setActionSuccess('');
    setActionBusy(true);
    try {
      const printPreBill = suspendPreBill && printingModuleEnabled;
      await onSuspendTable(tableId, { printPreBill });
      setActionSuccess(printPreBill ? 'Conto sospeso · preconto inviato in cassa' : 'Conto sospeso');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Sospensione conto non riuscita');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResume = async (tableId: string) => {
    if (!onResumeTable) return;
    setActionError('');
    setActionSuccess('');
    setActionBusy(true);
    try {
      await onResumeTable(tableId);
      setActionSuccess('Conto riattivato');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Riattivazione conto non riuscita');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="relative flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Mappa Tavoli</h2>
        <p className="text-text-muted text-sm font-medium">Gestione occupazione</p>
      </div>

      {/* Asporti / Consegne — open non-dine-in conti (tap to open in Cassa) */}
      {onSelectOrder && (openConti.takeaway.length > 0 || openConti.delivery.length > 0) && (
        <div className="mb-6 space-y-3 shrink-0">
          {([
            { key: 'takeaway' as const, title: 'Asporti', conti: openConti.takeaway },
            { key: 'delivery' as const, title: 'Consegne', conti: openConti.delivery },
          ]).map(({ key, title, conti }) => conti.length === 0 ? null : (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">{title}</h3>
                <span className="text-[10px] font-bold min-w-4 h-4 px-1 rounded-full bg-accent text-white flex items-center justify-center">
                  {conti.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {conti.map((conto) => (
                  <button
                    key={conto.key}
                    onClick={() => onSelectOrder(conto.orderId)}
                    className="shrink-0 w-44 text-left bg-white border border-border rounded-xl p-3 active:scale-95 transition-all hover:border-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-secondary truncate">{conto.label}</span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', ORDER_STATUS_TONES[conto.status] ?? 'bg-bg text-text-muted')}>
                        {ORDER_STATUS_LABELS[conto.status] ?? conto.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted truncate">{conto.ticketNumber ?? '—'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-text-muted">{conto.itemCount} art.</span>
                      <span className="text-xs font-bold text-primary tabular-nums">{formatCurrency(conto.total)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone filter — only when this tenant actually has zoned tables */}
      {zones.length > 0 && (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto no-scrollbar px-1">
          <button
            type="button"
            onClick={() => setZoneFilter(null)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
              activeZone === null
                ? 'bg-primary text-white'
                : 'border border-border bg-white text-text-muted hover:border-accent'
            )}
          >
            Tutte
            <span className="ml-1.5 tabular-nums opacity-70">{orderedTables.length}</span>
          </button>
          {zones.map((zone) => {
            const count = orderedTables.filter((t) => t.zone === zone).length;
            const selected = activeZone === zone;
            return (
              <button
                key={zone}
                type="button"
                onClick={() => setZoneFilter(selected ? null : zone)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
                  selected
                    ? 'bg-accent text-white'
                    : 'border border-border bg-white text-text-muted hover:border-accent'
                )}
              >
                {zone}
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Unsent carts visible to the cashier/admin. The ghost is not an order:
          it never enters the table total and never prints until committed. */}
      {ghostOrdersEnabled && ghostOrders.length > 0 && (
        <section className="mb-4 rounded-xl border border-warning-700/20 bg-warning-50/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-warning-700">
              Bozze in sala
            </h2>
            <span className="rounded-full bg-warning-700 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
              {ghostOrders.length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ghostOrders.map((ghost) => {
              const busy = ghostBusyId === ghost.id;
              return (
                <article key={ghost.id} className="rounded-lg border border-warning-700/20 bg-white p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-secondary">
                        Tavolo {ghost.tableNumber} · {ghost.ownerStaffName ?? 'Cameriere'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-text-muted tabular-nums">
                        {ghost.itemCount} {ghost.itemCount === 1 ? 'articolo' : 'articoli'} · {formatCurrency(ghost.total)} · {ghostAge(ghost.updatedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-warning-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning-700">
                      Bozza
                    </span>
                  </div>
                  {/* Toggle esplicito invece di <details>: su tablet il summary
                      nativo ha un bersaglio piccolo e nessuno stato annunciato. */}
                  <button
                    type="button"
                    onClick={() => setExpandedGhostId(expandedGhostId === ghost.id ? null : ghost.id)}
                    aria-expanded={expandedGhostId === ghost.id}
                    aria-controls={`ghost-items-${ghost.id}`}
                    className="mt-1.5 flex min-h-[44px] w-full items-center justify-between gap-2 rounded px-1 text-left text-[11px] font-semibold text-text-muted hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span>{expandedGhostId === ghost.id ? 'Nascondi articoli' : 'Vedi articoli'}</span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={cn('transition-transform', expandedGhostId === ghost.id && 'rotate-180')}
                    />
                  </button>
                  {expandedGhostId === ghost.id && (
                    <ul id={`ghost-items-${ghost.id}`} className="mt-1 space-y-0.5">
                      {ghost.items.map((item) => (
                        <li key={item.cartItemId} className="flex justify-between gap-2 text-[10px] text-text-muted">
                          <span className="truncate">{item.quantity}× {item.name}</span>
                          <span className="shrink-0 tabular-nums">{formatCurrency(((item.basePrice + item.modifierPriceDelta) * item.quantity))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canCommitGhosts && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setGhostConfirm({ ghost, print: true })}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-accent px-2.5 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
                      >
                        <Send size={11} /> Invia
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setGhostConfirm({ ghost, print: false })}
                          className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-border bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted disabled:opacity-50"
                        >
                          Senza stampa
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setGhostDiscard(ghost)}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={11} /> Scarta
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Table Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pr-2 pb-2">
        {visibleTables.map((table) => {
          const tableOrders = data.orders.filter(o => o.table === table.number && o.status !== 'paid' && o.status !== 'cancelled');
          const tableTotal = tableOrders.reduce((sum, o) => sum + o.total, 0);
          const isSuspended = table.status === 'suspended';
          const isOccupied = table.status === 'occupied';
          const isBusyCard = isOccupied || isSuspended;
          const tableGhosts = ghostOrdersEnabled
            ? ghostOrders.filter((ghost) => ghost.tableId === table.id || ghost.tableNumber === table.number)
            : [];
          const tableGhostCount = tableGhosts.reduce((sum, ghost) => sum + ghost.itemCount, 0);
          const stations = posPresence.filter((entry) => entry.tableId === table.id);
          const stationLabel =
            stations.length === 0
              ? null
              : stations.length === 1
                ? `POS · ${stations[0].staffName}`
                : `POS · ${stations[0].staffName} +${stations.length - 1}`;
          const statusLabel = isSuspended
            ? `Conto sospeso · ${formatCurrency(tableTotal)}`
            : isOccupied
              ? `${formatCurrency(tableTotal)}`
              : 'Libero';
          return (
            <div
              key={table.id}
              className={cn(
                "group relative rounded-xl border transition-all h-32 flex flex-col items-center justify-center",
                isOccupied
                  ? "bg-accent border-accent shadow-sm"
                  : isSuspended
                    ? "bg-warning-700 border-warning-700 shadow-sm"
                    : "bg-white border-border hover:border-accent",
              )}
            >
              {tableGhostCount > 0 && (
                <span
                  className={cn(
                    "pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider tabular-nums shadow-sm",
                    isBusyCard ? "bg-white text-warning-700" : "bg-warning-50 text-warning-700",
                  )}
                >
                  Bozza {tableGhostCount}
                </span>
              )}
              {stationLabel && (
                <span
                  className={cn(
                    "pointer-events-none absolute right-1.5 top-1.5 z-10 inline-flex max-w-[80%] items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm",
                    isBusyCard ? "bg-white/95 text-accent" : "bg-accent/10 text-accent",
                  )}
                  title={`Postazione agganciata: ${stations.map((entry) => entry.staffName).join(', ')}`}
                >
                  {stationLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  // La presenza è solo un indicatore: se un'altra postazione sta
                  // già lavorando su questo tavolo, l'operatore deve saperlo
                  // prima di aprire lo stesso conto da qui.
                  if (stations.length > 0) {
                    setClaimedTable({ number: table.number, staffNames: stations.map((s) => s.staffName) });
                  } else {
                    onSelectTable(table.number);
                  }
                }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl px-3 pb-6 pt-3 text-center cursor-pointer active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label={`Apri tavolo ${table.number}, ${statusLabel}`}
              >
                <span
                  className={cn(
                    "font-bold text-2xl leading-none",
                    isBusyCard ? "text-white" : "text-secondary"
                  )}
                >
                  {table.number}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest tabular-nums",
                    isBusyCard ? "text-white" : "text-text-muted"
                  )}
                >
                  {statusLabel}
                </span>
              </button>

              {isOccupied && onSuspendTable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSuspendTableNumber(table.number);
                  }}
                  disabled={actionBusy}
                  className="absolute bottom-1.5 right-1.5 flex min-h-[44px] items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-warning-700 shadow-sm transition-colors hover:bg-warning-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                  aria-label={`Sospendi conto tavolo ${table.number}`}
                >
                  <Receipt size={12} />
                  Sospendi
                </button>
              )}

              {isSuspended && onResumeTable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setResumeTableNumber(table.number);
                  }}
                  disabled={actionBusy}
                  className="absolute bottom-1.5 right-1.5 flex min-h-[44px] items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-warning-700 shadow-sm transition-colors hover:bg-warning-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                  aria-label={`Riattiva conto tavolo ${table.number}`}
                >
                  Riattiva
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tavolo già in lavoro su un'altra postazione: avviso, non blocco. */}
      <ConfirmDialog
        open={claimedTable !== null}
        title="Tavolo già in lavoro"
        message={claimedTable ? `La postazione di ${claimedTable.staffNames.join(', ')} sta già lavorando sul tavolo ${claimedTable.number}. Aprirlo da qui può creare un conto doppio o sovrapporre gli articoli. Vuoi continuare comunque?` : ''}
        confirmLabel="Apri comunque"
        onConfirm={() => {
          const number = claimedTable?.number;
          setClaimedTable(null);
          if (number) onSelectTable(number);
        }}
        onCancel={() => setClaimedTable(null)}
      />

      {/* Suspend confirm — pre-bill print is opt-in here too */}
      <ConfirmDialog
        open={suspendTableNumber !== null}
        title="Sospendere il conto?"
        message={`Il tavolo ${suspendTableNumber ?? ''} verrà segnalato come "conto sospeso" e tornerà in evidenza finché non verrà incassato.${suspendPreBill && printingModuleEnabled ? ' Il preconto verrà inviato alla cassiera.' : ' Il preconto non verrà stampato.'}`}
        confirmLabel={suspendPreBill && printingModuleEnabled ? 'Sospendi e stampa' : 'Sospendi'}
        onConfirm={() => {
          const tableNumber = suspendTableNumber;
          setSuspendTableNumber(null);
          const table = data.tables.find((t) => t.number === tableNumber);
          if (table) void handleSuspendConfirmed(table.id);
        }}
        onCancel={() => setSuspendTableNumber(null)}
      >
        {printingModuleEnabled && (
          <button
            type="button"
            role="switch"
            aria-checked={suspendPreBill}
            onClick={() => setSuspendPreBill((value) => !value)}
            className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              suspendPreBill ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white text-text-muted'
            }`}
          >
            <span className="font-semibold">Stampa il preconto in cassa</span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                suspendPreBill ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  suspendPreBill ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        )}
      </ConfirmDialog>

      {/* Resume confirm */}
      <ConfirmDialog
        open={resumeTableNumber !== null}
        title="Riattivare il conto?"
        message={`Il tavolo ${resumeTableNumber ?? ''} tornerà allo stato operativo (occupato). L'evidenza "conto sospeso" verrà rimossa.`}
        confirmLabel="Riattiva"
        onConfirm={() => {
          const tableNumber = resumeTableNumber;
          setResumeTableNumber(null);
          const table = data.tables.find((t) => t.number === tableNumber);
          if (table) void handleResume(table.id);
        }}
        onCancel={() => setResumeTableNumber(null)}
      />

      {/* Ghost commit confirm */}
      <ConfirmDialog
        open={ghostConfirm !== null}
        title={ghostConfirm?.print === false ? 'Inviare la bozza senza stampa?' : 'Inviare la bozza in cucina?'}
        message={
          ghostConfirm
            ? `Tavolo ${ghostConfirm.ghost.tableNumber} · ${ghostConfirm.ghost.ownerStaffName ?? 'Cameriere'} · ${ghostConfirm.ghost.itemCount} articoli · ${formatCurrency(ghostConfirm.ghost.total)}.${ghostConfirm.print === false ? ' Nessun ticket verrà stampato: l’operazione è tracciata nell’audit.' : ''}`
            : ''
        }
        confirmLabel={ghostConfirm?.print === false ? 'Invia senza stampa' : 'Invia'}
        onConfirm={() => { void handleCommitGhost(); }}
        onCancel={() => setGhostConfirm(null)}
      />

      {/* Ghost discard confirm */}
      <ConfirmDialog
        open={ghostDiscard !== null}
        title="Scartare la bozza?"
        message={
          ghostDiscard
            ? `La bozza di ${ghostDiscard.ownerStaffName ?? 'cameriere'} per il tavolo ${ghostDiscard.tableNumber} verrà eliminata e il carrello del cameriere svuotato.`
            : ''
        }
        confirmLabel="Scarta"
        onConfirm={() => { void handleDiscardGhost(); }}
        onCancel={() => setGhostDiscard(null)}
      />

      {/* Self-Order QR Info */}
      {selfOrderQr && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 shadow-lg">
            <p className="font-bold uppercase tracking-wider">Self Order QR</p>
            <p className="mt-1">Tavolo {selfOrderQr.tableNumber} · scade alle {new Date(selfOrderQr.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a href={selfOrderQr.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline font-semibold">
                <LinkIcon size={12} />
                Apri link self-order
              </a>
              {/* Copiare il link serve a stamparlo o incollarlo nel messaggio al
                  cliente senza doverlo ricavare dall'indirizzo del browser. */}
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(selfOrderQr.url).then(() => {
                    setActionSuccess('Link self-order copiato');
                  }).catch(() => {
                    setActionError('Copia non riuscita: apri il link e copialo dalla barra degli indirizzi');
                  });
                }}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-indigo-300 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-indigo-700"
              >
                Copia link
              </button>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <p className="fixed bottom-20 left-0 right-0 z-40 px-4 text-center text-sm text-danger font-semibold" role="alert">{actionError}</p>
      )}
      {actionSuccess && (
        <p className="fixed bottom-20 left-0 right-0 z-40 px-4 text-center text-sm text-success font-semibold" role="status">{actionSuccess}</p>
      )}

      {/* Legend */}
      <div className="mt-8 pt-2 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-white border border-border" />
          <span className="text-xs font-medium text-text-muted">Libero</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-accent" />
          <span className="text-xs font-medium text-text-muted">Occupato</span>
        </div>
        {orderedTables.some((t) => t.status === 'suspended') && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-warning-700" />
            <span className="text-xs font-medium text-text-muted">Conto sospeso</span>
          </div>
        )}
      </div>

      {/* Floating QR Button */}
      {onRotateSelfOrderQr && (
        <button
          onClick={() => { setQrError(''); setShowQrSheet(true); setQrSelectedTableId(orderedTables[0]?.id ?? ''); }}
          className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Genera QR Self-Order"
        >
          <QrCode size={24} />
        </button>
      )}

      {/* QR Table Selector Sheet */}
      <AnimatePresence>
        {showQrSheet && onRotateSelfOrderQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-primary/40 backdrop-blur-sm"
            onClick={() => setShowQrSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-primary uppercase tracking-tight">Genera QR Self-Order</h3>
                <button
                  onClick={() => setShowQrSheet(false)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-bg rounded-full transition-colors text-text-muted"
                  aria-label="Chiudi"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <label className="block">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Seleziona Tavolo</span>
                  <select
                    value={qrSelectedTableId}
                    onChange={(e) => setQrSelectedTableId(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border text-sm min-h-[48px]"
                  >
                    {orderedTables.map((t) => (
                      <option key={t.id} value={t.id}>
                        Tavolo {t.number} {t.status === 'occupied' ? '(Occupato)' : t.status === 'suspended' ? '(Conto sospeso)' : '(Libero)'}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-semibold text-amber-800">
                  Il QR attuale del tavolo smette di funzionare appena ne generi uno nuovo: i clienti con la pagina già aperta dovranno ri-scansionare.
                </p>
                {qrError && (
                  <p className="rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs font-semibold text-danger" role="alert">
                    {qrError}
                  </p>
                )}
                <button
                  onClick={() => {
                    if (!qrSelectedTableId) return;
                    void handleRotateSelfOrderQr(qrSelectedTableId);
                  }}
                  disabled={qrGenerating || !qrSelectedTableId}
                  className="w-full py-3 min-h-[48px] bg-indigo-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <QrCode size={16} />
                  {qrGenerating ? 'Rigenero...' : 'Genera QR'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
