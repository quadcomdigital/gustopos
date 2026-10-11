import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { pushStaffCategories } from '@gustopos/shared';
import { isPushSupported, isSecureContextForPush } from '../shared/push/enablePush';
import { usePushToggle } from '../shared/push/usePushToggle';

const DISMISS_KEY = 'gustopos:push-prompt-dismissed';
const PROMPT_DELAY_MS = 8000;

/**
 * Staff entry point for enabling notifications on a terminal.
 *
 * `Settings → Notifiche` is admin-only, but the browser permission belongs to
 * the device, and the device belongs to whoever is working on it — so every
 * staff role gets this one-shot prompt. `Notification.permission` is read
 * synchronously, no request is fired until the card is actually visible.
 */
export default function NotificationsPermissionCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || !isSecureContextForPush()) return;
    if (Notification.permission !== 'default') return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // localStorage unavailable: still show the prompt.
    }
    const timer = window.setTimeout(() => setVisible(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return <PermissionPrompt onDismissed={() => setVisible(false)} />;
}

function PermissionPrompt({ onDismissed }: { onDismissed: () => void }) {
  const target = useMemo(() => ({ audience: 'staff' as const, categories: [...pushStaffCategories] }), []);
  const { state, enable } = usePushToggle(target);
  const [dismissedPermanently, setDismissedPermanently] = useState(false);

  // Permission resolved elsewhere (another tab, or the user answered the
  // browser prompt): stop asking.
  useEffect(() => {
    if (state.status !== 'default' && state.status !== 'loading') {
      onDismissed();
    }
  }, [state.status, onDismissed]);

  if (dismissedPermanently || state.status === 'loading') return null;

  const dismissPermanently = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissedPermanently(true);
    onDismissed();
  };

  const activate = async () => {
    const result = await enable(target.categories);
    if (result.ok) {
      window.setTimeout(onDismissed, 1200);
    }
  };

  return (
    <div className="fixed left-4 right-4 bottom-[calc(11rem+env(safe-area-inset-bottom))] md:left-auto md:right-4 md:bottom-28 md:w-80 z-[900] bg-white border border-border rounded-xl shadow-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell size={15} />
          </span>
          <div>
            <p className="text-sm font-bold text-primary">Attiva le notifiche</p>
            <p className="text-xs text-text-muted mt-0.5">
              Ordini, prenotazioni e avvisi di stampa anche quando l'app non è al primo piano
            </p>
          </div>
        </div>
        <button
          onClick={dismissPermanently}
          aria-label="Non mostrare più"
          className="text-text-muted hover:text-primary text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {state.error && <p className="text-xs text-danger font-medium">{state.error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => void activate()}
          disabled={state.busy}
          className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {state.busy ? 'Attivazione…' : 'Attiva'}
        </button>
        <button
          onClick={onDismissed}
          className="px-3 py-2 border border-border rounded-lg text-xs font-bold uppercase tracking-wider text-text-muted"
        >
          Non ora
        </button>
      </div>
    </div>
  );
}
