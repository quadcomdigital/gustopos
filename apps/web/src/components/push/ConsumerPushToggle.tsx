import { useMemo, useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import type { PushCategory, PushConsumerContext } from '@gustopos/shared';
import { isPushSupported, isSecureContextForPush, isStandalonePwa } from '../../shared/push/enablePush';
import { usePushToggle } from '../../shared/push/usePushToggle';

interface ConsumerPushToggleProps {
  tenantSlug: string;
  /** Binding created server-side: a takeaway tracking session or a group order. */
  context: PushConsumerContext;
  categories: PushCategory[];
  className?: string;
}

function isAppleTouch(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * "Attiva le notifiche" for the public menu flows. Renders nothing when the
 * browser/deployment cannot do Web Push, so the consumer pages stay clean.
 */
export default function ConsumerPushToggle({ tenantSlug, context, categories, className }: ConsumerPushToggleProps) {
  const target = useMemo(
    () => ({ audience: 'consumer' as const, tenantSlug, context, categories }),
    [tenantSlug, context, categories],
  );
  const { state, enable, disable } = usePushToggle(target);
  const [notice, setNotice] = useState('');

  if (!isPushSupported() || !isSecureContextForPush()) return null;
  if (state.status === 'loading' || state.status === 'unconfigured') return null;

  const subscribed = state.status === 'subscribed';
  const iosHint = isAppleTouch() && !isStandalonePwa();

  const activate = async () => {
    setNotice('');
    const result = await enable();
    if (!result.ok && result.message) setNotice(result.message);
  };

  return (
    <div className={`rounded-xl border border-[#e2e8f0] bg-white p-3 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0f172a]">
          <Bell size={15} className="text-[#64748b]" />
          {subscribed ? (
            <span className="inline-flex items-center gap-1">
              <Check size={15} className="text-emerald-600" />
              Notifiche attive
            </span>
          ) : (
            'Ricevi avvisi su questo ordine'
          )}
        </div>

        {subscribed ? (
          <button
            onClick={() => void disable()}
            disabled={state.busy}
            className="min-h-[36px] rounded-lg border border-[#e2e8f0] px-3 text-[11px] font-bold uppercase tracking-widest text-[#64748b] disabled:opacity-50"
          >
            <BellOff size={13} className="mr-1 inline" />
            Disattiva
          </button>
        ) : (
          <button
            onClick={() => void activate()}
            disabled={state.busy || state.status === 'denied'}
            className="min-h-[36px] rounded-lg bg-[#0f172a] px-3 text-[11px] font-extrabold uppercase tracking-widest text-white disabled:opacity-50"
          >
            {state.busy ? 'Attivazione…' : 'Attiva notifiche'}
          </button>
        )}
      </div>

      {state.error && <p className="mt-2 text-xs text-rose-700">{state.error}</p>}
      {!state.error && notice && <p className="mt-2 text-xs text-rose-700">{notice}</p>}
      {state.status === 'denied' && !state.error && (
        <p className="mt-2 text-xs text-[#64748b]">
          Permesso negato: riapri la pagina e consenti le notifiche dalle impostazioni del sito.
        </p>
      )}
      {iosHint && !subscribed && (
        <p className="mt-2 text-xs text-[#64748b]">
          Su iPhone/iPad le notifiche funzionano solo con il sito aggiunto alla schermata Home.
        </p>
      )}
    </div>
  );
}
