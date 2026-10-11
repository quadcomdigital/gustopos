import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { pushStaffCategories, type PushCategory } from '@gustopos/shared';
import { fetchPushSubscription, sendPushTest } from '../../shared/api/client';
import { isPushSupported, isSecureContextForPush, isStandalonePwa } from '../../shared/push/enablePush';
import { usePushToggle } from '../../shared/push/usePushToggle';

const CATEGORY_INFO: Record<string, { label: string; hint: string }> = {
  orders: { label: 'Ordini', hint: 'Nuovi ordini, pronti da servire, annullati' },
  reservations: { label: 'Prenotazioni', hint: 'Nuove richieste in arrivo' },
  low_stock: { label: 'Scorte basse', hint: 'Ingredienti sotto la soglia minima' },
  printing: { label: 'Stampa', hint: 'Job falliti e bridge stampa offline' },
};

const ALL_CATEGORIES = [...pushStaffCategories] as PushCategory[];

function isAppleDevice(): boolean {
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !window.matchMedia('(pointer: fine)').matches;
}

/**
 * Settings → Notifiche: enables Web Push on THIS device, edits which
 * categories it receives and sends a test notification. The browser permission
 * is per-device, so the panel always talks about "questo dispositivo".
 */
export default function NotificationSettingsPanel() {
  const target = useMemo(() => ({ audience: 'staff' as const, categories: ALL_CATEGORIES }), []);
  const { state, enable, disable, saveCategories } = usePushToggle(target);
  const [selected, setSelected] = useState<PushCategory[]>(ALL_CATEGORIES);
  const [savedNotice, setSavedNotice] = useState('');
  const [testNotice, setTestNotice] = useState('');
  const idPrefix = useId();

  const subscribed = state.status === 'subscribed';
  const endpoint = state.endpoint;

  // Mirror the server-side record for this device (defaults when absent).
  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;
    void fetchPushSubscription(endpoint)
      .then((payload) => {
        if (cancelled) return;
        const categories = payload.subscription?.staffCategories;
        setSelected(categories && categories.length > 0 ? [...categories] : ALL_CATEGORIES);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const toggleCategory = useCallback((category: PushCategory) => {
    setSavedNotice('');
    setSelected((prev) =>
      prev.includes(category) ? prev.filter((entry) => entry !== category) : [...prev, category],
    );
  }, []);

  const save = useCallback(async () => {
    setSavedNotice('');
    if (selected.length === 0) {
      setSavedNotice('Seleziona almeno una categoria');
      return;
    }
    const ok = await saveCategories(selected);
    setSavedNotice(
      ok
        ? 'Preferenze salvate'
        : 'Attiva le notifiche su questo dispositivo prima di salvare le categorie',
    );
  }, [saveCategories, selected]);

  const sendTest = useCallback(async () => {
    setTestNotice('');
    try {
      const result = await sendPushTest(endpoint ?? undefined);
      setTestNotice(result.sent > 0 ? `Notifica inviata a ${result.sent} dispositiv${result.sent === 1 ? 'o' : 'i'}` : 'Nessun dispositivo raggiungibile');
    } catch (error) {
      setTestNotice(error instanceof Error ? error.message : 'Invio non riuscito');
    }
  }, [endpoint]);

  if (!isPushSupported()) {
    return (
      <div className="rounded border border-border bg-bg px-3 py-3 text-sm text-text-muted">
        Questo browser non supporta le notifiche push. Usa Chrome/Edge su Android o il terminale con la PWA
        installata (iOS 16.4+).
      </div>
    );
  }

  const statusBadge = () => {
    if (state.status === 'subscribed') return <span className="badge badge-success">attive</span>;
    if (state.status === 'denied') return <span className="badge badge-danger">bloccate</span>;
    if (state.status === 'unconfigured') return <span className="badge badge-warning">non configurate</span>;
    if (state.status === 'granted') return <span className="badge badge-info">permesso concesso</span>;
    return <span className="badge">disattive</span>;
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Questo dispositivo</p>
          {statusBadge()}
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between gap-3 rounded border border-border px-3 py-2">
            <dt className="text-text-muted">Permesso browser</dt>
            <dd className="font-semibold">{state.permission === 'unsupported' ? '—' : state.permission}</dd>
          </div>
          <div className="flex justify-between gap-3 rounded border border-border px-3 py-2">
            <dt className="text-text-muted">Servizio push (VAPID)</dt>
            <dd className="font-semibold">
              {state.configured === null ? 'da verificare' : state.configured ? 'configurato' : 'mancante'}
            </dd>
          </div>
        </dl>

        {state.configured === false && (
          <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            VAPID non configurato: genera le chiavi con <code>npx web-push generate-vapid-keys</code> e imposta{' '}
            <code>VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code> nel server API, poi riavvia.
          </p>
        )}

        {state.status === 'denied' && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            Permesso negato: riapri il sito, tocca l'icona lucchetto/nella barra degli indirizzi → Notifiche →
            Consenti, poi ricarica la pagina.
          </p>
        )}

        {state.error && <p className="text-xs text-danger font-medium">{state.error}</p>}

        <div className="flex flex-wrap gap-2">
          {!subscribed ? (
            <button
              onClick={() => void enable(selected.length > 0 ? selected : ALL_CATEGORIES)}
              disabled={state.busy || state.configured === false || state.status === 'denied'}
              className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Bell size={14} />
              {state.busy ? 'Attivazione…' : 'Attiva notifiche'}
            </button>
          ) : (
            <button
              onClick={() => void disable()}
              disabled={state.busy}
              className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
            >
              <BellOff size={14} />
              {state.busy ? 'Disattivazione…' : 'Disattiva'}
            </button>
          )}
          <button
            onClick={() => void sendTest()}
            disabled={state.busy || state.configured === false}
            className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={14} />
            Invia prova
          </button>
        </div>

        {testNotice && <p className="text-xs text-text-muted">{testNotice}</p>}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Categorie</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ALL_CATEGORIES.map((category) => {
            const info = CATEGORY_INFO[category];
            const checked = selected.includes(category);
            return (
              <label
                key={category}
                htmlFor={`${idPrefix}-${category}`}
                className={`flex items-start gap-3 rounded border px-3 py-2 ${
                  subscribed ? 'border-border cursor-pointer' : 'border-border opacity-50'
                }`}
              >
                <input
                  id={`${idPrefix}-${category}`}
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={!subscribed}
                  onChange={() => toggleCategory(category)}
                />
                <span>
                  <span className="block text-sm font-semibold">{info?.label ?? category}</span>
                  <span className="block text-xs text-text-muted">{info?.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void save()}
            disabled={!subscribed || state.busy}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Salva categorie
          </button>
          {savedNotice && <p className="text-xs text-text-muted">{savedNotice}</p>}
        </div>
        {!subscribed && (
          <p className="text-xs text-text-muted">
            Attiva le notifiche su questo dispositivo per scegliere le categorie.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 text-xs text-text-muted space-y-1">
        <p className="font-bold uppercase tracking-wider">Come funziona</p>
        <p>
          • Le notifiche arrivano solo finché il servizio push del browser è attivo: su iOS serve la PWA
          installata dalla schermata Home (iOS 16.4+).
        </p>
        <p>
          • Con l'app aperta e al primo piano l'avviso compare come toast dentro l'app, non come notifica di
          sistema: il terminale non si intasa.
        </p>
        {isAppleDevice() && !isStandalonePwa() && (
          <p>• Su iPhone/iPad aggiungi prima OmniRestaurant alla Home (Condividi → Aggiungi a schermata Home).</p>
        )}
        {!isSecureContextForPush() && <p>• Le notifiche richiedono HTTPS: su http:// non possono attivarsi.</p>}
      </div>
    </div>
  );
}
