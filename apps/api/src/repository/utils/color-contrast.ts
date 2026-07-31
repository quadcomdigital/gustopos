// ─── Color Contrast Utilities ────────────────────────────────────────────
// Extracted from app.repository.ts — pure math, no DB/NestJS deps.
// Used by validateThemeContrast() for WCAG compliance checks.

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function channelToLinear(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const lr = channelToLinear(r);
  const lg = channelToLinear(g);
  const lb = channelToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminance(fgHex);
  const l2 = luminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
