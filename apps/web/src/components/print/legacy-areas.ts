// Legacy print_areas enum values replaced by dynamic station ids (migration
// 0072). Kept client-side so stale values can never be rendered as if they
// were a station: they must be re-bound from Settings → Stampa.
export const LEGACY_AREA_KEYS = ["kitchen", "pizzeria", "bar", "cashier"] as const;

const LEGACY_AREA_SET = new Set<string>(LEGACY_AREA_KEYS);

export function isLegacyAreaKey(value: unknown): boolean {
  return typeof value === "string" && LEGACY_AREA_SET.has(value.trim().toLowerCase());
}

export function filterLegacyAreas(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .filter((value) => !isLegacyAreaKey(value));
}
