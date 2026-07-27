import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { OrderItem, SelfOrderResolveResponse } from '@gustopos/shared';
import { createPublicSelfOrder, resolvePublicSelfOrderSession } from '../shared/api/client';

interface CartItem extends OrderItem {
  quantity: number;
}

function formatPrice(currency: string, value: number): string {
  if (currency.toUpperCase() === 'EUR') {
    return `EUR ${value.toFixed(2)}`;
  }
  return `${currency.toUpperCase()} ${value.toFixed(2)}`;
}

export default function PublicSelfOrderPage() {
  const { tenantSlug = '', token = '' } = useParams();
  const [resolved, setResolved] = useState<SelfOrderResolveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState('');

  const currency = resolved?.menu.branding.currency ?? 'EUR';

  useEffect(() => {
    if (!tenantSlug || !token) {
      setError('Link self-order non valido');
      setLoading(false);
      return;
    }

    setLoading(true);
    void resolvePublicSelfOrderSession(tenantSlug, token)
      .then((payload) => {
        setResolved(payload);
        setError('');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Impossibile caricare la sessione self-order');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tenantSlug, token]);

  const grouped = useMemo(() => {
    if (!resolved) {
      return [] as Array<{ category: string; items: SelfOrderResolveResponse['menu']['items'] }>;
    }

    const map = new Map<string, SelfOrderResolveResponse['menu']['items']>();
    for (const item of resolved.menu.items) {
      const key = item.category || 'Menu';
      const next = map.get(key) ?? [];
      next.push(item);
      map.set(key, next);
    }

    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [resolved]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const addItem = (item: SelfOrderResolveResponse['menu']['items'][number]) => {
    setCart((current) => {
      const found = current.find((entry) => entry.id === item.id);
      if (!found) {
        return [...current, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
      }
      return current.map((entry) =>
        entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
      );
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((current) =>
      current
        .map((entry) => (entry.id === id ? { ...entry, quantity: Math.max(0, entry.quantity + delta) } : entry))
        .filter((entry) => entry.quantity > 0),
    );
  };

  const submitOrder = async () => {
    if (!resolved || cart.length === 0 || !tenantSlug || !token) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const result = await createPublicSelfOrder(tenantSlug, {
        token,
        items: cart,
        total,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSuccessOrderId(result.order.id);
      setCart([]);
      setNotes('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Invio ordine fallito');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100">Caricamento self-order...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-red-600 px-4 text-center">{error}</div>;
  }

  if (!resolved) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-500">Self Order QR</p>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">{resolved.menu.tenant.name}</h1>
          <p className="text-sm text-slate-600 mt-2">
            Tavolo <strong>{resolved.session.tableNumber}</strong> • sessione valida fino alle{' '}
            {new Date(resolved.session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 space-y-4">
            {grouped.map((group) => (
              <article key={group.category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 mb-3">{group.category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="text-left rounded-xl border border-slate-200 p-3 hover:border-slate-300 hover:shadow-sm transition"
                    >
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.category}</p>
                      <p className="text-sm font-bold text-slate-900 mt-2">{formatPrice(currency, item.price)}</p>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm h-fit sticky top-4 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">Carrello</h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {cart.length === 0 && <p className="text-xs text-slate-500">Nessun prodotto selezionato.</p>}
              {cart.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded p-2">
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-0.5 border rounded" onClick={() => updateQty(item.id, -1)}>-</button>
                      <span className="text-sm font-semibold">{item.quantity}</span>
                      <button className="px-2 py-0.5 border rounded" onClick={() => updateQty(item.id, 1)}>+</button>
                    </div>
                    <span className="text-xs font-bold">{formatPrice(currency, item.price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <input
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nome cliente (opzionale)"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
              />
              <input
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Telefono (opzionale)"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Note ordine (opzionale)"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[72px]"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Totale</span>
                <strong className="text-slate-900">{formatPrice(currency, total)}</strong>
              </div>
              <button
                onClick={() => void submitOrder()}
                disabled={submitting || cart.length === 0}
                className="w-full px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {submitting ? 'Invio...' : 'Invia ordine'}
              </button>
              {successOrderId && (
                <p className="text-xs text-emerald-600 font-semibold">Ordine inviato con successo (ID: {successOrderId})</p>
              )}
            </div>
          </aside>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white p-3 lg:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">Totale carrello</p>
            <p className="text-sm font-bold text-slate-900">{formatPrice(currency, total)}</p>
          </div>
          <button
            onClick={() => void submitOrder()}
            disabled={submitting || cart.length === 0}
            className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {submitting ? 'Invio...' : 'Invia ordine'}
          </button>
        </div>
      </div>
    </main>
  );
}
