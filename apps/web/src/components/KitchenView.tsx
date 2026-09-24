import React from 'react';
import { Order, UpdateOrderRequest } from '@gustopos/shared';
import { CheckCircle2, PlayCircle, UtensilsCrossed, Layers3, X, Clock, Timer, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { buildComponentNameById, buildModifierOptionNameById } from '../lib/catalog-names';
import { trackUxMetric } from '../shared/ux/metrics';
import SegmentedChips from '../shared/ui/atoms/SegmentedChips';
import StatusPill from '../shared/ui/atoms/StatusPill';
import ContextToolbar from '../shared/ui/molecules/ContextToolbar';
import { usePrintStations } from './inventory/usePrintStations';
import ConfirmDialog from './ConfirmDialog';
import { useAppStore } from '../store/app-store';

interface KitchenViewProps {
  orders: Order[];
  updateOrder: (id: string, updates: UpdateOrderRequest) => Promise<Order>;
}

type KitchenStatusFilter = 'all' | 'pending' | 'preparing' | 'ready';
type KitchenZoneFilter = 'all' | string;

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

function getOrderAgeMinutes(timestamp: string, now = Date.now()): number {
  return Math.floor((now - new Date(timestamp).getTime()) / 60000);
}

function getOrderAgeClass(timestamp: string, status: Order['status'], now = Date.now()): string {
  if (status === 'served' || status === 'paid' || status === 'cancelled') return '';
  const mins = getOrderAgeMinutes(timestamp, now);
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

// Local ticking clock. Only the component that owns it re-renders when time
// advances, so the kitchen board and its sibling cards stay untouched.
function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface OrderCardProps {
  order: Order;
  isScheduledCard: boolean;
  zoneFilter: KitchenZoneFilter;
  isBatchMode: boolean;
  selected: boolean;
  updatingOrderId: string | null;
  inventoryById: ReadonlyMap<string, { id: string; name: string }>;
  componentNameById: ReadonlyMap<string, string>;
  modifierOptionNameById: ReadonlyMap<string, string>;
  menuItemStationIdById: ReadonlyMap<string, string | null>;
  onToggleSelection: (orderId: string) => void;
  onUpdateStatus: (order: Order) => void;
  onRevertStatus: (order: Order) => void;
  onResend: (order: Order) => void;
}

// Each card owns its countdown/age tick, so a 30s timer only re-renders that
// card's time-sensitive text and border instead of the whole kitchen board.
const OrderCard = React.memo(function OrderCard({
  order,
  isScheduledCard,
  zoneFilter,
  isBatchMode,
  selected,
  updatingOrderId,
  inventoryById,
  componentNameById,
  modifierOptionNameById,
  menuItemStationIdById,
  onToggleSelection,
  onUpdateStatus,
  onRevertStatus,
  onResend,
}: OrderCardProps) {
  const now = useNow(30_000);
  const meta = getStatusMeta(order.status);
  const nextStatus = getNextStatus(order.status);
  const prevStatus = getPrevStatus(order.status);
  const ageMins = getOrderAgeMinutes(order.timestamp, now);
  const label = getOrderLabel(order);

  // Option B: when a zone filter is active, show only the rows assigned to
  // that station (mixed tables show just their matching lines).
  const visibleItems =
    zoneFilter === 'all'
      ? order.items
      : order.items.filter((item) => menuItemStationIdById.get(item.id) === zoneFilter);
  const hiddenItemsCount = order.items.length - visibleItems.length;

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-200',
        isScheduledCard
          ? 'bg-slate-50 border-slate-200'
          : cn('bg-white', getOrderAgeClass(order.timestamp, order.status, now)),
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
              onChange={() => onToggleSelection(order.id)}
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
                  <Timer size={14} className="text-blue-500 shrink-0" />
                  <p className="flex items-baseline gap-1 text-blue-700">
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase">Consegna</span>
                    <span className="text-lg sm:text-xl font-extrabold leading-none tabular-nums">
                      {format(new Date(order.scheduledFor), 'HH:mm', { locale: it })}
                    </span>
                  </p>
                  {!isScheduledCard && (
                    <span className="text-[9px] font-bold text-red-500 ml-1">prepara ora!</span>
                  )}
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
                      {e.action === 'add' ? '+' : '-'}{componentNameById.get(e.ingredientId) ?? inventoryById.get(e.ingredientId)?.name ?? e.ingredientId}
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
              onClick={() => void onRevertStatus(order)}
              disabled={updatingOrderId === order.id}
              className="flex items-center justify-center px-3 py-2.5 sm:py-2.5 rounded-lg border border-border text-text-muted hover:bg-bg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50 min-h-11 active:scale-[0.97]"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          {nextStatus && (
            <button
              type="button"
              onClick={() => void onUpdateStatus(order)}
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
          <button
            type="button"
            onClick={() => onResend(order)}
            title="Reinvia ticket alle stazioni"
            className="px-3 py-2.5 rounded-lg border border-border text-text-muted hover:bg-bg text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-sm min-h-11 active:scale-[0.97]"
          >
            Stampa
          </button>
        </div>
      )}
    </div>
  );
});

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

  const inventoryById = React.useMemo(() => new Map((data?.inventory ?? []).map((e) => [e.id, e])), [data?.inventory]);
  const componentNameById = React.useMemo(
    () => buildComponentNameById({ inventory: data?.inventory ?? [], bomItems: data?.bomItems ?? [], menu: data?.menu ?? [] }),
    [data?.inventory, data?.bomItems, data?.menu],
  );
  const modifierOptionNameById = React.useMemo(
    () => buildModifierOptionNameById(
      { menu: data?.menu ?? [], categoryModifierPools: data?.categoryModifierPools ?? [] },
      componentNameById,
    ),
    [data?.menu, data?.categoryModifierPools, componentNameById],
  );

  // Resolve the station id of each menu item. Order items expose their
  // menuItemId as `id`, so we can classify every order row. Assignment is
  // explicit (product/category) — no name/regex inference.
  const { stations } = usePrintStations();
  const zoneStations = React.useMemo(
    () => stations.filter((s) => s.isActive && s.kind !== 'cashier'),
    [stations],
  );
  const menuItemStationIdById = React.useMemo(() => {
    const map = new Map<string, string | null>();
    for (const mi of data?.menu ?? []) {
      map.set(mi.id, mi.stationId ?? null);
    }
    return map;
  }, [data?.menu]);

  // Per-order station membership: an order is shown under a station if at
  // least one of its items is assigned to it (mixed tables appear in several).
  const orderZoneInfo = React.useMemo(() => {
    const info = new Map<string, Set<string>>();
    for (const order of orders) {
      const zones = new Set<string>();
      for (const item of order.items) {
        const stationId = menuItemStationIdById.get(item.id);
        if (stationId) zones.add(stationId);
      }
      info.set(order.id, zones);
    }
    return info;
  }, [orders, menuItemStationIdById]);

  const zoneCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of pendingOrders) {
      const zones = orderZoneInfo.get(order.id);
      if (!zones) continue;
      for (const zone of zones) counts.set(zone, (counts.get(zone) ?? 0) + 1);
    }
    return counts;
  }, [pendingOrders, orderZoneInfo]);

  // Scheduled orders move to the active board when their prep window opens;
  // keep a timer only in that (rare) case. Countdown/age displays tick inside
  // each card (OrderCard's useNow), so the board no longer re-renders every
  // 30s for the common case.
  const hasScheduledOrders = React.useMemo(() => pendingOrders.some((o) => isScheduled(o)), [pendingOrders]);
  const [, forceUpdate] = React.useState(0);
  React.useEffect(() => {
    if (!hasScheduledOrders) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [hasScheduledOrders]);

  const resendOrderPrintJobs = useAppStore((s) => s.resendOrderPrintJobs);
  const handleResend = (order: Order) => {
    void resendOrderPrintJobs(order.id).catch(() => {
      // store surfaces the error
    });
  };

  const filteredOrders = pendingOrders
    .filter((order) => (statusFilter === 'all' ? true : order.status === statusFilter))
    .filter((order) => {
      if (zoneFilter === 'all') return true;
      return orderZoneInfo.get(order.id)?.has(zoneFilter) ?? false;
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

  const toggleOrderSelection = React.useCallback((orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    );
  }, []);

  const updateSingleOrderStatus = React.useCallback(async (order: Order) => {
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
  }, [updateOrder]);

  const revertOrderStatus = React.useCallback(async (order: Order) => {
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
  }, [updateOrder]);

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

  const renderOrderCard = (order: Order, isScheduledCard: boolean) => (
    <OrderCard
      key={order.id}
      order={order}
      isScheduledCard={isScheduledCard}
      zoneFilter={zoneFilter}
      isBatchMode={isBatchMode}
      selected={selectedOrderIds.includes(order.id)}
      updatingOrderId={updatingOrderId}
      inventoryById={inventoryById}
      componentNameById={componentNameById}
      modifierOptionNameById={modifierOptionNameById}
      menuItemStationIdById={menuItemStationIdById}
      onToggleSelection={toggleOrderSelection}
      onUpdateStatus={updateSingleOrderStatus}
      onRevertStatus={revertOrderStatus}
      onResend={handleResend}
    />
  );

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
            ...zoneStations.map((s) => ({ value: s.id, label: s.name, badge: zoneCounts.get(s.id) ?? 0 })),
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
