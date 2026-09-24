import type { PublicMenuResponse } from '@gustopos/shared';
import { buildAppearance } from '../useMenuConfig';
import { resolveScaffoldBrand } from '../scaffolds';
import type { MenuAppearance } from '../types';

/**
 * A resolved visual identity for a public surface.
 *
 * Surfaces shared by every tenant (group order, order tracking) do not go
 * through the scaffold shell, so they resolve their brand here: the registry
 * hands back whatever the tenant's scaffold contributes, merged with their own
 * `public_menu` config. Tenants without a scaffold keep a neutral look.
 */
export type PublicBrand = MenuAppearance & {
  name: string;
  /** True when the identity comes from a code-side scaffold rather than config. */
  isCodeBrand: boolean;
};

export function resolvePublicBrand(menu: PublicMenuResponse): PublicBrand {
  const override = resolveScaffoldBrand(menu.scaffoldKey);
  return {
    ...buildAppearance(menu, menu.config, override),
    name: menu.tenant.name,
    isCodeBrand: Boolean(override),
  };
}
