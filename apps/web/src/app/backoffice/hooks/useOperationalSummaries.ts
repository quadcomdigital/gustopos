import { useCallback, useEffect, useState } from 'react';
import type { ModuleKey, Staff } from '@gustopos/shared';
import { fetchDeliverySummary, fetchReservationsSummary } from '../../../shared/api/client';
import type { DeliverySummaryState, ReservationsSummaryState } from '../BackofficeContext';

interface UseOperationalSummariesParams {
  currentUser: Staff | null;
  enabledModules: ModuleKey[];
}

export function useOperationalSummaries(params: UseOperationalSummariesParams) {
  const { currentUser, enabledModules } = params;
  const [reservationsSummary, setReservationsSummary] = useState<ReservationsSummaryState | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummaryState | null>(null);

  const refreshOperationalSummaries = useCallback(async () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const [reservations, delivery] = await Promise.all([
      enabledModules.includes('reservations') ? fetchReservationsSummary({ from, to }).catch(() => null) : Promise.resolve(null),
      enabledModules.includes('delivery') ? fetchDeliverySummary({ from, to }).catch(() => null) : Promise.resolve(null),
    ]);

    setReservationsSummary(reservations);
    setDeliverySummary(delivery);
  }, [enabledModules]);

  const enabledKey = enabledModules.join('|');
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] refreshOperationalSummaries calls store set() internally; called asynchronously via void
    void refreshOperationalSummaries();
  }, [currentUser, enabledKey, refreshOperationalSummaries]);

  return {
    reservationsSummary,
    deliverySummary,
    refreshOperationalSummaries,
  };
}
