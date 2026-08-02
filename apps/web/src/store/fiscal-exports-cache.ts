import type { FiscalExportsQuery } from '@gustopos/shared';

export const FISCAL_EXPORTS_CACHE_TTL_MS = 30_000;

export function normalizeFiscalExportsQuery(query?: FiscalExportsQuery): FiscalExportsQuery {
  return {
    from: query?.from,
    to: query?.to,
    status: query?.status,
    limit: query?.limit ?? 200,
  };
}

export function fiscalExportsQueryKey(query?: FiscalExportsQuery): string {
  return JSON.stringify(normalizeFiscalExportsQuery(query));
}

export function isFiscalExportsQueryFresh(fetchedAt: number | null, now = Date.now()): boolean {
  return fetchedAt !== null && fetchedAt <= now && now - fetchedAt < FISCAL_EXPORTS_CACHE_TTL_MS;
}
