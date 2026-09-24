import type { PublicMenuResponse, PublicMenuModuleConfig } from '@gustopos/shared';
import { darkenToContrast, mix, readableOn } from './brand/tokens';
import type { MenuAppearance, MenuSectionId, MenuShellData, PublicBrandOverride } from './types';

/** Schema default accent; an explicit config value always wins over a brand. */
const DEFAULT_ACCENT = '#0f172a';

const GENERIC_SURFACE: Required<Pick<PublicBrandOverride, 'ink' | 'inkSoft' | 'pageBg' | 'surface' | 'border' | 'muted'>> = {
  ink: '#0f172a',
  inkSoft: '#1e293b',
  pageBg: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  muted: '#64748b',
};

/**
 * Merges the tenant/branding config from the API into the shape a shell
 * consumes. The API already normalises the config (defaults applied) and
 * resolves the scaffold key, so this is a light projection, not business logic.
 *
 * `brandOverride` is supplied by the scaffold registry and is plain data: this
 * module never learns which tenant it belongs to, which is what keeps the
 * per-tenant brand sealed inside `scaffolds/<tenant>/brand.ts`.
 *
 * Precedence: an explicitly configured value beats the code brand, so the
 * design editor stays meaningful; unset values fall back to the brand, then to
 * the schema defaults.
 */
export function buildAppearance(
  menu: PublicMenuResponse,
  config: PublicMenuModuleConfig,
  brandOverride?: PublicBrandOverride | null,
): MenuAppearance {
  const brand = brandOverride ?? {};

  const configuredAccent = config.accentColor || menu.branding.accentColor || DEFAULT_ACCENT;
  const accent = configuredAccent !== DEFAULT_ACCENT ? configuredAccent : (brand.accent ?? configuredAccent);

  const logoUrl = config.logoUrl || menu.branding.logoUrl || brand.logoUrl;

  return {
    accent,
    // Accent is a fill-first colour: derive a readable ink/paper pair once.
    accentForeground: readableOn(accent),
    accentText: darkenToContrast(accent),
    accentStrong: mix(accent, '#0b0b0c', 0.14),
    accentSoft: mix(accent, '#ffffff', 0.86),
    ink: brand.ink ?? GENERIC_SURFACE.ink,
    inkSoft: brand.inkSoft ?? GENERIC_SURFACE.inkSoft,
    pageBg: brand.pageBg ?? GENERIC_SURFACE.pageBg,
    surface: brand.surface ?? GENERIC_SURFACE.surface,
    border: brand.border ?? GENERIC_SURFACE.border,
    muted: brand.muted ?? GENERIC_SURFACE.muted,
    currency: config.currency || menu.branding.currency || 'EUR',
    preset: config.preset,
    tagline: config.content?.tagline || config.brandTagline,
    logoUrl,
    heroImageUrl: config.heroImageUrl || menu.branding.heroImageUrl,
    showPrices: config.showPrices,
    showIngredients: config.showIngredients,
  };
}

/** Section ids sorted by the tenant-configured order, missing ones appended. */
export function resolveSectionOrder(config: PublicMenuModuleConfig): MenuSectionId[] {
  return [...config.sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => section.id);
}

export function resolveEnabledSections(config: PublicMenuModuleConfig): Set<MenuSectionId> {
  return new Set(config.sections.filter((section) => section.enabled).map((section) => section.id));
}
