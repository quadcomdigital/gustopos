// ─── JSON Parsers ─────────────────────────────────────────────────────────
// Extracted from app.repository.ts.
// These parse raw JSON strings from DB columns into typed arrays.

import { printAreaSchema, type PrintArea } from "@gustopos/shared";

export function parsePrintAreas(raw: string | null | undefined): PrintArea[] {
  if (!raw) {
    return ["kitchen"];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return ["kitchen"];
    }
    const valid = parsed
      .map((entry) => {
        try {
          return printAreaSchema.parse(entry);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is PrintArea => entry !== null);

    return valid.length > 0 ? valid : ["kitchen"];
  } catch {
    return ["kitchen"];
  }
}

export function parseSelectedModifiers(raw: string | null | undefined): Array<{ groupId: string; optionId: string }> {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is { groupId: string; optionId: string } =>
          typeof entry === "object" &&
          entry !== null &&
          "groupId" in entry &&
          "optionId" in entry &&
          typeof (entry as { groupId: unknown }).groupId === "string" &&
          typeof (entry as { optionId: unknown }).optionId === "string",
      )
      .map((entry) => ({ groupId: entry.groupId, optionId: entry.optionId }));
  } catch {
    return [];
  }
}

export function parseIngredientOverrides(raw: string | null | undefined): Array<{ ingredientId: string; action: "add" | "remove" }> {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is { ingredientId: string; action: "add" | "remove" } =>
          typeof entry === "object" &&
          entry !== null &&
          "ingredientId" in entry &&
          "action" in entry &&
          typeof (entry as { ingredientId: unknown }).ingredientId === "string" &&
          ((entry as { action: unknown }).action === "add" || (entry as { action: unknown }).action === "remove"),
      )
      .map((entry) => ({ ingredientId: entry.ingredientId, action: entry.action }));
  } catch {
    return [];
  }
}
