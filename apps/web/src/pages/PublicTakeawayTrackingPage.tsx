import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OrderStatus, PublicMenuResponse } from '@gustopos/shared';
import { API_URL, getPublicTakeawayTracking, trackPublicFunnelEvent } from '../shared/api/client';
import { BrandFooter, BrandHeader, resolvePublicBrand } from '../menu/brand';
import { formatPrice } from '../menu/lib/display';

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
  const [orderId, setOrderId] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
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
    if (!tenantSlug) return;
    void fetch(`${API_URL}/api/public/menu?slug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json().then((payload) => ({ ok: res.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok) throw new Error(payload?.message ?? 'Menu load failed');
        setMenu(payload as PublicMenuResponse);
      })
      .catch(() => undefined);
  }, [tenantSlug]);

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

  const brand = useMemo(() => (menu ? resolvePublicBrand(menu) : null), [menu]);
  const currency = brand?.currency ?? 'EUR';
  const tenantName = menu?.tenant.name ?? tenantSlug;
  const muted = brand?.muted ?? '#64748b';
  const surfaceStyle = {
    backgroundColor: brand?.surface ?? '#ffffff',
    borderColor: brand?.border ?? '#e2e8f0',
    color: brand?.ink ?? '#0f172a',
  } as const;
  const hasCredentials = Boolean(orderId && trackingToken);

  return (
    <main
      className="menu-brand min-h-[100dvh]"
      style={{ backgroundColor: brand?.pageBg ?? '#f8fafc', color: brand?.ink ?? '#0f172a' }}
    >
      <BrandHeader
        brand={brand}
        name={tenantName}
        action={
          <Link
            to={`/${tenantSlug}/menu`}
            className="min-h-[36px] rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/85 transition hover:bg-white/10"
          >
            Menu
          </Link>
        }
      />

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: muted }}>
            Takeaway
          </p>
          <h1 className="display mt-1 text-3xl font-extrabold">Stato ordine</h1>
          <p className="mt-2 text-sm" style={{ color: muted }}>
            Monitora il tuo ordine takeaway in tempo reale.
          </p>
        </div>

        {hasCredentials && !showCredentials ? (
          <button
            type="button"
            onClick={() => setShowCredentials(true)}
            className="min-h-[44px] w-full rounded-xl border px-4 text-xs font-bold uppercase tracking-widest"
            style={{ borderColor: brand?.border ?? '#e2e8f0', color: brand?.ink ?? '#0f172a', backgroundColor: brand?.surface ?? '#ffffff' }}
          >
            Hai un codice?
          </button>
        ) : (
          <section className="space-y-3 rounded-2xl border p-4 shadow-sm" style={surfaceStyle}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="Order ID"
                className="min-h-[48px] w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                style={{ backgroundColor: brand?.pageBg ?? '#f8fafc', borderColor: brand?.border ?? '#e2e8f0', color: brand?.ink ?? '#0f172a' }}
              />
              <input
                value={trackingToken}
                onChange={(event) => setTrackingToken(event.target.value)}
                placeholder="Tracking token"
                className="min-h-[48px] w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                style={{ backgroundColor: brand?.pageBg ?? '#f8fafc', borderColor: brand?.border ?? '#e2e8f0', color: brand?.ink ?? '#0f172a' }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (tenantSlug && orderId && trackingToken) {
                    localStorage.setItem(
                      `gustopos:public-takeaway-tracking:${tenantSlug}`,
                      JSON.stringify({ orderId, trackingToken }),
                    );
                    setShowCredentials(false);
                  }
                }}
                disabled={!orderId || !trackingToken}
                className="min-h-[44px] flex-1 rounded-xl px-4 text-xs font-extrabold uppercase tracking-widest disabled:opacity-50"
                style={{ backgroundColor: brand?.accent ?? '#0f172a', color: brand?.accentForeground ?? '#ffffff' }}
              >
                Salva tracking
              </button>
              {hasCredentials && (
                <button
                  type="button"
                  onClick={() => setShowCredentials(false)}
                  className="min-h-[44px] rounded-xl border px-4 text-xs font-bold uppercase tracking-widest"
                  style={{ borderColor: brand?.border ?? '#e2e8f0', color: brand?.ink ?? '#0f172a' }}
                >
                  Chiudi
                </button>
              )}
            </div>
          </section>
        )}

        {loading && <p className="text-sm" style={{ color: muted }}>Aggiornamento stato ordine…</p>}
        {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {order && (
          <section className="space-y-4 rounded-2xl border p-5 shadow-sm" style={surfaceStyle}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Ordine #{order.id}</p>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest"
                style={{ backgroundColor: brand?.accentSoft ?? '#f1f5f9', color: brand?.accentText ?? '#0f172a' }}
              >
                {ORDER_STATUS_LABEL[order.status]}
              </span>
            </div>

            <div>
              <div className="h-2 w-full overflow-hidden rounded" style={{ backgroundColor: brand?.accentSoft ?? '#f1f5f9' }}>
                <div
                  className="h-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: brand?.accent ?? '#0f172a' }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums" style={{ color: muted }}>
                Progresso ordine: {progress}%
              </p>
            </div>

            <div className="space-y-1 text-xs" style={{ color: muted }}>
              <p>Ticket: <strong style={{ color: brand?.ink ?? '#0f172a' }}>{order.ticketNumber ?? '-'}</strong></p>
              <p>Cliente: <strong style={{ color: brand?.ink ?? '#0f172a' }}>{order.customerName ?? '-'}</strong></p>
              <p>Creato: <strong style={{ color: brand?.ink ?? '#0f172a' }}>{new Date(order.timestamp).toLocaleString()}</strong></p>
              {order.scheduledFor && (
                <p>Consegna prevista: <strong style={{ color: brand?.ink ?? '#0f172a' }}>{formatScheduledFor(order.scheduledFor)}</strong></p>
              )}
              <p>Totale: <strong className="tabular-nums" style={{ color: brand?.ink ?? '#0f172a' }}>{formatPrice(currency, order.total)}</strong></p>
            </div>

            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={`track-item-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  style={{ borderColor: brand?.border ?? '#e2e8f0', backgroundColor: brand?.pageBg ?? '#f8fafc' }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="text-xs tabular-nums" style={{ color: muted }}>Qty {item.quantity}</p>
                  </div>
                  <span className="flex-none text-xs font-extrabold tabular-nums">
                    {formatPrice(currency, item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <BrandFooter brand={brand} name={tenantName} />
    </main>
  );
}
