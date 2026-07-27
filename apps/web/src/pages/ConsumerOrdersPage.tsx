import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Package } from 'lucide-react';
import type { Order, OrderStatus } from '@gustopos/shared';
import {
  fetchConsumerOrders,
  getConsumerAccessToken,
  logoutConsumer,
} from '../shared/api/client';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Ricevuto',
  preparing: 'In preparazione',
  ready: 'Pronto',
  served: 'Servito',
  paid: 'Pagato',
  cancelled: 'Annullato',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-gray-100 text-gray-700',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConsumerOrdersPage() {
  const { tenantSlug = '' } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantSlug || !getConsumerAccessToken(tenantSlug)) {
      navigate(`/${tenantSlug}/account`, { replace: true });
      return;
    }

    let cancelled = false;

    const loadOrders = async () => {
      try {
        setLoading(true);
        const data = await fetchConsumerOrders(tenantSlug);
        if (!cancelled) {
          setOrders(data.map((item) => item.order));
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof Error && err.message.includes('session expired')) {
            navigate(`/${tenantSlug}/account`, { replace: true });
            return;
          }
          setError(err instanceof Error ? err.message : 'Errore caricamento ordini');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug, navigate]);

  const handleLogout = async () => {
    try {
      await logoutConsumer(tenantSlug);
    } catch {
      // ignore logout errors
    }
    navigate(`/${tenantSlug}/account`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to={`/${tenantSlug}/account`}
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            <ChevronLeft size={16} />
            Account
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="text-xs font-bold text-text-muted hover:text-danger uppercase tracking-wider"
          >
            Esci
          </button>
        </div>

        <h1 className="text-2xl font-bold text-primary tracking-tight uppercase">
          I Miei Ordini
        </h1>

        {/* Loading */}
        {loading && (
          <p className="text-sm text-text-muted">Caricamento ordini...</p>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-white border border-border rounded-xl p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={() => {
                setError('');
                setLoading(true);
                void fetchConsumerOrders(tenantSlug)
                  .then((data) => {
                    setOrders(data.map((item) => item.order));
                    setError('');
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Errore');
                  })
                  .finally(() => setLoading(false));
              }}
              className="mt-3 px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wider"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && orders.length === 0 && (
          <div className="bg-white border border-border rounded-xl p-8 text-center space-y-3">
            <Package size={40} className="mx-auto text-text-muted opacity-40" />
            <p className="text-sm text-text-muted font-medium">
              Nessun ordine trovato.
            </p>
            <Link
              to={`/${tenantSlug}/menu`}
              className="inline-block px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase tracking-wider"
            >
              Vai al Menu
            </Link>
          </div>
        )}

        {/* Orders list */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-border rounded-xl p-4 space-y-3"
              >
                {/* Order header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted font-medium">
                      Ordine #{order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm font-bold text-secondary">
                      {formatDateTime(order.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[order.status as OrderStatus] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-secondary">
                        {item.quantity}× {item.name}
                      </span>
                      <span className="text-text-muted font-medium">
                        €{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    Totale
                  </span>
                  <span className="text-base font-bold text-primary">
                    €{order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
