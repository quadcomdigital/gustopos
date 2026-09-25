import { hasTenantOverride, type TenantOverrideKey } from "@gustopos/shared";
import { getTenantContext, getTenantIdOrDefault } from "./tenant-context.store";

/**
 * Current-tenant read of the static capability registry.
 *
 * Thin wrapper around `hasTenantOverride` so call sites never have to think
 * about *which* tenant key they hold: the middleware context carries both the
 * slug and the id, and the registry accepts either (first match wins). Every
 * call defaults to `false` for an unknown tenant — the base behaviour.
 *
 * Used by the read/write paths that must not expose or persist a capability a
 * tenant never opted into (JOLLY ad-hoc pricing, ×2 modifier multiplier).
 */
export function hasTenantOverrideFor(override: TenantOverrideKey): boolean {
  const context = getTenantContext();
  return hasTenantOverride(override, context?.tenantSlug, context?.tenantId ?? getTenantIdOrDefault());
}
