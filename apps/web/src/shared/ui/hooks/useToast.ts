import { useCallback, useState } from 'react';
import type { ToastItem, ToastAction } from '../molecules/Toast';

let globalCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, options?: { type?: ToastItem['type']; action?: ToastAction; duration?: number }) => {
    const id = `toast-${++globalCounter}`;
    const toast: ToastItem = { id, message, type: options?.type, action: options?.action };
    setToasts((prev) => [...prev, toast]);
    const duration = options?.duration ?? 4000;
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return { toasts, show, dismiss };
}
