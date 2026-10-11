// POS product grid ordering.
//
// Base behaviour: the grid renders the catalog exactly as the API hands it
// over (insertion / `sortOrder`) — the order the menu was curated in, which
// every tenant but one expects.
//
// Casale opted into `posAlphabeticalSort`: with ~150 products the waiter
// looks a dish up by name, so its grid is sorted A→Z instead. The switch
// lives in the shared tenant-overrides registry, so an unknown tenant always
// keeps the catalog order and nothing here has to know *which* tenant it is.
import { hasTenantOverride } from '@gustopos/shared';

/** The slice of the store this module reads (`tenantContext`). */
export type PosTenantContext = { tenantId: string; tenantSlug?: string } | null | undefined;

/**
 * Does the current tenant want its POS product grid sorted alphabetically?
 * Mirrors the other capability reads: slug first, then id (the store only
 * carries the id today).
 */
export function usesAlphabeticalPosOrder(tenantContext: PosTenantContext): boolean {
  return hasTenantOverride('posAlphabeticalSort', tenantContext?.tenantSlug, tenantContext?.tenantId);
}

/**
 * New array sorted A→Z by product name — the input is never mutated (it may
 * BE `data.menu`). Italian collation, accent/case insensitive, numeric so
 * "Pizza 2" precedes "Pizza 10".
 */
export function sortPosMenuAlphabetically<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true, sensitivity: 'base' }));
}
