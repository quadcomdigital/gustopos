import { useMemo, useState, type ReactNode } from 'react';

const MOBILE_LIST_LIMIT = 50;
import type {
  AppData,
  Customer,
  CustomerAnalytics,
  CustomerAnalyticsRequest,
  Order,
  OrderHistoryFilters,
  VoidOrderResponse,
  ReservationsSummary,
  DeliverySummary,
} from '@gustopos/shared';
import { DollarSign, TrendingUp, Users, Clock, RefreshCw, X } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { trackUxMetric } from '../shared/ux/metrics';
import { cn } from '../lib/utils';

interface DashboardViewProps {
  data: AppData;
  orderHistory: Order[];
  customers: Customer[];
  customerAnalytics: CustomerAnalytics | null;
  onRefreshOrderHistory: (filters?: OrderHistoryFilters) => Promise<void>;
  onRefreshCustomerAnalytics: (payload?: CustomerAnalyticsRequest) => Promise<void>;
  onVoidOrder: (id: string, payload: { reason: string }) => Promise<VoidOrderResponse>;
  reservationsSummary: ReservationsSummary | null;
  deliverySummary: DeliverySummary | null;
  onRefreshOperationalSummaries: () => Promise<void>;
  canVoidOrders?: boolean;
  onViewCustomer?: (customerId: string) => void;
}

export default function DashboardView({
  data,
  orderHistory,
  customers,
  customerAnalytics,
  onRefreshOrderHistory,
  onRefreshCustomerAnalytics,
  onVoidOrder,
  reservationsSummary,
  deliverySummary,
  onRefreshOperationalSummaries,
  canVoidOrders = false,
  onViewCustomer,
}: DashboardViewProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [historyType, setHistoryType] = useState<'' | 'dine_in' | 'takeaway' | 'delivery'>('');
  const [voidReason, setVoidReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [refreshingAnalytics, setRefreshingAnalytics] = useState(false);
  const [refreshingOps, setRefreshingOps] = useState(false);
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);

  const paidOrders = data.orders.filter((order) => order.status === 'paid');
  const deliveryOrders = data.orders.filter((order) => order.orderType === 'delivery');
  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = paidOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const deliveryActiveCount = deliverySummary?.active ?? deliveryOrders.filter((order) => order.status !== 'paid' && order.status !== 'cancelled').length;

  const reservationOrders = orderHistory.filter((order) => order.orderType === 'dine_in');
  const cancelledReservationOrders = reservationOrders.filter((order) => order.status === 'cancelled').length;
  const noShowRate = reservationsSummary?.noShowRate ?? (reservationOrders.length > 0 ? cancelledReservationOrders / reservationOrders.length : 0);

  const filteredHistory = useMemo(() => {
    if (!historyType) return orderHistory;
    return orderHistory.filter((order) => order.orderType === historyType);
  }, [historyType, orderHistory]);

  const topDishes = useMemo(() => {
    const counts = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of paidOrders) {
      for (const item of order.items) {
        const existing = counts.get(item.id) ?? { name: item.name, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.price * item.quantity;
        counts.set(item.id, existing);
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [paidOrders]);

  const historyFilterKeys = [
    { key: '' as const, label: 'Tutti' },
    { key: 'dine_in' as const, label: 'Sala' },
    { key: 'takeaway' as const, label: 'Asporto' },
    { key: 'delivery' as const, label: 'Delivery' },
  ];

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight uppercase">Dashboard</h2>
          <p className="text-text-muted text-xs sm:text-sm font-medium">Storico ordini, clienti registrati e analytics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setRefreshingHistory(true); void onRefreshOrderHistory({ limit: 300 }).finally(() => setRefreshingHistory(false)); }}
            disabled={refreshingHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-[10px] sm:text-xs font-bold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform"
          >
            <RefreshCw size={12} className={cn(refreshingHistory && 'animate-spin')} />
            <span className="hidden sm:inline">Aggiorna</span> Storico
          </button>
          <button
            onClick={() => { setRefreshingAnalytics(true); void onRefreshCustomerAnalytics({}).finally(() => setRefreshingAnalytics(false)); }}
            disabled={refreshingAnalytics}
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-[10px] sm:text-xs font-bold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform"
          >
            <RefreshCw size={12} className={cn(refreshingAnalytics && 'animate-spin')} />
            <span className="hidden sm:inline">Aggiorna</span> Analytics
          </button>
          <button
            onClick={() => { setRefreshingOps(true); void onRefreshOperationalSummaries().finally(() => setRefreshingOps(false)); }}
            disabled={refreshingOps}
            className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-[10px] sm:text-xs font-bold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-transform"
          >
            <RefreshCw size={12} className={cn(refreshingOps && 'animate-spin')} />
            <span className="hidden sm:inline">Aggiorna</span> KPI
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard icon={<DollarSign size={18} />} label="Incasso" value={`€${totalRevenue.toFixed(2)}`} />
        <StatCard icon={<TrendingUp size={18} />} label="Ordini" value={String(totalOrders)} />
        <StatCard icon={<Clock size={18} />} label="Scontrino Medio" value={`€${avgOrderValue.toFixed(2)}`} />
        <StatCard icon={<Users size={18} />} label="Clienti" value={String(customerAnalytics?.totalCustomers ?? customers.length)} />
        <StatCard icon={<Clock size={18} />} label="Delivery" value={String(deliveryActiveCount)} />
        <StatCard icon={<Users size={18} />} label="No-show" value={`${(noShowRate * 100).toFixed(1)}%`} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <KPICard label="Clienti attivi" value={String(customerAnalytics?.activeCustomers ?? 0)} />
        <KPICard label="Tasso ritorno" value={`${((customerAnalytics?.repeatRate ?? 0) * 100).toFixed(1)}%`} />
        <KPICard label="Spesa media" value={`€${(customerAnalytics?.avgSpendPerCustomer ?? 0).toFixed(2)}`} />
      </div>

      {/* Top Dishes */}
      {topDishes.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">Top 5 Piatti</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
            {topDishes.map((dish, i) => (
              <div key={dish.name} className="bg-bg/50 rounded-lg p-2.5 md:p-3 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-accent">#{i + 1}</span>
                  <span className="text-[10px] md:text-xs font-bold text-primary truncate">{dish.name}</span>
                </div>
                <p className="text-sm md:text-lg font-bold text-primary">{dish.quantity}×</p>
                <p className="text-[9px] md:text-[10px] text-text-muted">€{dish.revenue.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order History */}
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">Storico Ordini</h3>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {historyFilterKeys.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setHistoryType(key)}
                className={cn(
                  'px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap transition-all active:scale-95',
                  historyType === key ? 'bg-primary text-white border-primary' : 'border-border text-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: Card layout */}
        <div className="md:hidden space-y-2">
          {filteredHistory.length === 0 ? (
            <p className="text-center text-text-muted text-xs py-6">Nessun ordine</p>
          ) : (
            filteredHistory.slice(0, MOBILE_LIST_LIMIT).map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="w-full text-left bg-bg/50 rounded-xl p-3 space-y-1 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary">
                    {order.orderType === 'takeaway' ? `#${order.ticketNumber}` : `T${order.table}`}
                  </span>
                  <span className={cn(
                    'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full',
                    order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700',
                  )}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">
                    {new Date(order.timestamp).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {order.customerName ? ` · ${order.customerName}` : ''}
                  </span>
                  <span className="text-sm font-bold text-primary">€{order.total.toFixed(2)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Desktop: Table layout */}
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-border">
                <th className="py-2">Quando</th>
                <th className="py-2">Tipo</th>
                <th className="py-2">Tavolo/Ticket</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Stato</th>
                <th className="py-2">Totale</th>
                <th className="py-2 text-right">Azione</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((order) => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-bg/30 transition-colors">
                  <td className="py-2">{new Date(order.timestamp).toLocaleString()}</td>
                  <td className="py-2 uppercase">{order.orderType}</td>
                  <td className="py-2">{order.orderType === 'takeaway' ? order.ticketNumber : order.table}</td>
                  <td className="py-2">{order.customerName ?? '-'}</td>
                  <td className="py-2 uppercase">{order.status}</td>
                  <td className="py-2 font-bold">€{order.total.toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-2 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-transform"
                    >
                      Dettaglio
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customers - Mobile: Card layout */}
      <div className="bg-white border border-border rounded-xl p-4">
        <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary mb-3">Clienti Registrati</h3>

        {/* Mobile */}
        <div className="md:hidden space-y-2">
          {customers.length === 0 ? (
            <p className="text-center text-text-muted text-xs py-4">Nessun cliente</p>
          ) : (
            customers.slice(0, MOBILE_LIST_LIMIT).map((customer) => (
              <div key={customer.id} className="bg-bg/50 rounded-xl p-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  {onViewCustomer ? (
                    <button onClick={() => onViewCustomer(customer.id)} className="font-bold text-accent text-xs hover:underline truncate block text-left">
                      {customer.fullName}
                    </button>
                  ) : (
                    <p className="font-bold text-primary text-xs truncate">{customer.fullName}</p>
                  )}
                  <p className="text-[10px] text-text-muted">{customer.phone ?? '—'}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-xs font-bold text-primary">{customer.totalOrders} ordini</p>
                  <p className="text-[10px] text-text-muted">€{customer.totalSpent.toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-border">
                <th className="py-2">Nome</th>
                <th className="py-2">Telefono</th>
                <th className="py-2">Ordini</th>
                <th className="py-2">Speso</th>
                <th className="py-2">Ultima visita</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-border/50">
                  <td className="py-2">
                    {onViewCustomer ? (
                      <button onClick={() => onViewCustomer(customer.id)} className="font-bold text-accent hover:underline text-left">
                        {customer.fullName}
                      </button>
                    ) : (
                      <span className="font-bold text-primary">{customer.fullName}</span>
                    )}
                  </td>
                  <td className="py-2">{customer.phone ?? '-'}</td>
                  <td className="py-2">{customer.totalOrders}</td>
                  <td className="py-2">€{customer.totalSpent.toFixed(2)}</td>
                  <td className="py-2">{customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white w-full sm:max-w-xl sm:rounded-xl rounded-t-2xl border border-border overflow-hidden max-h-[85vh] flex flex-col" role="dialog" aria-modal="true" aria-label={`Dettaglio ordine ${selectedOrder.id}`}>
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
              <h4 className="text-sm font-bold uppercase tracking-widest text-primary truncate pr-2">Ordine {selectedOrder.id}</h4>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-bg rounded-full transition-colors text-text-muted shrink-0"
                aria-label="Chiudi dettaglio ordine"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2">
                <InfoBadge label="Tipo" value={selectedOrder.orderType} />
                <InfoBadge label="Stato" value={selectedOrder.status} />
                <InfoBadge label="Totale" value={`€${selectedOrder.total.toFixed(2)}`} />
                <InfoBadge label="Cliente" value={selectedOrder.customerName ?? '—'} />
              </div>

              {canVoidOrders && selectedOrder.status !== 'paid' && selectedOrder.status !== 'cancelled' && (
                <div className="border border-rose-200 bg-rose-50 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Annulla ordine</p>
                  <input
                    value={voidReason}
                    onChange={(event) => setVoidReason(event.target.value)}
                    placeholder="Motivazione annullo"
                    className="w-full px-3 py-2 rounded-lg border border-rose-200 text-sm bg-white"
                  />
                  <button
                    onClick={() => { setActionError(''); trackUxMetric('dashboard.void.confirm.open'); setConfirmVoidOpen(true); }}
                    disabled={voiding || voidReason.trim().length < 3}
                    className="w-full px-3 py-2 rounded-lg bg-danger text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 active:scale-[0.98] transition-transform"
                  >
                    {voiding ? 'Annullamento...' : 'Conferma annullo'}
                  </button>
                  {actionError && <p className="text-xs text-danger font-semibold">{actionError}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Articoli</p>
                {selectedOrder.items.map((item) => (
                  <div key={`${selectedOrder.id}-${item.id}`} className="flex items-center justify-between bg-bg/50 rounded-lg px-3 py-2">
                    <p className="text-xs sm:text-sm text-secondary">
                      <span className="font-bold text-accent mr-1">{item.quantity}×</span>
                      {item.name}
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-primary">€{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmVoidOpen}
        title="Conferma annullo ordine"
        message={`Confermi annullo ordine ${selectedOrder?.id ?? ''}? Questa azione impatta il flusso operativo.`}
        confirmLabel="Annulla ordine"
        cancelLabel="Torna indietro"
        onCancel={() => setConfirmVoidOpen(false)}
        onConfirm={() => {
          if (!selectedOrder) { setConfirmVoidOpen(false); return; }
          setConfirmVoidOpen(false);
          setActionError('');
          setVoiding(true);
          void onVoidOrder(selectedOrder.id, { reason: voidReason.trim() })
            .then((result) => {
              trackUxMetric('dashboard.void.success');
              setSelectedOrder(result.order);
              setVoidReason('');
              void onRefreshOrderHistory({ limit: 300 });
            })
            .catch((error) => {
              trackUxMetric('dashboard.void.error');
              setActionError(error instanceof Error ? error.message : 'Annullamento ordine non riuscito');
            })
            .finally(() => setVoiding(false));
        }}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-3 md:p-4">
      <div className="w-8 h-8 md:w-10 md:h-10 bg-bg rounded-lg flex items-center justify-center mb-2 md:mb-3 text-accent">{icon}</div>
      <p className="text-[9px] md:text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</p>
      <p className="text-lg md:text-2xl font-bold text-primary mt-0.5 md:mt-1">{value}</p>
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-3 md:p-4">
      <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="text-lg md:text-2xl font-bold text-primary mt-1">{value}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg/50 rounded-lg px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">{label}</p>
      <p className="text-xs font-bold text-primary mt-0.5 truncate">{value}</p>
    </div>
  );
}
