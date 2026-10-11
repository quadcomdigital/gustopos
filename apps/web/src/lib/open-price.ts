// Open-price products: a POS-only line whose price is TYPED BY HAND by the
// waiter on the product modal, instead of coming from the catalog.
//
// The `isOpenPrice` flag marks which product(s) allow the manual input; the
// `openPrice` tenant override decides whether the capability exists at all for
// the current tenant. The API already masks the flag for tenants without the
// override, but checking it again here keeps the UI consistent even when a
// cached payload still carries it — exactly like `isJollyItem`.
import { hasTenantOverride } from '@gustopos/shared';

/** Is this item an open-price line for the current tenant? */
export function isOpenPriceItem(
  item: { isOpenPrice?: boolean } | null | undefined,
  tenantId?: string,
): boolean {
  return Boolean(item?.isOpenPrice) && hasTenantOverride('openPrice', undefined, tenantId);
}
