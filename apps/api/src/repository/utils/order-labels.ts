// ─── Order Labels ─────────────────────────────────────────────────────────
// Pure helpers to render order item overrides / modifier options as human
// labels, never opaque ids (prep_…, cmpo_…) when a name is available.

export function formatIngredientOverrideLabel(
  action: string,
  ingredientId: string,
  nameById: ReadonlyMap<string, string>,
): string {
  const name = nameById.get(ingredientId) ?? ingredientId;
  return action === "remove" ? `- ${name}` : `+ ${name}`;
}

export function formatIngredientOverrides(
  overrides: ReadonlyArray<{ ingredientId: string; action: string }>,
  nameById: ReadonlyMap<string, string>,
): string[] {
  return overrides.map((entry) => formatIngredientOverrideLabel(entry.action, entry.ingredientId, nameById));
}
