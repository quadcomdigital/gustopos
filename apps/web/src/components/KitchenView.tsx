import React from 'react';
import { Order, PrintArea, UpdateOrderRequest } from '@gustopos/shared';
import { CheckCircle2, PlayCircle, UtensilsCrossed, Layers3, X, Clock, Timer, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { trackUxMetric } from '../shared/ux/metrics';
import SegmentedChips from '../shared/ui/atoms/SegmentedChips';
import StatusPill from '../shared/ui/atoms/StatusPill';
import ContextToolbar from '../shared/ui/molecules/ContextToolbar';
import ConfirmDialog from './ConfirmDialog';
import { useAppStore } from '../store/app-store';

interface KitchenViewProps {
  orders: Order[];
  updateOrder: (id: string, updates: UpdateOrderRequest) => Promise<Order>;
}

type KitchenStatusFilter = 'all' | 'pending' | 'preparing' | 'ready';
type KitchenZoneFilter = 'all' | 'kitchen' | 'bar';

const PREP_BUFFER_MINUTES = 20;

function getNextStatus(status: Order['status']): Order['status'] | null {
  if (status === 'pending') return 'preparing';
  if (status === 'preparing') return 'ready';
  if (status === 'ready') return 'served';
  return null;
}

function getPrevStatus(status: Order['status']): Order['status'] | null {
  if (status === 'preparing') return 'pending';
  if (status === 'ready') return 'preparing';
  return null;
}

function getOrderAgeMinutes(timestamp: string): number {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
}

function getOrderAgeClass(timestamp: string, status: Order['status']): string {
  if (status === 'served' || status === 'paid' || status === 'cancelled') return '';
  const mins = getOrderAgeMinutes(timestamp);
  if (mins >= 15) return 'border-2 border-red-400 bg-red-50/30';
  if (mins >= 10) return 'border-2 border-amber-400';
  return '';
}

function isScheduled(order: Order): boolean {
  if (!order.scheduledFor) return false;
  if (order.status !== 'pending') return false;
  const etaMs = new Date(order.scheduledFor).getTime();
  const nowMs = Date.now();
  const bufferMs = PREP_BUFFER_MINUTES * 60_000;
  return etaMs - nowMs > bufferMs;
}

function _getScheduleCountdown(scheduledFor: string): string {
  const diffMs = new Date(scheduledFor).getTime() - Date.now();
  if (diffMs <= 0) return 'In scadenza';
  const mins = Math.floor(diffMs / 60_000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

function getPrepByTime(scheduledFor: string): Date {
  return new Date(new Date(scheduledFor).getTime() - PREP_BUFFER_MINUTES * 60_000);
}

function getOrderLabel(order: Order): { badge: string; title: string; subtitle?: string } {
  if (order.orderType === 'dine_in') {
    return {
      badge: order.table ?? '?',
      title: `Tavolo ${order.table}`,
    };
  }
  const typeLabel = order.orderType === 'takeaway' ? 'Asporto' : 'Delivery';
  const identifier = order.customerName || order.ticketNumber || typeLabel;
  return {
    badge: identifier.slice(0, 2).toUpperCase(),
    title: identifier,
    subtitle: order.ticketNumber ? `${typeLabel} · ${order.ticketNumber}` : typeLabel,
  };
}

function getStatusMeta(status: Order['status']) {
  if (status === 'pending') {
    return {
      pillTone: 'pending' as const,
      actionLabel: 'Inizia',
      actionIcon: <PlayCircle size={16} />,
      actionClassName: 'bg-accent active:bg-blue-800',
    };
  }
  if (status === 'preparing') {
    return {
      pillTone: 'info' as const,
      actionLabel: 'Pronto',
      actionIcon: <CheckCircle2 size={16} />,
      actionClassName: 'bg-success active:bg-green-800',
    };
  }
  return {
    pillTone: 'success' as const,
    actionLabel: 'Servito',
    actionIcon: <UtensilsCrossed size={16} />,
    actionClassName: 'bg-primary active:bg-secondary',
  };
}

function sortOrders(a: Order, b: Order): number {
  const aScheduled = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
  const bScheduled = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
  if (aScheduled && bScheduled) return aScheduled - bScheduled;
  if (aScheduled) return -1;
  if (bScheduled) return 1;
  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
}

export default function KitchenView({ orders, updateOrder }: KitchenViewProps) {
  const data = useAppStore((s) => s.data);
  const pendingOrders = orders.filter((o) => o.status !== 'served' && o.status !== 'paid' && o.status !== 'cancelled');
  const [statusFilter, setStatusFilter] = React.useState<KitchenStatusFilter>('all');
  const [zoneFilter, setZoneFilter] = React.useState<KitchenZoneFilter>('all');
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState('');
  const [isBatchMode, setIsBatchMode] = React.useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = React.useState<string[]>([]);
  const [batchBusy, setBatchBusy] = React.useState(false);
  const [pendingBatchState, setPendingBatchState] = React.useState<{ status: 'preparing' | 'ready' | 'served'; count: number } | null>(null);
  const [, forceUpdate] = React.useState(0);

  const inventoryById = React.useMemo(() => new Map((data?.inventory ?? []).map((e) => [e.id, e])), [data?.inventory]);
  const modifierOptionNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const mi of data?.menu ?? []) {
      for (const group of (mi.modifierGroups ?? []) as Array<{ id: string; options: Array<{ id: string; name: string }> }>) {
        for (const opt of group.options) {
          map.set(opt.id, opt.name);
        }
      }
    }
    return map;
  }, [data?.menu]);

  // Resolve which print areas (kitchen/bar) each menu item belongs to. Order
  // items expose their menuItemId as `id`, so we can classify every order row.
  const menuItemAreasById = React.useMemo(() => {
    const map = new Map<string, PrintArea[]>();
    for (const mi of data?.menu ?? []) {
      map.set(mi.id, mi.printAreas?.length ? mi.printAreas : ['kitchen']);
    }
    return map;
  }, [data?.menu]);

  // Per-order zone membership: an order is shown under a zone if at least one
  // of its items belongs to it (mixed tables appear in both Cucina and Bar).
  // Unmatched items fall back to kitchen, matching the print dispatch default.
  const orderZoneInfo = React.useMemo(() => {
    const info = new Map<string, { kitchen: boolean; bar: boolean }>();
    for (const order of orders) {
      let kitchen = false;
      let bar = false;
      for (const item of order.items) {
        const areas = menuItemAreasById.get(item.id) ?? ['kitchen'];
        if (areas.includes('kitchen')) kitchen = true;
        if (areas.includes('bar')) bar = true;
      }
      info.set(order.id, { kitchen, bar });
    }
    return info;
  }, [orders, menuItemAreasById]);

  const zoneCounts = React.useMemo(() => {
    let kitchen = 0;
    let bar = 0;
    for (const order of pendingOrders) {
      const zones = orderZoneInfo.get(order.id);
      if (zones?.kitchen) kitchen += 1;
      if (zones?.bar) bar += 1;
    }
    return { kitchen, bar };
  }, [pendingOrders, orderZoneInfo]);

  // Re-render every 30s to update countdowns and auto-advance
  React.useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const filteredOrders = pendingOrders
    .filter((order) => (statusFilter === 'all' ? true : order.status === statusFilter))
    .filter((order) => {
      if (zoneFilter === 'all') return true;
      const zones = orderZoneInfo.get(order.id);
      if (zoneFilter === 'kitchen') return zones?.kitchen ?? true;
      return zones?.bar ?? false;
    });

  const activeOrders = filteredOrders.filter((o) => !isScheduled(o)).sort(sortOrders);
  const scheduledOrders = filteredOrders.filter((o) => isScheduled(o)).sort(sortOrders);

  const selectedVisibleOrders = [...activeOrders, ...scheduledOrders].filter((order) => selectedOrderIds.includes(order.id));

  const clearSelection = () => setSelectedOrderIds([]);

  const toggleBatchMode = () => {
    setIsBatchMode((prev) => {
      const next = !prev;
      if (!next) clearSelection();
      else trackUxMetric('kitchen.batch.open');
      return next;
    });
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  };

  const updateSingleOrderStatus = async (order: Order) => {
    const nextStatus = getNextStatus(order.status);
    if (!nextStatus) return;
    setActionError('');
    setUpdatingOrderId(order.id);
    try {
      await updateOrder(order.id, { status: nextStatus });
      trackUxMetric('kitchen.status.update.success');
    } catch (error) {
      trackUxMetric('kitchen.status.update.error');
      setActionError(error instanceof Error ? error.message : 'Aggiornamento non riuscito');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const revertOrderStatus = async (order: Order) => {
    const prevStatus = getPrevStatus(order.status);
    if (!prevStatus) return;
    setActionError('');
    setUpdatingOrderId(order.id);
    try {
      await updateOrder(order.id, { status: prevStatus });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Ripristino non riuscito');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const applyBatchStatus = (targetStatus: 'preparing' | 'ready' | 'served') => {
    if (selectedVisibleOrders.length === 0) {
      setActionError('Seleziona almeno un ordine.');
      return;
    }
    const compatible = selectedVisibleOrders.filter((order) => {
      if (targetStatus === 'preparing') return order.status === 'pending';
      if (targetStatus === 'ready') return order.status === 'preparing';
      return order.status === 'ready';
    });
    if (compatible.length === 0) {
      setActionError('Nessun ordine compatibile con la transizione.');
      return;
    }
    setActionError('');
    setPendingBatchState({ status: targetStatus, count: compatible.length });
  };

  const confirmBatchStatus = async () => {
    if (!pendingBatchState) return;
    const { status: targetStatus } = pendingBatchState;
    const compatible = selectedVisibleOrders.filter((order) => {
      if (targetStatus === 'preparing') return order.status === 'pending';
      if (targetStatus === 'ready') return order.status === 'preparing';
      return order.status === 'ready';
    });
    setPendingBatchState(null);
    setBatchBusy(true);
    try {
      await Promise.all(compatible.map((order) => updateOrder(order.id, { status: targetStatus })));
      trackUxMetric('kitchen.batch.apply.success');
      clearSelection();
    } catch (error) {
      trackUxMetric('kitchen.batch.apply.error');
      setActionError(error instanceof Error ? error.message : 'Aggiornamento batch non riuscito');
    } finally {
      setBatchBusy(false);
    }
  };

  const renderOrderCard = (order: Order, isScheduledCard: boolean) => {
    const meta = getStatusMeta(order.status);
    const nextStatus = getNextStatus(order.status);
    const prevStatus = getPrevStatus(order.status);
    const selected = selectedOrderIds.includes(order.id);
    const ageMins = getOrderAgeMinutes(order.timestamp);
    const label = getOrderLabel(order);

    // Option B: when a zone filter is active, show only the rows belonging to
    // that zone (mixed tables show just their kitchen/bar lines respectively).
    const visibleItems =
      zoneFilter === 'all'
        ? order.items
        : order.items.filter((item) => {
            const areas = menuItemAreasById.get(item.id) ?? ['kitchen'];
            return areas.includes(zoneFilter);
          });
    const hiddenItemsCount = order.items.length - visibleItems.length;

    return (
      <div
        key={order.id}
        className={cn(
          'rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-200',
          isScheduledCard
            ? 'bg-slate-50 border-slate-200'
            : cn('bg-white', getOrderAgeClass(order.timestamp, order.status)),
          selected ? 'border-primary ring-1 ring-primary/30' : !isScheduledCard ? 'border-border' : '',
        )}
      >
        {/* Card Header */}
        <div className="px-3 py-2.5 sm:p-4 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isBatchMode && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleOrderSelection(order.id)}
                className="h-4 w-4 rounded border-border shrink-0"
              />
            )}
            <div className={cn(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-bold text-base sm:text-lg shrink-0',
              isScheduledCard ? 'bg-slate-200 text-slate-600' : 'bg-bg',
            )}>
              {label.badge}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-[11px] sm:text-xs uppercase tracking-widest truncate">
                {label.title}
              </h3>
              {label.subtitle && (
                <p className="text-[9px] sm:text-[10px] text-text-muted font-medium truncate">
                  {label.subtitle}
                </p>
              )}
              <div className="flex items-center gap-1.5">
                {order.scheduledFor ? (
                  <>
                    <Timer size={10} className="text-blue-500 shrink-0" />
                    <p className="text-[9px] sm:text-[10px] text-blue-600 font-bold uppercase truncate">
                      Consegna {format(new Date(order.scheduledFor), 'HH:mm', { locale: it })}
                      {!isScheduledCard && (
                        <span className="text-red-500 ml-1">— prepara ora!</span>
                      )}
                    </p>
                    <span className={cn(
                      'text-[8px] font-medium px-1 py-0.5 rounded',
                      isScheduledCard ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600',
                    )}>
                      {isScheduledCard
                        ? `inizia entro le ${format(getPrepByTime(order.scheduledFor), 'HH:mm', { locale: it })}`
                        : `entro le ${format(getPrepByTime(order.scheduledFor), 'HH:mm', { locale: it })}`
                      }
                    </span>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] sm:text-[10px] opacity-70 font-bold uppercase truncate">
                      {formatDistanceToNow(new Date(order.timestamp), { addSuffix: true, locale: it })}
                    </p>
                    {ageMins >= 10 && (
                      <span className={cn(
                        'text-[8px] font-bold px-1 py-0.5 rounded',
                        ageMins >= 15 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600',
                      )}>
                        {ageMins}m
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <StatusPill label={order.status} tone={meta.pillTone} />
        </div>

        {/* Items — with a zone filter active, only the matching rows are shown */}
        <div className="flex-1 px-3 py-2 sm:p-4 space-y-1.5">
          {visibleItems.map((item) => {
            const overrides = item.ingredientOverrides ?? [];
            const modifiers = item.selectedModifiers ?? [];
            const hasComposition = overrides.length > 0 || modifiers.length > 0;
            return (
              <div key={`${order.id}-${item.id}`}>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-accent text-xs sm:text-sm shrink-0">x{item.quantity}</span>
                  <span className="font-medium text-secondary text-xs sm:text-sm truncate">{item.name}</span>
                </div>
                {hasComposition && (
                  <div className="ml-5 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {modifiers.map((sm) => (
                      <span key={sm.optionId} className="text-[9px] text-text-muted">
                        {modifierOptionNameById.get(sm.optionId) ?? sm.optionId}
                      </span>
                    ))}
                    {overrides.map((e) => (
                      <span key={e.ingredientId} className={cn('text-[9px]', e.action === 'add' ? 'text-green-600' : 'text-red-500')}>
                        {e.action === 'add' ? '+' : '-'}{inventoryById.get(e.ingredientId)?.name ?? e.ingredientId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {hiddenItemsCount > 0 && (
            <p className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-text-muted bg-bg border border-border rounded-full px-2 py-0.5">
              +{hiddenItemsCount} righe (altra zona)
            </p>
          )}
        </div>

        {/* Action Buttons — hidden for scheduled cards */}
        {!isBatchMode && !isScheduledCard && (nextStatus || prevStatus) && (
          <div className="px-3 py-2 sm:p-3 bg-bg/30 border-t border-border flex gap-2">
            {prevStatus && (
              <button
                type="button"
                onClick={() => void revertOrderStatus(order)}
                disabled={updatingOrderId === order.id}
                className="flex items-center justify-center px-3 py-2.5 sm:py-2.5 rounded-lg border border-border text-text-muted hover:bg-bg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 min-h-11 active:scale-[0.97]"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            {nextStatus && (
              <button
                type="button"
                onClick={() => void updateSingleOrderStatus(order)}
                disabled={updatingOrderId === order.id}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 sm:py-2.5 text-white rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 min-h-11 active:scale-[0.97]',
                  meta.actionClassName,
                )}
              >
                {meta.actionIcon}
                {updatingOrderId === order.id ? 'Aggiorno...' : meta.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="mb-3 shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-primary tracking-tight uppercase">Cucina</h2>
            <p className="text-[10px] sm:text-sm text-text-muted font-medium">{pendingOrders.length} ordini attivi</p>
          </div>
          <button
            type="button"
            onClick={toggleBatchMode}
            className={cn(
              'min-h-10 rounded-lg px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 active:scale-95 transition-all shrink-0',
              isBatchMode ? 'bg-primary text-white border-primary' : 'bg-white text-secondary border-border',
            )}
          >
            <Layers3 size={14} />
            <span className="hidden xs:inline">Selezione</span>
            <span className="xs:hidden">Multi</span>
          </button>
        </div>

        <SegmentedChips
          ariaLabel="Filtro stato ordini cucina"
          value={statusFilter}
          onChange={(value) => { setStatusFilter(value); trackUxMetric('kitchen.filter.change'); }}
          options={[
            { value: 'all', label: 'Tutti', badge: pendingOrders.length },
            { value: 'pending', label: 'Attesa', badge: pendingOrders.filter((o) => o.status === 'pending').length },
            { value: 'preparing', label: 'Prep', badge: pendingOrders.filter((o) => o.status === 'preparing').length },
            { value: 'ready', label: 'Pronti', badge: pendingOrders.filter((o) => o.status === 'ready').length },
          ]}
        />

        <SegmentedChips
          ariaLabel="Filtro zona ordini cucina"
          value={zoneFilter}
          onChange={(value) => { setZoneFilter(value); trackUxMetric('kitchen.zone.change'); }}
          options={[
            { value: 'all', label: 'Tutte', badge: pendingOrders.length },
            { value: 'kitchen', label: 'Cucina', badge: zoneCounts.kitchen },
            { value: 'bar', label: 'Bar', badge: zoneCounts.bar },
          ]}
        />

        {isBatchMode && (
          <ContextToolbar
            title={`${selectedVisibleOrders.length} selezionati`}
            description=""
            actions={[
              {
                key: 'select-all',
                label: 'Tutti',
                onClick: () => setSelectedOrderIds([...activeOrders, ...scheduledOrders].map((o) => o.id)),
                disabled: activeOrders.length + scheduledOrders.length === 0 || batchBusy,
              },
              {
                key: 'clear',
                label: 'Reset',
                icon: <X size={12} />,
                onClick: clearSelection,
                disabled: selectedVisibleOrders.length === 0 || batchBusy,
              },
              {
                key: 'to-preparing',
                label: 'Prep',
                onClick: () => applyBatchStatus('preparing'),
                disabled: batchBusy,
                tone: 'primary' as const,
              },
              {
                key: 'to-ready',
                label: 'Pronto',
                onClick: () => applyBatchStatus('ready'),
                disabled: batchBusy,
                tone: 'primary' as const,
              },
              {
                key: 'to-served',
                label: 'Servito',
                onClick: () => applyBatchStatus('served'),
                disabled: batchBusy,
                tone: 'primary' as const,
              },
            ]}
          />
        )}
      </div>

      {actionError && <p className="mb-2 text-xs text-danger font-semibold shrink-0">{actionError}</p>}

      {pendingOrders.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-4 sm:p-6 text-xs sm:text-sm text-text-muted shrink-0">
          Nessun ordine in preparazione.
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-4 sm:p-6 text-xs sm:text-sm text-text-muted shrink-0">
          Nessun ordine per questa zona/stato.
        </div>
      ) : null}

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-20 md:pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {activeOrders.map((order) => renderOrderCard(order, false))}
          </div>
        </div>
      )}

      {/* Scheduled Orders */}
      {scheduledOrders.length > 0 && (
        <div className={cn('overflow-y-auto pr-1 pb-20 md:pb-2', activeOrders.length > 0 ? 'mt-4 border-t border-dashed border-slate-300 pt-4' : 'flex-1')}>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-blue-500" />
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-600">
              Programmati ({scheduledOrders.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {scheduledOrders.map((order) => renderOrderCard(order, true))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingBatchState !== null}
        title="Aggiornamento Batch"
        message={pendingBatchState ? `Aggiornare ${pendingBatchState.count} ordini a ${pendingBatchState.status}?` : ''}
        confirmLabel="Conferma"
        cancelLabel="Annulla"
        onConfirm={() => void confirmBatchStatus()}
        onCancel={() => setPendingBatchState(null)}
      />
    </div>
  );
}
