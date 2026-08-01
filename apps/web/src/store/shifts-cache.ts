import type { ShiftsQuery, TimeReportQuery } from '@gustopos/shared';

export const SHIFTS_CACHE_TTL_MS = 30_000;
export const TIME_REPORT_CACHE_TTL_MS = 60_000;

export function normalizeShiftsQuery(query?: ShiftsQuery): ShiftsQuery {
  return {
    staffId: query?.staffId,
    from: query?.from,
    to: query?.to,
    status: query?.status,
    limit: query?.limit ?? 200,
  };
}

export function shiftsQueryKey(query?: ShiftsQuery): string {
  return JSON.stringify(normalizeShiftsQuery(query));
}

export function normalizeTimeReportQuery(query: TimeReportQuery): TimeReportQuery {
  return {
    from: query.from,
    to: query.to,
    staffId: query.staffId,
  };
}

export function timeReportQueryKey(query: TimeReportQuery): string {
  return JSON.stringify(normalizeTimeReportQuery(query));
}

export function isShiftsQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < SHIFTS_CACHE_TTL_MS;
}

export function isTimeReportQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < TIME_REPORT_CACHE_TTL_MS;
}
