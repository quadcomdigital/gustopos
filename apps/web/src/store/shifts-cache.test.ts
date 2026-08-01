import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shift, TimeEntry, TimeReportResponse } from '@gustopos/shared';

const mocks = vi.hoisted(() => ({
  fetchShifts: vi.fn(),
  fetchTimeReport: vi.fn(),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
  fetchShifts: mocks.fetchShifts,
  fetchTimeReport: mocks.fetchTimeReport,
  createShift: mocks.createShift,
  updateShift: mocks.updateShift,
  clockIn: mocks.clockIn,
  clockOut: mocks.clockOut,
  logout: mocks.logout,
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';
import {
  isShiftsQueryFresh,
  isTimeReportQueryFresh,
  shiftsQueryKey,
  timeReportQueryKey,
} from './shifts-cache';

const shifts: Shift[] = [{
  id: 'shift-1',
  staffId: 'staff-1',
  shiftDate: '2026-08-01',
  startAt: '2026-08-01T09:00:00.000Z',
  endAt: '2026-08-01T17:00:00.000Z',
  toleranceEarlyMin: 15,
  toleranceLateMin: 15,
  status: 'scheduled',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
}];

const timeReport: TimeReportResponse = {
  totalMinutes: 480,
  totalHours: 8,
  entries: [{ staffId: 'staff-1', minutes: 480, date: '2026-08-01', anomaly: false }],
};

const timeEntry: TimeEntry = {
  id: 'entry-1',
  staffId: 'staff-1',
  shiftId: 'shift-1',
  clockInAt: '2026-08-01T09:00:00.000Z',
  clockOutAt: null,
  status: 'open',
  source: 'web',
  notes: null,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

function resetStore() {
  useAppStore.setState({
    currentUser: {
      id: 'staff-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      role: 'admin',
      enabledModules: ['staff_shifts_timeclock'],
      permissions: ['staff:manage'],
    },
    enabledModules: ['staff_shifts_timeclock'],
    permissions: ['staff:manage'],
    shifts: [],
    shiftsQuery: null,
    shiftsQueryKey: null,
    shiftsFetchedAt: null,
    timeEntries: [],
    timeReport: null,
    timeReportQuery: null,
    timeReportQueryKey: null,
    timeReportFetchedAt: null,
    error: null,
  });
}

describe('shifts store cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.fetchShifts.mockResolvedValue(shifts);
    mocks.fetchTimeReport.mockResolvedValue(timeReport);
    mocks.createShift.mockResolvedValue(shifts[0]);
    mocks.updateShift.mockResolvedValue(shifts[0]);
    mocks.clockIn.mockResolvedValue(timeEntry);
    mocks.clockOut.mockResolvedValue({ ...timeEntry, clockOutAt: '2026-08-01T17:00:00.000Z', status: 'closed' });
  });

  afterEach(() => vi.useRealTimers());

  it('normalizes independent shift and report keys with freshness boundaries', () => {
    const shiftQuery = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T23:59:59.000Z', limit: 200 };
    const reportQuery = { from: shiftQuery.from, to: shiftQuery.to };
    expect(shiftsQueryKey(shiftQuery)).not.toBe(timeReportQueryKey(reportQuery));
    expect(isShiftsQueryFresh(100_000, 129_999)).toBe(true);
    expect(isShiftsQueryFresh(100_000, 130_000)).toBe(false);
    expect(isTimeReportQueryFresh(100_000, 159_999)).toBe(true);
    expect(isTimeReportQueryFresh(100_000, 160_000)).toBe(false);
  });

  it('reuses fresh shift and report queries independently', async () => {
    const store = useAppStore.getState();
    const shiftsQuery = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T23:59:59.000Z', limit: 300 };
    const reportQuery = { from: shiftsQuery.from, to: shiftsQuery.to };

    await store.refreshShifts(shiftsQuery);
    await store.refreshShifts(shiftsQuery);
    await store.refreshTimeReport(reportQuery);
    await store.refreshTimeReport(reportQuery);

    expect(mocks.fetchShifts).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTimeReport).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().timeReport).toEqual(timeReport);
  });

  it('refetches shifts after the 30 second TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const store = useAppStore.getState();
    const query = { limit: 300 };

    await store.refreshShifts(query);
    vi.setSystemTime(129_999);
    await store.refreshShifts(query);
    vi.setSystemTime(130_000);
    await store.refreshShifts(query);

    expect(mocks.fetchShifts).toHaveBeenCalledTimes(2);
  });

  it('does not reuse different shift filters', async () => {
    const store = useAppStore.getState();
    await store.refreshShifts({ staffId: 'staff-1', limit: 300 });
    await store.refreshShifts({ staffId: 'staff-2', limit: 300 });

    expect(mocks.fetchShifts).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent report requests', async () => {
    let resolveReport!: (value: TimeReportResponse) => void;
    mocks.fetchTimeReport.mockReturnValueOnce(new Promise((resolve) => {
      resolveReport = resolve;
    }));

    const store = useAppStore.getState();
    const query = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T23:59:59.000Z' };
    const first = store.refreshTimeReport(query);
    const second = store.refreshTimeReport(query);

    expect(mocks.fetchTimeReport).toHaveBeenCalledTimes(1);
    resolveReport(timeReport);
    await Promise.all([first, second]);
    expect(useAppStore.getState().timeReport).toEqual(timeReport);
  });

  it('forces active shift and report queries after clock-in', async () => {
    const store = useAppStore.getState();
    const shiftsQuery = { from: '2026-08-01T00:00:00.000Z', to: '2026-08-01T23:59:59.000Z', limit: 300 };
    const reportQuery = { from: shiftsQuery.from, to: shiftsQuery.to };
    await store.refreshShifts(shiftsQuery);
    await store.refreshTimeReport(reportQuery);

    await store.clockIn({ staffId: 'staff-1', shiftId: 'shift-1', source: 'web', at: '2026-08-01T09:00:00.000Z' });

    expect(mocks.fetchShifts).toHaveBeenCalledTimes(2);
    expect(mocks.fetchTimeReport).toHaveBeenCalledTimes(2);
    expect(mocks.fetchShifts).toHaveBeenLastCalledWith(shiftsQuery);
    expect(mocks.fetchTimeReport).toHaveBeenLastCalledWith(reportQuery);
  });

  it('clears shift and report cache on logout while a request is pending', async () => {
    let resolveRequest!: (value: Shift[]) => void;
    mocks.fetchShifts.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const request = store.refreshShifts({ limit: 300 });
    await store.logout();
    resolveRequest(shifts);
    await request;

    expect(useAppStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().shifts).toEqual([]);
    expect(useAppStore.getState().shiftsQueryKey).toBeNull();
    expect(useAppStore.getState().timeEntries).toEqual([]);
    expect(useAppStore.getState().timeReport).toBeNull();
  });
});
