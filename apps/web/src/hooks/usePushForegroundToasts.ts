import { useEffect } from 'react';
import { pushToast } from '../shared/ui/toast';

/**
 * When the app is open and focused, the service worker does not raise a system
 * notification (see `push` handler in public/sw.js) — it forwards the payload
 * here instead, so the POS keeps its in-app feedback without stacking OS
 * notifications over an always-on terminal.
 */
export function usePushForegroundToasts(): void {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_FOREGROUND') return;
      const notification = event.data.notification as { title?: string; body?: string } | undefined;
      if (!notification?.title) return;
      pushToast('info', notification.body ? `${notification.title} — ${notification.body}` : notification.title);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);
}
