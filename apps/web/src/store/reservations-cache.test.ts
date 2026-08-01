import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchReservations: vi.fn(),
  createReservation: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
  fetchReservations: mocks.fetchReservations,
  createReservation: mocks.createReservation,
  logout: mocks.logout,
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';
import { isReservationsQueryFresh, reservationsQueryKey } from './reservations-cache';

const reservations = [
  {
    id: 'reservation-1',
    customerName: 'Ada Lovelace',
    partySize: 2,
    reservedFor: '2026-08-01T19:00:00.000Z',
    status: 'pending' as 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no_show',
    source: 'manual',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
];

function resetStore() {
  useAppStore.setState({
    currentUser: {
      id: 'staff-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      role: 'admin',
      enabledModules: ['reservations'],
      permissions: ['reservations:manage'],
    },
    enabledModules: ['reservations'],
    permissions: ['reservations:manage'],
    reservations: [],
    reservationsQuery: null,
    reservationsQueryKey: null,
    reservationsFetchedAt: null,
    error: null,
  });
}

describe('reservations store cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.fetchReservations.mockResolvedValue(reservations);
    mocks.createReservation.mockResolvedValue(reservations[0]);
  });

  it('normalizes query keys and freshness boundaries', () => {
    expect(reservationsQueryKey({ limit: 200 })).toBe(reservationsQueryKey({}));
    expect(isReservationsQueryFresh(100_000, 129_999)).toBe(true);
    expect(isReservationsQueryFresh(100_000, 130_000)).toBe(false);
    expect(isReservationsQueryFresh(140_000, 130_000)).toBe(false);
  });

  it('refetches the same query after the TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const store = useAppStore.getState();
    const query = { limit: 50 };

    await store.refreshReservations(query);
    vi.setSystemTime(129_999);
    await store.refreshReservations(query);
    vi.setSystemTime(130_000);
    await store.refreshReservations(query);

    expect(mocks.fetchReservations).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('reuses a fresh result only for the same query', async () => {
    const store = useAppStore.getState();
    const firstQuery = { status: 'pending' as const, limit: 50 };

    await store.refreshReservations(firstQuery);
    await store.refreshReservations(firstQuery);
    await store.refreshReservations({ status: 'confirmed', limit: 50 });

    expect(mocks.fetchReservations).toHaveBeenCalledTimes(2);
    expect(mocks.fetchReservations).toHaveBeenNthCalledWith(1, {
      from: undefined,
      to: undefined,
      status: 'pending',
      limit: 50,
    });
    expect(mocks.fetchReservations).toHaveBeenNthCalledWith(2, {
      from: undefined,
      to: undefined,
      status: 'confirmed',
      limit: 50,
    });
  });

  it('force refresh bypasses a fresh cache entry', async () => {
    const store = useAppStore.getState();
    const query = { limit: 50 };

    await store.refreshReservations(query);
    await store.refreshReservations(query, true);

    expect(mocks.fetchReservations).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests for the same query', async () => {
    let resolveRequest!: (value: typeof reservations) => void;
    mocks.fetchReservations.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const first = store.refreshReservations({ limit: 50 });
    const second = store.refreshReservations({ limit: 50 });

    expect(mocks.fetchReservations).toHaveBeenCalledTimes(1);
    resolveRequest(reservations);
    await Promise.all([first, second]);
    expect(useAppStore.getState().reservations).toEqual(reservations);
  });

  it('force refresh supersedes an older in-flight request for the same query', async () => {
    let resolveOld!: (value: typeof reservations) => void;
    let resolveFresh!: (value: typeof reservations) => void;
    mocks.fetchReservations
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveFresh = resolve; }));

    const store = useAppStore.getState();
    const oldRequest = store.refreshReservations({ limit: 50 });
    const freshRequest = store.refreshReservations({ limit: 50 }, true);

    resolveFresh([{ ...reservations[0], customerName: 'Fresh result' }]);
    await freshRequest;
    resolveOld(reservations);
    await oldRequest;

    expect(mocks.fetchReservations).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().reservations[0]?.customerName).toBe('Fresh result');
  });

  it('prevents an older query response from overwriting the latest query', async () => {
    let resolvePending!: (value: typeof reservations) => void;
    let resolveConfirmed!: (value: typeof reservations) => void;
    mocks.fetchReservations
      .mockReturnValueOnce(new Promise((resolve) => { resolvePending = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveConfirmed = resolve; }));

    const store = useAppStore.getState();
    const pendingRequest = store.refreshReservations({ status: 'pending', limit: 50 });
    const confirmedRequest = store.refreshReservations({ status: 'confirmed', limit: 50 });

    resolveConfirmed([{ ...reservations[0], status: 'confirmed' }]);
    await confirmedRequest;
    resolvePending(reservations);
    await pendingRequest;

    expect(useAppStore.getState().reservationsQueryKey).toBe(
      reservationsQueryKey({ status: 'confirmed', limit: 50 }),
    );
    expect(useAppStore.getState().reservations[0]?.status).toBe('confirmed');
  });

  it('invalidates a pending request when the session logs out', async () => {
    let resolveRequest!: (value: typeof reservations) => void;
    mocks.fetchReservations.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const request = store.refreshReservations({ limit: 50 });
    await store.logout();
    resolveRequest(reservations);
    await request;

    expect(useAppStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().reservations).toEqual([]);
    expect(useAppStore.getState().reservationsQueryKey).toBeNull();
  });

  it('forces the active query after creating a reservation', async () => {
    const store = useAppStore.getState();
    const query = { status: 'pending' as const, limit: 50 };

    await store.refreshReservations(query);
    await store.createReservation({
      customerName: 'Grace Hopper',
      partySize: 2,
      reservedFor: '2026-08-01T19:00:00.000Z',
      source: 'manual',
    });

    expect(mocks.createReservation).toHaveBeenCalledTimes(1);
    expect(mocks.fetchReservations).toHaveBeenCalledTimes(2);
    expect(mocks.fetchReservations).toHaveBeenLastCalledWith({
      from: undefined,
      to: undefined,
      status: 'pending',
      limit: 50,
    });
  });
});
