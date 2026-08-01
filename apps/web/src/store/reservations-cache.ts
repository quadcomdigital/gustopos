import type { ReservationsQuery } from '@gustopos/shared';

export const RESERVATIONS_CACHE_TTL_MS = 30_000;

export function normalizeReservationsQuery(query?: ReservationsQuery): ReservationsQuery {
  return {
    from: query?.from,
    to: query?.to,
    status: query?.status,
    limit: query?.limit ?? 200,
  };
}

export function reservationsQueryKey(query?: ReservationsQuery): string {
  return JSON.stringify(normalizeReservationsQuery(query));
}

export function isReservationsQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < RESERVATIONS_CACHE_TTL_MS;
}
