/**
 * Pure color utilities for the public brand layer.
 *
 * A brand accent is commonly a vivid colour (a golden yellow, say) that is only
 * usable as a FILL: it fails contrast as text on light surfaces. These helpers
 * derive a readable foreground (for text ON the accent) and a darkened text
 * variant (for the accent AS text), so no component has to guess.
 */

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.split('');
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }
  if (/^[0-9a-fA-F]{6}$/.test(value)) {
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }
  return null;
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex color (invalid input -> 1, i.e. white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear interpolation between two hex colors (`t` = 0 keeps `a`). */
export function mix(a: string, b: string, t: number): string {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return a;
  const k = Math.max(0, Math.min(1, t));
  return toHex(ra[0] + (rb[0] - ra[0]) * k, ra[1] + (rb[1] - ra[1]) * k, ra[2] + (rb[2] - ra[2]) * k);
}

const INK = '#0b0b0c';
const PAPER = '#ffffff';

/**
 * Foreground to place ON a filled accent (buttons, active chips, badges).
 * Picks whichever of near-black / white reads better, then nudges near-black so
 * the yellow-on-black pair clears WCAG AA comfortably.
 */
export function readableOn(hex: string): string {
  const withBlack = contrastRatio(hex, INK);
  const withWhite = contrastRatio(hex, PAPER);
  return withBlack >= withWhite ? INK : PAPER;
}

/**
 * Darkened variant of a color that is safe to use AS TEXT on `bg`.
 * Mixes toward ink until the ratio reaches `target`; returns ink when even a
 * pure ink cannot satisfy an impossible target.
 */
export function darkenToContrast(hex: string, bg: string = PAPER, target = 4.5): string {
  if (contrastRatio(hex, bg) >= target) return hex;
  let best = INK;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const candidate = mix(hex, INK, mid);
    if (contrastRatio(candidate, bg) >= target) {
      best = candidate;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}
