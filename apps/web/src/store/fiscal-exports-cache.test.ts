import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchFiscalExports: vi.fn(),
  createFiscalExport: vi.fn(),
  closeFiscalDay: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
  fetchFiscalExports: mocks.fetchFiscalExports,
  createFiscalExport: mocks.createFiscalExport,
  closeFiscalDay: mocks.closeFiscalDay,
  logout: mocks.logout,
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';
import { fiscalExportsQueryKey, isFiscalExportsQueryFresh } from './fiscal-exports-cache';

const fiscalExports = [
  {
    id: 'export-1',
    businessDate: '2026-08-01',
    format: 'csv' as const,
    status: 'completed' as const,
    path: '/exports/gustopos/2026-08-01.csv',
    generatedByStaffId: 'staff-1',
    generatedAt: '2026-08-01T10:00:00.000Z',
  },
];

function resetStore() {
  useAppStore.setState({
    currentUser: {
      id: 'staff-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      role: 'admin',
      enabledModules: ['fiscal_exports'],
      permissions: ['fiscal:close', 'fiscal:export'],
    },
    enabledModules: ['fiscal_exports'],
    permissions: ['fiscal:close', 'fiscal:export'],
    fiscalExports: [],
    fiscalExportsQuery: null,
    fiscalExportsQueryKey: null,
    fiscalExportsFetchedAt: null,
    error: null,
  });
}

describe('fiscal exports store cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.fetchFiscalExports.mockResolvedValue(fiscalExports);
    mocks.createFiscalExport.mockResolvedValue(fiscalExports[0]);
  });

  it('normalizes query keys and freshness boundaries', () => {
    expect(fiscalExportsQueryKey({ limit: 200 })).toBe(fiscalExportsQueryKey({}));
    expect(isFiscalExportsQueryFresh(100_000, 129_999)).toBe(true);
    expect(isFiscalExportsQueryFresh(100_000, 130_000)).toBe(false);
    expect(isFiscalExportsQueryFresh(140_000, 130_000)).toBe(false);
  });

  it('refetches the same query after the TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const store = useAppStore.getState();
    const query = { limit: 50 };

    await store.refreshFiscalExports(query);
    vi.setSystemTime(129_999);
    await store.refreshFiscalExports(query);
    vi.setSystemTime(130_000);
    await store.refreshFiscalExports(query);

    expect(mocks.fetchFiscalExports).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('reuses a fresh result only for the same query', async () => {
    const store = useAppStore.getState();

    await store.refreshFiscalExports({ limit: 50 });
    await store.refreshFiscalExports({ limit: 50 });
    await store.refreshFiscalExports({ limit: 100 });

    expect(mocks.fetchFiscalExports).toHaveBeenCalledTimes(2);
    expect(mocks.fetchFiscalExports).toHaveBeenNthCalledWith(1, {
      from: undefined,
      to: undefined,
      status: undefined,
      limit: 50,
    });
    expect(mocks.fetchFiscalExports).toHaveBeenNthCalledWith(2, {
      from: undefined,
      to: undefined,
      status: undefined,
      limit: 100,
    });
  });

  it('force refresh bypasses a fresh cache entry', async () => {
    const store = useAppStore.getState();
    const query = { limit: 50 };

    await store.refreshFiscalExports(query);
    await store.refreshFiscalExports(query, true);

    expect(mocks.fetchFiscalExports).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent requests for the same query', async () => {
    let resolveRequest!: (value: typeof fiscalExports) => void;
    mocks.fetchFiscalExports.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const first = store.refreshFiscalExports({ limit: 50 });
    const second = store.refreshFiscalExports({ limit: 50 });

    expect(mocks.fetchFiscalExports).toHaveBeenCalledTimes(1);
    resolveRequest(fiscalExports);
    await Promise.all([first, second]);
    expect(useAppStore.getState().fiscalExports).toEqual(fiscalExports);
  });

  it('force refresh supersedes an older in-flight request for the same query', async () => {
    let resolveOld!: (value: typeof fiscalExports) => void;
    let resolveFresh!: (value: typeof fiscalExports) => void;
    mocks.fetchFiscalExports
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveFresh = resolve; }));

    const store = useAppStore.getState();
    const oldRequest = store.refreshFiscalExports({ limit: 50 });
    const freshRequest = store.refreshFiscalExports({ limit: 50 }, true);

    resolveFresh([{ ...fiscalExports[0], path: '/exports/fresh.csv' }]);
    await freshRequest;
    resolveOld(fiscalExports);
    await oldRequest;

    expect(mocks.fetchFiscalExports).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().fiscalExports[0]?.path).toBe('/exports/fresh.csv');
  });

  it('prevents an older query response from overwriting the latest query', async () => {
    let resolveSmall!: (value: typeof fiscalExports) => void;
    let resolveLarge!: (value: typeof fiscalExports) => void;
    mocks.fetchFiscalExports
      .mockReturnValueOnce(new Promise((resolve) => { resolveSmall = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveLarge = resolve; }));

    const store = useAppStore.getState();
    const smallRequest = store.refreshFiscalExports({ limit: 50 });
    const largeRequest = store.refreshFiscalExports({ limit: 100 });

    resolveLarge([{ ...fiscalExports[0], id: 'export-large' }]);
    await largeRequest;
    resolveSmall(fiscalExports);
    await smallRequest;

    expect(useAppStore.getState().fiscalExportsQueryKey).toBe(
      fiscalExportsQueryKey({ limit: 100 }),
    );
    expect(useAppStore.getState().fiscalExports[0]?.id).toBe('export-large');
  });

  it('invalidates a pending request when the session logs out', async () => {
    let resolveRequest!: (value: typeof fiscalExports) => void;
    mocks.fetchFiscalExports.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const request = store.refreshFiscalExports({ limit: 50 });
    await store.logout();
    resolveRequest(fiscalExports);
    await request;

    expect(useAppStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().fiscalExports).toEqual([]);
    expect(useAppStore.getState().fiscalExportsQueryKey).toBeNull();
  });

  it('invalidates the query cache after creating an export', async () => {
    const store = useAppStore.getState();

    await store.refreshFiscalExports({ limit: 50 });
    await store.createFiscalExport({ businessDate: '2026-08-01', format: 'csv' });
    // The cache was invalidated by the mutation, so a same-query load refetches.
    await store.refreshFiscalExports({ limit: 50 });

    expect(mocks.createFiscalExport).toHaveBeenCalledTimes(1);
    expect(mocks.fetchFiscalExports).toHaveBeenCalledTimes(2);
  });
});
