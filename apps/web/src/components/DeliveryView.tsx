import { useEffect, useState } from 'react';
import type { DeliveryStatus } from '@gustopos/shared';
import { useAppStore } from '../store/app-store';
import ConfirmDialog from './ConfirmDialog';
import { cn } from '../lib/utils';

const statusOptions: DeliveryStatus[] = ['new', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

const statusLabels: Record<DeliveryStatus, string> = {
  new: 'Nuovo',
  preparing: 'In prep',
  ready: 'Pronto',
  out_for_delivery: 'Inviato',
  delivered: 'Consegnato',
  cancelled: 'Annullato',
};

const statusTones: Record<DeliveryStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  preparing: 'bg-amber-100 text-amber-700',
  ready: 'bg-emerald-100 text-emerald-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const allowedTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  new: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

function canTransition(current: DeliveryStatus, next: DeliveryStatus): boolean {
  return current === next || allowedTransitions[current].includes(next);
}

function getNextStatusLabel(current: DeliveryStatus): string | null {
  if (current === 'new') return 'Prepara';
  if (current === 'preparing') return 'Pronto';
  if (current === 'ready') return 'Spedisci';
  if (current === 'out_for_delivery') return 'Consegnato';
  return null;
}

function getNextStatus(current: DeliveryStatus): DeliveryStatus | null {
  if (current === 'new') return 'preparing';
  if (current === 'preparing') return 'ready';
  if (current === 'ready') return 'out_for_delivery';
  if (current === 'out_for_delivery') return 'delivered';
  return null;
}

export default function DeliveryView() {
  const upsertDeliveryOrder = useAppStore((state) => state.upsertDeliveryOrder);
  const items = useAppStore((state) => state.deliveryOrders);
  const refreshDeliveryOrders = useAppStore((state) => state.refreshDeliveryOrders);
  const updateDeliveryOrderStatus = useAppStore((state) => state.updateDeliveryOrderStatus);
  const dispatchDeliveryOrder = useAppStore((state) => state.dispatchDeliveryOrder);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'queue' | 'new'>('queue');
  const [statusFilter, setStatusFilter] = useState<'' | DeliveryStatus>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [courierFilter, setCourierFilter] = useState('');
  const [orderId, setOrderId] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [error, setError] = useState('');
  const [pendingCancel, setPendingCancel] = useState<{ orderId: string; status: DeliveryStatus } | null>(null);

  const load = async (force = false) => {
    setLoading(true);
    setError('');
    try {
      await refreshDeliveryOrders({
        status: statusFilter || undefined,
        from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
        to: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined,
        limit: 300,
      }, force);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/exhaustive-deps -- [load-recursion] load is recreated each render; effect only refreshes on statusFilter / date-range changes */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] load() calls store set() asynchronously
    void load();
  }, [statusFilter, fromDate, toDate]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const visibleItems = items.filter((item) =>
    courierFilter.trim().length === 0
      ? true
      : (item.courierName ?? '').toLowerCase().includes(courierFilter.trim().toLowerCase()),
  );

  const manualRefresh = async () => {
    await load(true);
  };

  const submit = async () => {
    if (!orderId.trim()) { setError('Order ID richiesto'); return; }
    setError('');
    try {
      await upsertDeliveryOrder(orderId.trim(), {
        customerAddress: customerAddress.trim(),
        courierName: courierName.trim() || undefined,
        courierPhone: courierPhone.trim() || undefined,
        deliveryFee: Number(deliveryFee) || 0,
        status: 'new',
      });
      setOrderId(''); setCustomerAddress(''); setCourierName(''); setCourierPhone(''); setDeliveryFee('0');
      setActiveSection('queue');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio');
    }
  };

  const updateStatus = async (itemOrderId: string, status: DeliveryStatus) => {
    const current = items.find((i) => i.orderId === itemOrderId)?.status;
    if (current && !canTransition(current, status)) { setError(`Transizione non valida`); return; }
    if (status === 'cancelled') { setPendingCancel({ orderId: itemOrderId, status }); return; }
    setError('');
    try { await updateDeliveryOrderStatus(itemOrderId, { status }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore aggiornamento'); }
  };

  const advanceStatus = async (itemOrderId: string) => {
    const item = items.find((i) => i.orderId === itemOrderId);
    if (!item) return;
    const next = getNextStatus(item.status);
    if (next) await updateStatus(itemOrderId, next);
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    setError('');
    try { await updateDeliveryOrderStatus(pendingCancel.orderId, { status: pendingCancel.status }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore'); }
    finally { setPendingCancel(null); }
  };

  const dispatch = async (itemOrderId: string) => {
    const item = items.find((e) => e.orderId === itemOrderId);
    if (item && item.status !== 'ready') { setError('Dispatch solo con stato ready'); return; }
    setError('');
    try { await dispatchDeliveryOrder(itemOrderId); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore dispatch'); }
  };

  const activeCount = items.filter((i) => i.status !== 'delivered' && i.status !== 'cancelled').length;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-primary tracking-tight uppercase">Delivery</h2>
          <p className="text-[10px] sm:text-xs text-text-muted font-medium">{activeCount} attivi</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => void manualRefresh()}
            disabled={loading}
            className="min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-border bg-white disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? 'Caricamento...' : 'Aggiorna'}
          </button>
          <button
            onClick={() => setActiveSection('queue')}
            className={cn(
              'min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border active:scale-95 transition-all',
              activeSection === 'queue' ? 'bg-primary text-white border-primary' : 'bg-white border-border',
            )}
          >
            Coda
          </button>
          <button
            onClick={() => setActiveSection('new')}
            className={cn(
              'min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border active:scale-95 transition-all',
              activeSection === 'new' ? 'bg-accent text-white border-accent' : 'bg-white border-border',
            )}
          >
            + Nuovo
          </button>
        </div>
      </div>

      {/* Filters - solo in coda */}
      {activeSection === 'queue' && (
        <div className="flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | DeliveryStatus)}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-border text-xs shrink-0"
          >
            <option value="">Tutti</option>
            {statusOptions.map((s) => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-h-[44px] px-3 py-2 rounded-lg border border-border text-xs shrink-0" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="min-h-[44px] px-3 py-2 rounded-lg border border-border text-xs shrink-0" />
          <input value={courierFilter} onChange={(e) => setCourierFilter(e.target.value)} placeholder="Corriere" className="min-h-[44px] px-3 py-2 rounded-lg border border-border text-xs shrink-0 w-24" />
        </div>
      )}

      {/* New delivery form */}
      {activeSection === 'new' && (
        <div className="bg-white border border-border rounded-xl p-3 space-y-2 shrink-0">
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Order ID *" className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Indirizzo" className="w-full px-3 py-2 rounded-lg border border-border text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="Corriere" className="px-3 py-2 rounded-lg border border-border text-sm" />
            <input value={courierPhone} onChange={(e) => setCourierPhone(e.target.value)} placeholder="Telefono" className="px-3 py-2 rounded-lg border border-border text-sm" />
          </div>
          <div className="flex gap-2">
            <input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Fee" className="flex-1 px-3 py-2 rounded-lg border border-border text-sm" />
            <button onClick={() => void submit()} disabled={loading} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-all">
              Salva
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[10px] sm:text-xs text-danger font-semibold shrink-0">{error}</p>}

      {/* Delivery list */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-20 md:pb-0">
        {loading && <p className="text-[10px] text-text-muted">Caricamento...</p>}

        {visibleItems.length === 0 && !loading && (
          <p className="text-xs text-text-muted text-center py-6">Nessun ordine delivery</p>
        )}

        {visibleItems.map((item) => {
          const nextLabel = getNextStatusLabel(item.status);
          const nextStatus = getNextStatus(item.status);

          return (
            <div
              key={item.id}
              className={cn(
                'bg-white border rounded-xl p-3 space-y-2',
                item.status === 'cancelled' ? 'border-red-200 opacity-60' : 'border-border',
              )}
            >
              {/* Header: order + status */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-bold text-secondary truncate">Order {item.orderId}</p>
                  <p className="text-[10px] sm:text-xs text-text-muted truncate">{item.customerAddress}</p>
                </div>
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full shrink-0', statusTones[item.status])}>
                  {statusLabels[item.status]}
                </span>
              </div>

              {/* Info compatto */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                <span>Corriere: <strong>{item.courierName ?? 'n.d.'}</strong></span>
                {item.courierPhone && <span>Tel: {item.courierPhone}</span>}
                {item.statusChangedAt && <span>{new Date(item.statusChangedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {nextLabel && nextStatus && (
                  <button
                    onClick={() => nextStatus === 'out_for_delivery' ? void dispatch(item.orderId) : void advanceStatus(item.orderId)}
                    className="flex-1 min-h-[44px] py-2.5 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider active:scale-[0.97] transition-all"
                  >
                    {nextLabel}
                  </button>
                )}
                <button
                  onClick={() => setPendingCancel({ orderId: item.orderId, status: 'cancelled' })}
                  disabled={item.status === 'delivered' || item.status === 'cancelled'}
                  className="min-h-[44px] px-3 py-2.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold uppercase tracking-wider disabled:opacity-30 active:scale-95 transition-all"
                >
                  Annulla
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingCancel !== null}
        title="Annulla Delivery"
        message="Confermi l'annullamento di questo ordine?"
        confirmLabel="Annulla ordine"
        onConfirm={() => void confirmCancel()}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  );
}
