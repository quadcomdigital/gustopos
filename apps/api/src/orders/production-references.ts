/**
 * Production reference ("contenitore") resolution — pure helpers.
 *
 * Precedence per order line: main modifier (lowest sort_order) > product >
 * category. There is intentionally no name/regex inference. Quantity is 1:1:
 * the tally adds the sold quantity of each line to its resolved reference.
 */

export interface ReferenceCandidate {
  referenceId: string;
  sortOrder: number;
}

export function resolveItemReference(params: {
  modifierRefs: ReferenceCandidate[];
  itemRef?: string | null;
  categoryRef?: string | null;
}): string | null {
  const valid = params.modifierRefs.filter((candidate) => Boolean(candidate.referenceId));
  if (valid.length > 0) {
    return [...valid].sort((a, b) => a.sortOrder - b.sortOrder)[0].referenceId;
  }
  return params.itemRef ?? params.categoryRef ?? null;
}

export function buildReferenceTally(rows: Array<{ referenceId: string | null; quantity: number }>): Map<string, number> {
  const tally = new Map<string, number>();
  for (const row of rows) {
    if (!row.referenceId) continue;
    tally.set(row.referenceId, (tally.get(row.referenceId) ?? 0) + row.quantity);
  }
  return tally;
}
