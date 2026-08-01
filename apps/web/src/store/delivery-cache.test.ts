import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryOrder } from '@gustopos/shared';

const mocks = vi.hoisted(() => ({
  fetchDeliveryOrders: vi.fn(),
  upsertDeliveryOrder: vi.fn(),
  updateDeliveryOrderStatus: vi.fn(),
  dispatchDeliveryOrder: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
  fetchDeliveryOrders: mocks.fetchDeliveryOrders,
  upsertDeliveryOrder: mocks.upsertDeliveryOrder,
  updateDeliveryOrderStatus: mocks.updateDeliveryOrderStatus,
  dispatchDeliveryOrder: mocks.dispatchDeliveryOrder,
  logout: mocks.logout,
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';
import {
  deliveryQueryKey,
  isDeliveryQueryFresh,
  normalizeDeliveryQuery,
} from './delivery-cache';

const deliveryOrders: DeliveryOrder[] = [
  {
    id: 'delivery-1',
    orderId: 'order-1',
    customerAddress: 'Via Roma 1',
    courierName: 'Ada',
    courierPhone: '+39000000000',
    eta: '2026-08-01T19:30:00.000Z',
    status: 'ready' as const,
    statusChangedAt: '2026-08-01T19:00:00.000Z',
    assignedAt: '2026-08-01T19:05:00.000Z',
    deliveryFee: 2,
    notes: 'Citofonare',
    createdAt: '2026-08-01T18:00:00.000Z',
    updatedAt: '2026-08-01T19:00:00.000Z',
  },
];

function resetStore() {
  useAppStore.setState({
    currentUser: {
      id: 'staff-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      role: 'admin',
      enabledModules: ['delivery'],
      permissions: ['delivery:manage'],
    },
    enabledModules: ['delivery'],
    permissions: ['delivery:manage'],
    deliveryOrders: [],
    deliveryOrdersQuery: null,
    deliveryOrdersQueryKey: null,
    deliveryOrdersFetchedAt: null,
    error: null,
  });
}

describe('delivery store cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.fetchDeliveryOrders.mockResolvedValue(deliveryOrders);
    mocks.upsertDeliveryOrder.mockResolvedValue(deliveryOrders[0]);
    mocks.updateDeliveryOrderStatus.mockResolvedValue(deliveryOrders[0]);
    mocks.dispatchDeliveryOrder.mockResolvedValue(deliveryOrders[0]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes query keys and rejects future timestamps', () => {
    expect(normalizeDeliveryQuery({}).limit).toBe(200);
    expect(deliveryQueryKey({ limit: 200 })).toBe(deliveryQueryKey({}));
    expect(isDeliveryQueryFresh(100_000, 114_999)).toBe(true);
    expect(isDeliveryQueryFresh(100_000, 115_000)).toBe(false);
    expect(isDeliveryQueryFresh(120_000, 115_000)).toBe(false);
  });

  it('reuses the same query within the 15 second TTL', async () => {
    const store = useAppStore.getState();
    const query = { status: 'ready' as const, limit: 300 };

    await store.refreshDeliveryOrders(query);
    await store.refreshDeliveryOrders(query);

    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().deliveryOrdersQueryKey).toBe(deliveryQueryKey(query));
  });

  it('refetches after the TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const store = useAppStore.getState();
    const query = { limit: 300 };

    await store.refreshDeliveryOrders(query);
    vi.setSystemTime(114_999);
    await store.refreshDeliveryOrders(query);
    vi.setSystemTime(115_000);
    await store.refreshDeliveryOrders(query);

    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(2);
  });

  it('does not reuse data when the status or date query changes', async () => {
    const store = useAppStore.getState();
    const firstQuery = {
      status: 'ready' as const,
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-01T23:59:59.000Z',
      limit: 300,
    };
    const secondQuery = { ...firstQuery, status: 'out_for_delivery' as const };

    await store.refreshDeliveryOrders(firstQuery);
    await store.refreshDeliveryOrders(secondQuery);

    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(2);
    expect(mocks.fetchDeliveryOrders).toHaveBeenNthCalledWith(1, firstQuery);
    expect(mocks.fetchDeliveryOrders).toHaveBeenNthCalledWith(2, secondQuery);
  });

  it('force refresh bypasses a fresh cache entry', async () => {
    const store = useAppStore.getState();
    const query = { status: 'ready' as const, limit: 300 };

    await store.refreshDeliveryOrders(query);
    await store.refreshDeliveryOrders(query, true);

    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests for the same query', async () => {
    let resolveRequest!: (value: typeof deliveryOrders) => void;
    mocks.fetchDeliveryOrders.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const first = store.refreshDeliveryOrders({ limit: 300 });
    const second = store.refreshDeliveryOrders({ limit: 300 });

    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(1);
    resolveRequest(deliveryOrders);
    await Promise.all([first, second]);
    expect(useAppStore.getState().deliveryOrders).toEqual(deliveryOrders);
  });

  it('prevents an older query response from overwriting the latest query', async () => {
    let resolveReady!: (value: typeof deliveryOrders) => void;
    let resolveOutForDelivery!: (value: typeof deliveryOrders) => void;
    mocks.fetchDeliveryOrders
      .mockReturnValueOnce(new Promise((resolve) => { resolveReady = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveOutForDelivery = resolve; }));

    const store = useAppStore.getState();
    const readyRequest = store.refreshDeliveryOrders({ status: 'ready', limit: 300 });
    const outForDeliveryRequest = store.refreshDeliveryOrders({ status: 'out_for_delivery', limit: 300 });

    resolveOutForDelivery([{ ...deliveryOrders[0], status: 'out_for_delivery' }]);
    await outForDeliveryRequest;
    resolveReady(deliveryOrders);
    await readyRequest;

    expect(useAppStore.getState().deliveryOrdersQueryKey).toBe(
      deliveryQueryKey({ status: 'out_for_delivery', limit: 300 }),
    );
    expect(useAppStore.getState().deliveryOrders[0]?.status).toBe('out_for_delivery');
  });

  it('refreshes the active query after creating a delivery order', async () => {
    const store = useAppStore.getState();
    const query = { status: 'ready' as const, limit: 300 };

    await store.refreshDeliveryOrders(query);
    await store.upsertDeliveryOrder('order-2', {
      customerAddress: 'Via Milano 2',
      status: 'new',
      deliveryFee: 0,
    });

    expect(mocks.upsertDeliveryOrder).toHaveBeenCalledWith('order-2', {
      customerAddress: 'Via Milano 2',
      status: 'new',
      deliveryFee: 0,
    });
    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(2);
    expect(mocks.fetchDeliveryOrders).toHaveBeenLastCalledWith(query);
  });

  it('refreshes the active query after a status mutation', async () => {
    const store = useAppStore.getState();
    const query = { status: 'ready' as const, limit: 300 };

    await store.refreshDeliveryOrders(query);
    await store.updateDeliveryOrderStatus('order-1', { status: 'out_for_delivery' });

    expect(mocks.updateDeliveryOrderStatus).toHaveBeenCalledWith('order-1', {
      status: 'out_for_delivery',
    });
    expect(mocks.fetchDeliveryOrders).toHaveBeenCalledTimes(2);
    expect(mocks.fetchDeliveryOrders).toHaveBeenLastCalledWith(query);
  });

  it('invalidates a pending request when the session logs out', async () => {
    let resolveRequest!: (value: typeof deliveryOrders) => void;
    mocks.fetchDeliveryOrders.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const request = store.refreshDeliveryOrders({ limit: 300 });
    await store.logout();
    resolveRequest(deliveryOrders);
    await request;

    expect(useAppStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().deliveryOrders).toEqual([]);
    expect(useAppStore.getState().deliveryOrdersQueryKey).toBeNull();
  });
});
