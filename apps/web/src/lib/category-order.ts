/**
 * Category ordering (Magazzino → Categorie → frecce su/giù).
 *
 * The endpoint takes the COMPLETE id list of one scope and renumbers it, so
 * the client must never build that list from a filtered view: the helper is
 * always handed the whole group and returns the whole group back, minus the
 * single swap. Anything else (a truncated list) would silently renumber only
 * part of the group and scramble the tenant's order.
 */

/** Next full-group id order after moving `id` one slot, `null` when blocked. */
export function moveCategoryInGroup<T extends { id: string }>(
  group: readonly T[],
  id: string,
  direction: -1 | 1,
): string[] | null {
  const from = group.findIndex((entry) => entry.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= group.length) return null;
  const next = [...group];
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((entry) => entry.id);
}

/** Is `id` at the edge of its group (its up/down arrow must be disabled)? */
export function isCategoryAtGroupEdge<T extends { id: string }>(
  group: readonly T[],
  id: string,
  direction: -1 | 1,
): boolean {
  const index = group.findIndex((entry) => entry.id === id);
  if (index < 0) return true;
  return direction === -1 ? index === 0 : index === group.length - 1;
}
