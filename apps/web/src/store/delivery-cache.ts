import type { DeliveryOrdersQuery } from '@gustopos/shared';

export const DELIVERY_CACHE_TTL_MS = 15_000;

export function normalizeDeliveryQuery(query?: DeliveryOrdersQuery): DeliveryOrdersQuery {
  return {
    status: query?.status,
    from: query?.from,
    to: query?.to,
    limit: query?.limit ?? 200,
  };
}

export function deliveryQueryKey(query?: DeliveryOrdersQuery): string {
  return JSON.stringify(normalizeDeliveryQuery(query));
}

export function isDeliveryQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < DELIVERY_CACHE_TTL_MS;
}
