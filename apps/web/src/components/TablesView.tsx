import React, { useState, useMemo } from 'react';
import {
  AppData,
  SelfOrderSessionRotateResponse,
} from '@gustopos/shared';
import { cn } from '../lib/utils';
import { X, QrCode, Link as LinkIcon, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmDialog from './ConfirmDialog';

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
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [suspendTableNumber, setSuspendTableNumber] = useState<string | null>(null);
  const [resumeTableNumber, setResumeTableNumber] = useState<string | null>(null);
  const [suspendPreBill, setSuspendPreBill] = useState(true);
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);

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
    setActionError('');
    setActionBusy(true);
    try {
      const payload = await onRotateSelfOrderQr(tableId);
      setSelfOrderQr({ tableNumber: payload.tableNumber, url: payload.publicUrl, expiresAt: payload.expiresAt });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Rigenerazione QR non riuscita');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSuspendConfirmed = async (tableId: string) => {
    if (!onSuspendTable) return;
    setActionError('');
    setActionSuccess('');
    setActionBusy(true);
    try {
      await onSuspendTable(tableId, { printPreBill: suspendPreBill });
      setActionSuccess(suspendPreBill ? 'Conto sospeso · preconto inviato in cassa' : 'Conto sospeso');
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
                      <span className="text-xs font-bold text-primary tabular-nums">€{conto.total.toFixed(2)}</span>
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

      {/* Table Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 pr-2 pb-2">
        {visibleTables.map((table) => {
          const tableOrders = data.orders.filter(o => o.table === table.number && o.status !== 'paid' && o.status !== 'cancelled');
          const tableTotal = tableOrders.reduce((sum, o) => sum + o.total, 0);
          const isSuspended = table.status === 'suspended';
          const isOccupied = table.status === 'occupied';
          const isBusyCard = isOccupied || isSuspended;
          const statusLabel = isSuspended
            ? `Conto sospeso · €${tableTotal.toFixed(2)}`
            : isOccupied
              ? `€${tableTotal.toFixed(2)}`
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
              <button
                type="button"
                onClick={() => onSelectTable(table.number)}
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
                  className="absolute bottom-1.5 right-1.5 flex min-h-[36px] items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-warning-700 shadow-sm transition-colors hover:bg-warning-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
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
                  className="absolute bottom-1.5 right-1.5 flex min-h-[36px] items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-warning-700 shadow-sm transition-colors hover:bg-warning-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                  aria-label={`Riattiva conto tavolo ${table.number}`}
                >
                  Riattiva
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Suspend confirm — pre-bill print is opt-in here too */}
      <ConfirmDialog
        open={suspendTableNumber !== null}
        title="Sospendere il conto?"
        message={`Il tavolo ${suspendTableNumber ?? ''} verrà segnalato come "conto sospeso" e tornerà in evidenza finché non verrà incassato.${suspendPreBill ? ' Il preconto verrà inviato alla cassiera.' : ' Il preconto non verrà stampato.'}`}
        confirmLabel={suspendPreBill ? 'Sospendi e stampa' : 'Sospendi'}
        onConfirm={() => {
          const tableNumber = suspendTableNumber;
          setSuspendTableNumber(null);
          const table = data.tables.find((t) => t.number === tableNumber);
          if (table) void handleSuspendConfirmed(table.id);
        }}
        onCancel={() => setSuspendTableNumber(null)}
      />

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

      {/* Self-Order QR Info */}
      {selfOrderQr && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 shadow-lg">
            <p className="font-bold uppercase tracking-wider">Self Order QR</p>
            <p className="mt-1">Tavolo {selfOrderQr.tableNumber} · scade alle {new Date(selfOrderQr.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <a href={selfOrderQr.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 underline font-semibold">
              <LinkIcon size={12} />
              Apri link self-order
            </a>
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
          onClick={() => { setShowQrSheet(true); setQrSelectedTableId(orderedTables[0]?.id ?? ''); }}
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
                <button
                  onClick={() => {
                    if (!qrSelectedTableId) return;
                    void handleRotateSelfOrderQr(qrSelectedTableId);
                    setShowQrSheet(false);
                  }}
                  disabled={actionBusy || !qrSelectedTableId}
                  className="w-full py-3 min-h-[48px] bg-indigo-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <QrCode size={16} />
                  {actionBusy ? 'Rigenero...' : 'Genera QR'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
