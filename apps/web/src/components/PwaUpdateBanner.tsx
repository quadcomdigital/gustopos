import { useEffect, useState } from 'react';

/**
 * PwaUpdateBanner — listens for the service worker's NEW_VERSION message and
 * offers an explicit "reload now" action, so an installed PWA picks up the
 * latest build without losing in-flight work (POS cart, open modals).
 *
 * On the login screen (no active session) it auto-reloads instead of waiting,
 * because nothing is at risk there and the waiter wants the newest version
 * immediately.
 */
export default function PwaUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEW_VERSION') {
        // Safe to auto-reload on the login screen (no session, no cart).
        const hasSession = (() => {
          try {
            return Boolean(localStorage.getItem('gustopos:token') && localStorage.getItem('gustopos:refreshToken'));
          } catch {
            return false;
          }
        })();
        if (!hasSession) {
          window.location.reload();
          return;
        }
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[950] bg-primary text-white rounded-xl shadow-2xl p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider">Nuova versione disponibile</p>
        <p className="text-[11px] text-white/70 mt-0.5">Ricarica per aggiornare l'app</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1.5 rounded-lg bg-white text-primary text-xs font-bold uppercase tracking-wider hover:bg-white/90 transition-colors shrink-0"
      >
        Aggiorna
      </button>
    </div>
  );
}
