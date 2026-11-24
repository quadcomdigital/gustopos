import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TablePaymentStatus } from '../shared/api/client';

// The checkout shows rows from the socket-backed store while the amounts due
// come from a server-fresh payment status: opening it must reconcile the
// snapshot first, never pairing stale lines with a fresh total.
const h = vi.hoisted(() => {
  const calls: string[] = [];
  const paymentStatus = {
    totalAmount: 50,
    paidAmount: 50,
    remainingAmount: 0,
    items: [],
  };
  return {
    calls,
    paymentStatus,
    reconcileOperationalData: vi.fn(async () => {
      calls.push('reconcile');
    }),
    getTablePaymentStatus: vi.fn(async () => {
      calls.push('status');
      return paymentStatus;
    }),
  };
});

vi.mock('./app-store', () => ({
  useAppStore: {
    getState: () => ({
      reconcileOperationalData: h.reconcileOperationalData,
      getTablePaymentStatus: h.getTablePaymentStatus,
    }),
  },
}));

import { useCheckoutStore } from './checkout-store';

const staleStatus = {
  totalAmount: 40,
  paidAmount: 0,
  remainingAmount: 40,
  items: [],
} as unknown as TablePaymentStatus;

describe('checkout-store.openCheckout', () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.reconcileOperationalData.mockClear();
    h.getTablePaymentStatus.mockClear();
    useCheckoutStore.setState({
      isOpen: false,
      step: 'main',
      tableId: null,
      tableNumber: null,
      paymentStatus: null,
      splitShares: [],
      error: '',
    });
  });

  it('reconciles orders/tables before loading the payment status', async () => {
    await useCheckoutStore.getState().openCheckout('table-1', '5');

    expect(h.calls).toEqual(['reconcile', 'status']);
    expect(useCheckoutStore.getState().paymentStatus).toEqual(h.paymentStatus);
  });

  it('drops the previous conto payment status while the new one loads', async () => {
    useCheckoutStore.setState({ paymentStatus: staleStatus });

    const pending = useCheckoutStore.getState().openCheckout('table-2', '6');
    // Not yet reconciled: the modal must not show the other table's amounts.
    expect(useCheckoutStore.getState().paymentStatus).toBeNull();

    await pending;
    expect(useCheckoutStore.getState().paymentStatus).toEqual(h.paymentStatus);
  });

  it('stays open and records the error when the status request fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.getTablePaymentStatus.mockRejectedValueOnce(new Error('boom'));

    await useCheckoutStore.getState().openCheckout('table-1', '5');

    expect(useCheckoutStore.getState().isOpen).toBe(true);
    expect(useCheckoutStore.getState().error).toBe('Failed to load payment status');
    consoleError.mockRestore();
  });
});
