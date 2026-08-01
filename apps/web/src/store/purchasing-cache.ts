import type { PurchaseOrdersQuery, SuppliersQuery } from '@gustopos/shared';

export const SUPPLIERS_CACHE_TTL_MS = 60_000;
export const PURCHASE_ORDERS_CACHE_TTL_MS = 30_000;

export function normalizeSuppliersQuery(query?: SuppliersQuery): SuppliersQuery {
  return {
    active: query?.active,
    query: query?.query,
    limit: query?.limit ?? 200,
  };
}

export function suppliersQueryKey(query?: SuppliersQuery): string {
  return JSON.stringify(normalizeSuppliersQuery(query));
}

export function normalizePurchaseOrdersQuery(query?: PurchaseOrdersQuery): PurchaseOrdersQuery {
  return {
    supplierId: query?.supplierId,
    status: query?.status,
    from: query?.from,
    to: query?.to,
    limit: query?.limit ?? 200,
  };
}

export function purchaseOrdersQueryKey(query?: PurchaseOrdersQuery): string {
  return JSON.stringify(normalizePurchaseOrdersQuery(query));
}

export function isSuppliersQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < SUPPLIERS_CACHE_TTL_MS;
}

export function isPurchaseOrdersQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < PURCHASE_ORDERS_CACHE_TTL_MS;
}
