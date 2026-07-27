import { useEffect, useRef, useState } from 'react';
import { subscribeToasts, type ToastEventDetail } from '../shared/ui/toast';

type ToastItem = ToastEventDetail & { expiresAt: number };

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToasts((detail) => {
      setItems((prev) => [
        ...prev,
        {
          ...detail,
          expiresAt: Date.now() + 3800,
        },
      ]);
    });

    return () => {
      unsubscribe();
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  // Manage interval based on whether there are active toasts
  useEffect(() => {
    if (items.length > 0 && !intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        const now = Date.now();
        setItems((prev) => {
          const filtered = prev.filter((item) => item.expiresAt > now);
          if (filtered.length === 0 && intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return filtered;
        });
      }, 1000);
    }
  }, [items.length]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[1200] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]">
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-md backdrop-blur-sm ${
            item.level === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : item.level === 'error'
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
