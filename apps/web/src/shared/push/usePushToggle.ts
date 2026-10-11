import { useCallback, useEffect, useRef, useState } from 'react';
import type { PushCategory } from '@gustopos/shared';
import {
  disablePush,
  enablePush,
  fetchConfigFor,
  isPushSupported,
  readPushSubscription,
  savePushCategories,
  type PushEnableResult,
  type PushTarget,
} from './enablePush';

export type PushToggleStatus =
  | 'loading'
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'default'
  | 'granted'
  | 'subscribed';

export interface PushToggleState {
  status: PushToggleStatus;
  permission: NotificationPermission | 'unsupported';
  /** null = the config endpoint could not be reached (yet). */
  configured: boolean | null;
  endpoint: string | null;
  busy: boolean;
  error: string;
}

const initialState: PushToggleState = {
  status: 'loading',
  permission: 'default',
  configured: null,
  endpoint: null,
  busy: false,
  error: '',
};

/**
 * One device = one subscription. The hook tracks the browser side (permission
 * + PushManager) and the VAPID availability of the deployment, and exposes the
 * three actions a UI needs: enable, disable, change categories.
 */
export function usePushToggle(target: PushTarget): {
  state: PushToggleState;
  refresh: () => Promise<void>;
  enable: (categories?: PushCategory[]) => Promise<PushEnableResult>;
  disable: () => Promise<boolean>;
  saveCategories: (categories: PushCategory[]) => Promise<boolean>;
} {
  const [state, setState] = useState<PushToggleState>(initialState);
  const targetRef = useRef(target);
  targetRef.current = target;

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState({ ...initialState, status: 'unsupported', permission: 'unsupported' });
      return;
    }

    const permission = Notification.permission;
    let configured: boolean | null = null;
    try {
      configured = (await fetchConfigFor(targetRef.current)).configured;
    } catch {
      configured = null;
    }

    let subscription: globalThis.PushSubscription | null = null;
    try {
      subscription = await readPushSubscription();
    } catch {
      subscription = null;
    }

    let status: PushToggleStatus;
    if (configured === false) status = 'unconfigured';
    else if (permission === 'denied') status = 'denied';
    else if (subscription && permission === 'granted') status = 'subscribed';
    else if (permission === 'granted') status = 'granted';
    else status = 'default';

    setState({
      status,
      permission,
      configured,
      endpoint: subscription?.endpoint ?? null,
      busy: false,
      error: '',
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(
    async (categories?: PushCategory[]): Promise<PushEnableResult> => {
      setState((prev) => ({ ...prev, busy: true, error: '' }));
      const result = await enablePush({ ...targetRef.current, categories: categories ?? targetRef.current.categories });
      await refresh();
      if (!result.ok) {
        setState((prev) => ({ ...prev, busy: false, error: result.message }));
      }
      return result;
    },
    [refresh],
  );

  const disable = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, busy: true, error: '' }));
    const done = await disablePush(targetRef.current);
    await refresh();
    if (!done) {
      setState((prev) => ({ ...prev, busy: false }));
    }
    return done;
  }, [refresh]);

  const saveCategories = useCallback(
    async (categories: PushCategory[]): Promise<boolean> => {
      const endpoint = (await readPushSubscription())?.endpoint ?? null;
      if (!endpoint) {
        setState((prev) => ({ ...prev, error: 'Attiva le notifiche su questo dispositivo prima di salvare' }));
        return false;
      }
      setState((prev) => ({ ...prev, busy: true, error: '' }));
      try {
        await savePushCategories(endpoint, targetRef.current.audience, categories);
        await refresh();
        return true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          busy: false,
          error: error instanceof Error ? error.message : 'Salvataggio non riuscito',
        }));
        return false;
      }
    },
    [refresh],
  );

  return { state, refresh, enable, disable, saveCategories };
}
