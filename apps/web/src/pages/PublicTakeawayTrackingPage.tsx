import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { OrderStatus } from '@gustopos/shared';
import { getPublicTakeawayTracking, trackPublicFunnelEvent } from '../shared/api/client';

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Ricevuto',
  preparing: 'In preparazione',
  ready: 'Pronto al ritiro',
  served: 'Consegnato',
  paid: 'Pagato',
  cancelled: 'Annullato',
};

const ORDER_STATUS_PROGRESS: Record<OrderStatus, number> = {
  pending: 20,
  preparing: 55,
  ready: 100,
  served: 100,
  paid: 100,
  cancelled: 100,
};

const IT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const IT_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function formatScheduledFor(isoString: string): string {
  const date = new Date(isoString);
  const dayName = IT_DAYS[date.getDay()];
  const monthName = IT_MONTHS[date.getMonth()];
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dayName} ${day} ${monthName}, ${hours}:${minutes}`;
}

export default function PublicTakeawayTrackingPage() {
  const { tenantSlug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<{
    id: string;
    ticketNumber?: string;
    status: OrderStatus;
    total: number;
    timestamp: string;
    scheduledFor?: string;
    items: Array<{ id: string; name: string; quantity: number; price: number }>;
    customerName?: string;
  } | null>(null);

  useEffect(() => {
    if (!tenantSlug) {
      return;
    }
    const orderIdFromUrl = searchParams.get('orderId');
    const tokenFromUrl = searchParams.get('token');
    if (orderIdFromUrl && tokenFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] initializes order tracking from URL params on mount; setters receive primitives from URL, not state
      setOrderId(orderIdFromUrl);
       
      setTrackingToken(tokenFromUrl);
      return;
    }
    const raw = localStorage.getItem(`gustopos:public-takeaway-tracking:${tenantSlug}`);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { orderId?: string; trackingToken?: string };
      if (parsed.orderId) setOrderId(parsed.orderId);
      if (parsed.trackingToken) setTrackingToken(parsed.trackingToken);
    } catch {
      // ignore parse errors
    }
  }, [tenantSlug, searchParams]);

  useEffect(() => {
    if (!tenantSlug || !orderId || !trackingToken) {
      return;
    }

    let cancelled = false;
    let interval: number | undefined;

    const loadTracking = async () => {
      try {
        setLoading(true);
        const payload = await getPublicTakeawayTracking(tenantSlug, orderId, trackingToken);
        if (!cancelled) {
          setOrder(payload.order);
          setError('');
        }
      } catch (trackingError) {
        if (!cancelled) {
          setError(trackingError instanceof Error ? trackingError.message : 'Tracking non disponibile');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTracking();
    interval = window.setInterval(() => {
      void loadTracking();
    }, 15000);

    return () => {
      cancelled = true;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [tenantSlug, orderId, trackingToken]);

  useEffect(() => {
    if (!tenantSlug || !order) {
      return;
    }

    void trackPublicFunnelEvent(tenantSlug, {
      event: 'public_takeaway_tracking_view',
      details: {
        orderId: order.id,
        status: order.status,
      },
    }).catch(() => undefined);
  }, [tenantSlug, order]);

  const progress = useMemo(() => {
    if (!order) {
      return 0;
    }
    return ORDER_STATUS_PROGRESS[order.status] ?? 0;
  }, [order]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Takeaway Tracking</p>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">Stato Ordine</h1>
          <p className="text-sm text-slate-600 mt-2">Monitora il tuo ordine takeaway in tempo reale.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="Order ID"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <input
              value={trackingToken}
              onChange={(event) => setTrackingToken(event.target.value)}
              placeholder="Tracking token"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (tenantSlug && orderId && trackingToken) {
                  localStorage.setItem(`gustopos:public-takeaway-tracking:${tenantSlug}`, JSON.stringify({ orderId, trackingToken }));
                }
              }}
              className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
            >
              Salva tracking
            </button>
            <button
              onClick={() => navigate(`/${tenantSlug}/menu`)}
              className="px-4 py-2 rounded border border-slate-300 text-xs font-bold uppercase tracking-wider"
            >
              Torna al menu
            </button>
          </div>
        </section>

        {loading && <p className="text-sm text-slate-600">Aggiornamento stato ordine...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {order && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Ordine #{order.id}</p>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">{ORDER_STATUS_LABEL[order.status]}</span>
            </div>

            <div>
              <div className="w-full h-2 rounded bg-slate-200 overflow-hidden">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">Progresso ordine: {progress}%</p>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>Ticket: <strong>{order.ticketNumber ?? '-'}</strong></p>
              <p>Cliente: <strong>{order.customerName ?? '-'}</strong></p>
              <p>Creato: <strong>{new Date(order.timestamp).toLocaleString()}</strong></p>
              {order.scheduledFor && (
                <p>Consegna prevista: <strong>{formatScheduledFor(order.scheduledFor)}</strong></p>
              )}
              <p>Totale: <strong>EUR {order.total.toFixed(2)}</strong></p>
            </div>

            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={`track-item-${item.id}`} className="flex items-center justify-between rounded border border-slate-200 p-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">Qty {item.quantity}</p>
                  </div>
                  <span className="text-xs font-bold">EUR {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
