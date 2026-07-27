import { useCallback } from 'react';
import { pushToast } from '../../../shared/ui/toast';
import { logger } from '../../../lib/logger';
import {
  getImpersonationSnapshot,
  clearImpersonationSnapshot,
} from '../../../shared/auth/impersonation-snapshot';

interface UseImpersonationExitParams {
  currentTenantId?: string;
  onSuperadminReady: () => void;
}

export function useImpersonationExit(params: UseImpersonationExitParams) {
  const { currentTenantId, onSuperadminReady } = params;
  const hasImpersonationSnapshot = getImpersonationSnapshot() !== null;

  const stopSuperadminImpersonation = useCallback(async (
    token: string,
    refreshToken: string | null,
    tenantId: string,
    retried = false,
  ): Promise<void> => {
    const response = await fetch('/api/superadmin/impersonation/stop', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });
    if (response.ok) {
      return;
    }
    if (response.status === 401 && !retried && refreshToken) {
      const refreshResponse = await fetch('/api/superadmin/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!refreshResponse.ok) {
        throw new Error('Sessione superadmin scaduta, effettua di nuovo login.');
      }
      const refreshed = (await refreshResponse.json()) as { token: string; refreshToken: string };
      localStorage.setItem('gustopos:superadmin:token', refreshed.token);
      localStorage.setItem('gustopos:superadmin:refresh', refreshed.refreshToken);
      await stopSuperadminImpersonation(refreshed.token, refreshed.refreshToken, tenantId, true);
      return;
    }
    throw new Error('Impossibile chiudere correttamente l\'impersonazione.');
  }, []);

  const ensureSuperadminSession = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem('gustopos:superadmin:token');
    if (token) {
      return;
    }
    const refreshToken = localStorage.getItem('gustopos:superadmin:refresh');
    if (!refreshToken) {
      throw new Error('Sessione superadmin assente, effettua di nuovo login.');
    }
    const refreshResponse = await fetch('/api/superadmin/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshResponse.ok) {
      throw new Error('Sessione superadmin scaduta, effettua di nuovo login.');
    }
    const refreshed = (await refreshResponse.json()) as { token: string; refreshToken: string };
    localStorage.setItem('gustopos:superadmin:token', refreshed.token);
    localStorage.setItem('gustopos:superadmin:refresh', refreshed.refreshToken);
  }, []);

  const exitImpersonation = useCallback(async () => {
    const raw = localStorage.getItem('gustopos:superadmin:snapshot');
    if (!raw || !currentTenantId) {
      return;
    }

    let superadminToken: string | null = null;
    let superadminRefresh: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { superadminToken?: string | null; superadminRefresh?: string | null };
      if (parsed.superadminToken) {
        superadminToken = parsed.superadminToken;
        localStorage.setItem('gustopos:superadmin:token', parsed.superadminToken);
      }
      if (parsed.superadminRefresh) {
        superadminRefresh = parsed.superadminRefresh;
        localStorage.setItem('gustopos:superadmin:refresh', parsed.superadminRefresh);
      }
    } catch {
      // malformed snapshot -> continue with best effort cleanup below
    }

    try {
      if (superadminToken) {
        await stopSuperadminImpersonation(superadminToken, superadminRefresh, currentTenantId);
      } else if (superadminRefresh) {
        const refreshResponse = await fetch('/api/superadmin/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: superadminRefresh }),
        });
        if (!refreshResponse.ok) {
          throw new Error('Sessione superadmin non recuperabile.');
        }
        const refreshed = (await refreshResponse.json()) as { token: string; refreshToken: string };
        localStorage.setItem('gustopos:superadmin:token', refreshed.token);
        localStorage.setItem('gustopos:superadmin:refresh', refreshed.refreshToken);
        await stopSuperadminImpersonation(refreshed.token, refreshed.refreshToken, currentTenantId);
      }
    } catch (error) {
      logger.error('Exit impersonation failed', { error });
      pushToast('error', error instanceof Error ? error.message : 'Errore uscita impersonazione');
      return;
    }

    localStorage.removeItem('gustopos:token');
    localStorage.removeItem('gustopos:refreshToken');
    localStorage.removeItem('gustopos:user');
    localStorage.removeItem('gustopos:tenantId');
    localStorage.removeItem('gustopos:superadmin:snapshot');
    try {
      await ensureSuperadminSession();
    } catch (error) {
      logger.error('Superadmin session restore failed', { error });
      pushToast('error', error instanceof Error ? error.message : 'Sessione superadmin non valida');
    }
    localStorage.setItem('gustopos:superadmin:return', '1');
    onSuperadminReady();
  }, [currentTenantId, ensureSuperadminSession, onSuperadminReady, stopSuperadminImpersonation]);

  return {
    hasImpersonationSnapshot,
    exitImpersonation,
  };
}
