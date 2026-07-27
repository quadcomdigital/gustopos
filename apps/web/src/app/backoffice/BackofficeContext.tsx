import { createContext, useContext } from 'react';

export interface ReservationsSummaryState {
  total: number;
  pending: number;
  confirmed: number;
  seated: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
}

export interface DeliverySummaryState {
  total: number;
  active: number;
  new: number;
  preparing: number;
  ready: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
}

export interface BackofficeContextValue {
  selectedTable: string | null;
  setSelectedTable: (value: string | null) => void;
  reservationsSummary: ReservationsSummaryState | null;
  deliverySummary: DeliverySummaryState | null;
  refreshOperationalSummaries: () => Promise<void>;
}

const BackofficeContext = createContext<BackofficeContextValue | null>(null);

export const BackofficeContextProvider = BackofficeContext.Provider;

export function useBackofficeContext(): BackofficeContextValue {
  const context = useContext(BackofficeContext);
  if (!context) {
    throw new Error('useBackofficeContext must be used inside BackofficeContextProvider');
  }
  return context;
}
