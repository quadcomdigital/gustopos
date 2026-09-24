import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import DefaultMenuShell from '../shells/DefaultMenuShell';
import type { CartDrawerProps, MenuShellProps, ModifierSheetProps, PublicBrandOverride } from '../types';
import { FRANKS_BRAND } from './franks/brand';
import FranksCartDrawer from './franks/CartDrawer';
import FranksModifierSheet from './franks/ModifierSheet';

/**
 * Code-side per-tenant menu scaffolds.
 *
 * This registry is the ONLY place that knows a tenant's key. Each entry may
 * contribute:
 *  - `brand`             plain brand data (static, needed synchronously by the
 *                        shared appearance builder);
 *  - `Shell`             the bespoke menu layout — the large surface, kept lazy
 *                        so the default bundle stays lean;
 *  - `CartDrawer`        optional replacement for the generic cart overlay;
 *  - `ModifierSheet`     optional replacement for the generic options overlay;
 *  - `cartButton`        `'shell'` when the scaffold renders its own cart
 *                        affordance (the page then hides its floating pill).
 *
 * Overlays are imported eagerly on purpose: they are a few KB, and eager
 * loading avoids a Suspense hole (and a broken exit animation) on the first
 * open of the drawer. Anything not contributed falls back to the default shell /
 * generic overlays, so a scaffold opts in per surface rather than swapping
 * everything at once.
 */
export type ScaffoldDescriptor = {
  brand?: PublicBrandOverride;
  loadShell: () => Promise<{ default: ComponentType<MenuShellProps> }>;
  CartDrawer?: ComponentType<CartDrawerProps>;
  ModifierSheet?: ComponentType<ModifierSheetProps>;
  cartButton?: 'floating' | 'shell';
};

const SCAFFOLDS: Record<string, ScaffoldDescriptor> = {
  franks: {
    brand: FRANKS_BRAND,
    loadShell: () => import('./franks'),
    CartDrawer: FranksCartDrawer,
    ModifierSheet: FranksModifierSheet,
    cartButton: 'shell',
  },
};

type LazyShell = LazyExoticComponent<ComponentType<MenuShellProps>>;

/**
 * `lazy()` must be called once per key: creating a new component identity on
 * every render would remount the shell (and steal focus from the search box).
 */
const shellCache = new Map<string, LazyShell>();

export function resolveMenuScaffold(
  scaffoldKey: string | null | undefined,
): LazyShell | ComponentType<MenuShellProps> {
  if (!scaffoldKey || !SCAFFOLDS[scaffoldKey]) return DefaultMenuShell;
  const cached = shellCache.get(scaffoldKey);
  if (cached) return cached;
  const shell = lazy(SCAFFOLDS[scaffoldKey].loadShell);
  shellCache.set(scaffoldKey, shell);
  return shell;
}

/** Brand contributed by a tenant scaffold, or `null` when there is none. */
export function resolveScaffoldBrand(scaffoldKey: string | null | undefined): PublicBrandOverride | null {
  if (!scaffoldKey) return null;
  return SCAFFOLDS[scaffoldKey]?.brand ?? null;
}

/** Cart overlay for this tenant, or `null` to use the generic one. */
export function resolveCartDrawer(
  scaffoldKey: string | null | undefined,
): ComponentType<CartDrawerProps> | null {
  if (!scaffoldKey) return null;
  return SCAFFOLDS[scaffoldKey]?.CartDrawer ?? null;
}

/** Options overlay for this tenant, or `null` to use the generic one. */
export function resolveModifierSheet(
  scaffoldKey: string | null | undefined,
): ComponentType<ModifierSheetProps> | null {
  if (!scaffoldKey) return null;
  return SCAFFOLDS[scaffoldKey]?.ModifierSheet ?? null;
}

/** Where the cart button should render for this tenant. */
export function resolveCartAffordance(
  scaffoldKey: string | null | undefined,
): 'floating' | 'shell' {
  if (!scaffoldKey) return 'floating';
  return SCAFFOLDS[scaffoldKey]?.cartButton ?? 'floating';
}

export { DefaultMenuShell };
