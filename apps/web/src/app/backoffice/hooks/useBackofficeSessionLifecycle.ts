import { useEffect, useState } from 'react';
import type { Staff } from '@gustopos/shared';
import { replayOfflineQueue } from '../../../store/app-store';

interface UseBackofficeSessionLifecycleParams {
  currentUser: Staff | null;
  hydrate: () => Promise<void>;
  syncSessionModules: () => Promise<void>;
}

export function useBackofficeSessionLifecycle(params: UseBackofficeSessionLifecycleParams) {
  const { currentUser, hydrate, syncSessionModules } = params;
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const interval = window.setInterval(() => {
      void syncSessionModules().catch(() => {
        // Session sync errors are handled by store (sets error state)
      });
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentUser, syncSessionModules]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      // Replay offline queue when connection is restored
      replayOfflineQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, []);

  return { isOnline, now };
}
