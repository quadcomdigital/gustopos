import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseOrder, Supplier } from '@gustopos/shared';

const mocks = vi.hoisted(() => ({
  fetchSuppliers: vi.fn(),
  fetchPurchaseOrders: vi.fn(),
  createSupplier: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrderStatus: vi.fn(),
  createGoodsReceipt: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../shared/api/client', async () => ({
  ...(await vi.importActual<typeof import('../shared/api/client')>('../shared/api/client')),
  fetchSuppliers: mocks.fetchSuppliers,
  fetchPurchaseOrders: mocks.fetchPurchaseOrders,
  createSupplier: mocks.createSupplier,
  createPurchaseOrder: mocks.createPurchaseOrder,
  updatePurchaseOrderStatus: mocks.updatePurchaseOrderStatus,
  createGoodsReceipt: mocks.createGoodsReceipt,
  logout: mocks.logout,
}));

vi.mock('../shared/api/socket', () => ({
  getSocket: () => ({ connected: true, on: vi.fn(), off: vi.fn() }),
  disconnectSocket: vi.fn(),
}));

import { useAppStore } from './app-store';
import {
  isPurchaseOrdersQueryFresh,
  isSuppliersQueryFresh,
  purchaseOrdersQueryKey,
  suppliersQueryKey,
} from './purchasing-cache';

const suppliers: Supplier[] = [{
  id: 'supplier-1',
  name: 'Acme Foods',
  isActive: true,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}];

const purchaseOrders: PurchaseOrder[] = [{
  id: 'po-1',
  supplierId: 'supplier-1',
  status: 'draft',
  expectedAt: undefined,
  notes: undefined,
  items: [],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}];

function resetStore() {
  useAppStore.setState({
    currentUser: {
      id: 'staff-1',
      tenantId: 'tenant-1',
      name: 'Admin',
      role: 'admin',
      enabledModules: ['purchasing_suppliers'],
      permissions: ['purchasing:manage'],
    },
    enabledModules: ['purchasing_suppliers'],
    permissions: ['purchasing:manage'],
    suppliers: [],
    suppliersQuery: null,
    suppliersQueryKey: null,
    suppliersFetchedAt: null,
    purchaseOrders: [],
    purchaseOrdersQuery: null,
    purchaseOrdersQueryKey: null,
    purchaseOrdersFetchedAt: null,
    error: null,
  });
}

describe('purchasing store cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    mocks.fetchSuppliers.mockResolvedValue(suppliers);
    mocks.fetchPurchaseOrders.mockResolvedValue(purchaseOrders);
    mocks.createSupplier.mockResolvedValue(suppliers[0]);
    mocks.createPurchaseOrder.mockResolvedValue(purchaseOrders[0]);
    mocks.updatePurchaseOrderStatus.mockResolvedValue(purchaseOrders[0]);
    mocks.createGoodsReceipt.mockResolvedValue({
      id: 'receipt-1',
      purchaseOrderId: 'po-1',
      receivedAt: '2026-08-01T12:00:00.000Z',
      items: [],
      createdAt: '2026-08-01T12:00:00.000Z',
    });
  });

  afterEach(() => vi.useRealTimers());

  it('uses independent query keys and freshness windows', () => {
    expect(suppliersQueryKey({ limit: 200 })).toBe(suppliersQueryKey({}));
    expect(purchaseOrdersQueryKey({ limit: 200 })).toBe(purchaseOrdersQueryKey({}));
    expect(isSuppliersQueryFresh(100_000, 159_999)).toBe(true);
    expect(isSuppliersQueryFresh(100_000, 160_000)).toBe(false);
    expect(isPurchaseOrdersQueryFresh(100_000, 129_999)).toBe(true);
    expect(isPurchaseOrdersQueryFresh(100_000, 130_000)).toBe(false);
  });

  it('reuses fresh supplier and purchase-order queries independently', async () => {
    const store = useAppStore.getState();
    await store.refreshSuppliers({ query: 'acme', limit: 200 });
    await store.refreshSuppliers({ query: 'acme', limit: 200 });
    await store.refreshPurchaseOrders({ status: 'draft', limit: 200 });
    await store.refreshPurchaseOrders({ status: 'draft', limit: 200 });

    expect(mocks.fetchSuppliers).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(1);
  });

  it('refetches purchase orders after their TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const store = useAppStore.getState();
    const query = { status: 'draft' as const, limit: 200 };

    await store.refreshPurchaseOrders(query);
    vi.setSystemTime(129_999);
    await store.refreshPurchaseOrders(query);
    vi.setSystemTime(130_000);
    await store.refreshPurchaseOrders(query);

    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(2);
  });

  it('does not reuse different supplier or purchase-order filters', async () => {
    const store = useAppStore.getState();
    await store.refreshSuppliers({ active: true, limit: 200 });
    await store.refreshSuppliers({ active: false, limit: 200 });
    await store.refreshPurchaseOrders({ status: 'draft', limit: 200 });
    await store.refreshPurchaseOrders({ status: 'sent', limit: 200 });

    expect(mocks.fetchSuppliers).toHaveBeenCalledTimes(2);
    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent purchase-order requests', async () => {
    let resolveRequest!: (value: PurchaseOrder[]) => void;
    mocks.fetchPurchaseOrders.mockReturnValueOnce(new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const store = useAppStore.getState();
    const first = store.refreshPurchaseOrders({ limit: 200 });
    const second = store.refreshPurchaseOrders({ limit: 200 });

    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(1);
    resolveRequest(purchaseOrders);
    await Promise.all([first, second]);
    expect(useAppStore.getState().purchaseOrders).toEqual(purchaseOrders);
  });

  it('forces the active supplier query after creating a supplier', async () => {
    const store = useAppStore.getState();
    const query = { active: true, limit: 200 };
    await store.refreshSuppliers(query);
    await store.createSupplier({ name: 'New Supplier' });

    expect(mocks.fetchSuppliers).toHaveBeenCalledTimes(2);
    expect(mocks.fetchSuppliers).toHaveBeenLastCalledWith(query);
  });

  it('forces the active purchase-order query after status and receipt mutations', async () => {
    const store = useAppStore.getState();
    const query = { status: 'draft' as const, limit: 200 };
    await store.refreshPurchaseOrders(query);

    await store.updatePurchaseOrderStatus('po-1', { status: 'sent' });
    await store.createGoodsReceipt('po-1', { receivedAt: '2026-08-01T12:00:00.000Z', items: [] });

    expect(mocks.fetchPurchaseOrders).toHaveBeenCalledTimes(3);
    expect(mocks.fetchPurchaseOrders).toHaveBeenLastCalledWith(query);
  });
});
