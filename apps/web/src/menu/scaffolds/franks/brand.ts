import type { PublicBrandOverride } from '../../types';
import logoUrl from './assets/franks-logo.png';

/**
 * Franks palette, extracted from the tenant logo (a white wordmark with a
 * golden yellow accent on a transparent canvas). Because that artwork only
 * reads on dark surfaces, the brand keeps a dark chrome and uses yellow
 * strictly as a fill — never as text on a light background.
 */
export const FRANKS_PALETTE = {
  /** Dark chrome: header, hero, sticky nav, drawer header. */
  ink: '#0b0b0c',
  inkSoft: '#16161a',
  /** Brand accent (fill only). */
  accent: '#fbda1b',
  /** Content canvas: warm neutral so it pairs with the yellow. */
  pageBg: '#f7f7f4',
  surface: '#ffffff',
  border: '#e8e6e0',
  muted: '#6b6a64',
} as const;

export const FRANKS_LOGO_URL = logoUrl;

/** Brand contributed by this scaffold; the registry hands it to the shared layer. */
export const FRANKS_BRAND: PublicBrandOverride = {
  accent: FRANKS_PALETTE.accent,
  ink: FRANKS_PALETTE.ink,
  inkSoft: FRANKS_PALETTE.inkSoft,
  pageBg: FRANKS_PALETTE.pageBg,
  surface: FRANKS_PALETTE.surface,
  border: FRANKS_PALETTE.border,
  muted: FRANKS_PALETTE.muted,
  logoUrl: FRANKS_LOGO_URL,
};
