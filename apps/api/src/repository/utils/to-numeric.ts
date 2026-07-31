// ─── Numeric Conversion ───────────────────────────────────────────────────
// Extracted from app.repository.ts — pure function.

export function toNumeric(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}
