/**
 * Static per-tenant capability overrides.
 *
 * This registry is the ONLY place allowed to know that a behaviour exists for
 * one tenant but not for the others. Everything generic stays in the base code
 * (contracts, pricing engine, components); what lives here is the *switch* that
 * says who may use it. Data never comes from here — rows in the database are
 * still the source of truth for a tenant's catalog; this only decides whether
 * a tenant's UI shows the control and whether the API accepts/exposes it.
 *
 * Layering (three tiers, deliberately separate):
 *   1. `tenant_modules`        → module on/off (feature flags)
 *   2. `tenant_module_configs` → per-module data
 *   3. THIS registry           → behaviour deviations from the base code
 *
 * Adding a capability = add the key to `TenantOverrideKey`, give it a default
 * of `false`, then opt the tenants in below. Callers must never default to
 * `true`: an unknown tenant always gets the base behaviour.
 *
 * Lookups accept a slug and/or a tenant id because callers differ: the API
 * resolves both (slug comes from the tenant row), while the POS store only
 * carries `tenantContext.tenantId`. Both forms resolve to the same entry, the
 * same way `PUBLIC_MENU_SCAFFOLD_KEYS` on the API side keys by either.
 */

export type TenantOverrideKey =
  /** POS JOLLY product: a POS-only line whose price is composed by the selections (no ad-hoc typing). */
  | "jolly"
  /** Modifier options that scale the item price instead of adding to it (MAXI ×2). */
  | "modifierMultiplier"
  /** POS product grid sorted alphabetically instead of catalog (insertion/sortOrder) order. */
  | "posAlphabeticalSort"
  /** Station-ticket item notes (`* nota`) printed at GS 2x1 instead of the normal Font A size. */
  | "stationNotes2x1"
  /** Station-ticket `Comanda: <numero>` line dropped (it repeats `Ordine:` when the order has no ticket number). */
  | "stationHideComandaLine"
  /** Station-ticket `Tavolo:` value printed at GS 2x1 (double width, same height). */
  | "stationTable2x1"
  /** POS-only line whose price is typed BY HAND on the product modal (open price). */
  | "openPrice";

export type TenantOverrides = Readonly<Record<TenantOverrideKey, boolean>>;

/** Base behaviour: every capability off. */
const BASE_BEHAVIOUR: TenantOverrides = Object.freeze({
  jolly: false,
  modifierMultiplier: false,
  posAlphabeticalSort: false,
  stationNotes2x1: false,
  stationHideComandaLine: false,
  stationTable2x1: false,
  openPrice: false,
});

/**
 * slug / tenantId → capabilities that deviate from the base code.
 *
 * A tenant missing here gets `BASE_BEHAVIOUR`, so new tenants are safe by
 * default. Keys may be a slug or a tenant id.
 */
const TENANT_OVERRIDES: Readonly<Record<string, Partial<TenantOverrides>>> = Object.freeze({
  // Antico Casale — the only tenant with a JOLLY product, a ×2 (MAXI) pool, an
  // alphabetically sorted POS product grid, 2x1 notes on station tickets, no
  // `Comanda:` line and a 2x1 table number in the kitchen header.
  casale: {
    jolly: true,
    modifierMultiplier: true,
    posAlphabeticalSort: true,
    stationNotes2x1: true,
    stationHideComandaLine: true,
    stationTable2x1: true,
  },
  "ten_2ad3a695-8893-411f-b922-f28c9b30a6d8": {
    jolly: true,
    modifierMultiplier: true,
    posAlphabeticalSort: true,
    stationNotes2x1: true,
    stationHideComandaLine: true,
    stationTable2x1: true,
  },
  // Franks — the only tenant with an open-price product (PRODOTTO): a POS-only
  // line whose price the waiter types by hand.
  franks: {
    openPrice: true,
  },
  "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f": {
    openPrice: true,
  },
});

/**
 * Resolves the effective overrides for a tenant.
 *
 * Keys are tried in the order given, first match wins, so callers can pass
 * whatever they have: `resolveTenantOverrides(slug, tenantId)` on the API,
 * `resolveTenantOverrides(undefined, tenantId)` in the POS store. An unknown
 * tenant resolves to `BASE_BEHAVIOUR` (everything off).
 */
export function resolveTenantOverrides(
  ...tenantKeys: Array<string | null | undefined>
): TenantOverrides {
  for (const key of tenantKeys) {
    if (!key) continue;
    const entry = TENANT_OVERRIDES[key];
    if (entry) return Object.freeze({ ...BASE_BEHAVIOUR, ...entry });
  }
  return BASE_BEHAVIOUR;
}

/**
 * True when the tenant opted into a capability. Never throws and never
 * defaults to true — an unknown tenant behaves exactly like base code.
 *
 *   hasTenantOverride("modifierMultiplier", tenant.slug, tenant.id)   // API
 *   hasTenantOverride("jolly", undefined, tenantId)                   // POS
 */
export function hasTenantOverride(
  override: TenantOverrideKey,
  ...tenantKeys: Array<string | null | undefined>
): boolean {
  return resolveTenantOverrides(...tenantKeys)[override] === true;
}
