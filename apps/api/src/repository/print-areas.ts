// Legacy print_areas enum values replaced by dynamic station ids (migration
// 0072). They must never be treated as a routing key again: jobs, claimed
// areas and mappings all use station ids now. Values are normalized away on
// read so stale rows can never resurrect the old routing.
//
// Kept in its own module (no DB imports) so pure routing helpers and their
// tests can use it without pulling in the database client.
export const LEGACY_AREA_KEYS = new Set(["kitchen", "pizzeria", "bar", "cashier"]);

export function isLegacyAreaKey(value: unknown): value is string {
  return typeof value === "string" && LEGACY_AREA_KEYS.has(value.trim().toLowerCase());
}

/**
 * Drops empty, non-string and legacy-enum values from a routing key list, and
 * de-duplicates it: the same station listed twice is one station, not two
 * (it would otherwise be stored twice and reported as a conflict against
 * itself).
 */
export function normalizeStationIds(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0 || isLegacyAreaKey(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }
  return ids;
}

/**
 * Resolves the "which zones print" filter (`settings.printing.activeStationIds`)
 * against the live station registry.
 *
 * Contract: an EMPTY list means "every active station" (the read path treats an
 * empty filter as no filter), so it is passed through untouched.
 *
 * Deliberately permissive on stale ids — a station deleted or deactivated after
 * the setting was saved is DROPPED, not rejected: refusing would lock the admin
 * out of Settings, and keeping it would leave a key nobody resolves (which is
 * harmless but shows as a phantom chip in the UI).
 */
export function sanitizeActiveStationIds(
  values: readonly unknown[],
  activeStationIds: ReadonlySet<string>,
): string[] {
  return normalizeStationIds(values).filter((id) => activeStationIds.has(id));
}
