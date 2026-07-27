export type ToastLevel = 'success' | 'error' | 'info';

export interface ToastEventDetail {
  id: string;
  level: ToastLevel;
  message: string;
}

const TOAST_EVENT = 'gustopos:toast';

export function pushToast(level: ToastLevel, message: string): void {
  const detail: ToastEventDetail = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    level,
    message,
  };
  window.dispatchEvent(new CustomEvent<ToastEventDetail>(TOAST_EVENT, { detail }));
}

export function subscribeToasts(handler: (detail: ToastEventDetail) => void): () => void {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<ToastEventDetail>;
    if (!custom.detail) {
      return;
    }
    handler(custom.detail);
  };

  window.addEventListener(TOAST_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener(TOAST_EVENT, listener as EventListener);
  };
}
