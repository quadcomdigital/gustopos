import { useCallback, useEffect, useState } from 'react';
import type { ModuleKey, SalesSummary, Staff } from '@gustopos/shared';
import { fetchDeliverySummary, fetchReservationsSummary, fetchSalesSummary } from '../../../shared/api/client';
import type { DeliverySummaryState, ReservationsSummaryState, SalesPeriod } from '../BackofficeContext';

interface UseOperationalSummariesParams {
  currentUser: Staff | null;
  enabledModules: ModuleKey[];
}

/** Absolute ISO bounds of a dashboard sales period (no bounds for `all`). */
function salesPeriodRange(period: SalesPeriod): { from?: string; to?: string } {
  const now = new Date();
  if (period === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30;
    return { from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString() };
  }
  return {};
}

export function useOperationalSummaries(params: UseOperationalSummariesParams) {
  const { currentUser, enabledModules } = params;
  const [reservationsSummary, setReservationsSummary] = useState<ReservationsSummaryState | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<DeliverySummaryState | null>(null);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesSummaryLoading, setSalesSummaryLoading] = useState(true);
  // Default to the last 7 days: on a fresh morning there are no sales yet, and a
  // dashboard that opens on €0.00 reads as "broken" rather than "so far today".
  const [salesPeriod, setSalesPeriodState] = useState<SalesPeriod>('7d');

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

  const refreshSalesSummary = useCallback(async () => {
    if (!enabledModules.includes('analytics')) {
      setSalesSummary(null);
      setSalesSummaryLoading(false);
      return;
    }
    setSalesSummaryLoading(true);
    try {
      setSalesSummary(await fetchSalesSummary(salesPeriodRange(salesPeriod)));
    } catch {
      setSalesSummary(null);
    } finally {
      setSalesSummaryLoading(false);
    }
  }, [enabledModules, salesPeriod]);

  const setSalesPeriod = useCallback((period: SalesPeriod) => {
    setSalesPeriodState(period);
  }, []);

  const enabledKey = enabledModules.join('|');
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] refreshOperationalSummaries calls store set() internally; called asynchronously via void
    void refreshOperationalSummaries();
  }, [currentUser, enabledKey, refreshOperationalSummaries]);

  // Runs on mount, on module changes and whenever the operator switches period.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      setSalesSummary(null);
      setSalesSummaryLoading(false);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] setSalesSummary runs after the awaited fetch; called asynchronously via void
    void refreshSalesSummary();
  }, [currentUser, enabledKey, refreshSalesSummary]);

  return {
    reservationsSummary,
    deliverySummary,
    refreshOperationalSummaries,
    salesSummary,
    salesSummaryLoading,
    salesPeriod,
    setSalesPeriod,
    refreshSalesSummary,
  };
}
