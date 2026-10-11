// JOLLY products: a POS-only line whose price is PRECONFIGURED from the
// selections instead of being typed ad-hoc by the waiter.
//
// The base every multiplier (MAXI ×2) scales is the item price plus the
// product's OWN modifier groups — for the casale JOLLY that is "Le due metà",
// where each option already carries `pizza price / 2`, so two halves total
// (pA + pB) / 2. Category pools (MAXI, Senza glutine) are deliberately NOT
// part of the base: MAXI doubles the composed pizza, surcharges stay additive
// on top.
//
// Both price surfaces (POSProductModal and the "Personalizza" ModifierModal)
// must use this helper, otherwise a MAXI picked in one would be priced
// against a different base in the other.
import { hasTenantOverride } from '@gustopos/shared';
import { computeGroupModifierDelta, type ModifierPriceGroupShape } from './modifier-pricing';

/** The subset of a modifier group the JOLLY base needs: an id plus the shape
 * the shared price helper understands. */
export type PricedGroup = { id: string } & ModifierPriceGroupShape;

/**
 * Is this item a JOLLY for the current tenant? The API already masks the
 * flag for tenants without the "jolly" capability; checking it again here
 * keeps the UI consistent even when a cached payload still carries it.
 */
export function isJollyItem(
  item: { isJolly?: boolean } | null | undefined,
  tenantId?: string,
): boolean {
  return Boolean(item?.isJolly) && hasTenantOverride('jolly', undefined, tenantId);
}

/**
 * Base price used for every `priceMultiplier` option on this line.
 *
 * Non-JOLLY items are unchanged (their own catalog price). A JOLLY item has
 * no typed price: its base is composed by the product's own groups, so MAXI
 * scales the halves instead of a value that would always be 0.
 */
export function composedPricingBase(
  isJolly: boolean,
  itemPrice: number,
  ownGroups: PricedGroup[],
  groupSelections: Record<string, string[]>,
): number {
  if (!isJolly) return itemPrice;
  // Base 0: the item price is added explicitly below, so nothing is counted
  // twice even if a product group ever carried its own multiplier.
  const composed = ownGroups.reduce(
    (sum, group) => sum + computeGroupModifierDelta(group, groupSelections[group.id] ?? [], 0),
    0,
  );
  return itemPrice + composed;
}
