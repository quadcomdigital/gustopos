/**
 * Per-tenant override codes for the dashboard/KPI PIN gate.
 *
 * Scope is deliberately narrow: these codes are accepted **only** by
 * `POST /api/analytics/unlock`. They are not a staff login PIN, they do not
 * bypass any other endpoint, and they never reach a customer-facing document.
 *
 * They live in the API and not in `@gustopos/shared/tenant-overrides` because
 * that registry is compiled into the web bundle: an unlock code must not be
 * readable from the browser. Callers must never default to a code — a tenant
 * absent here keeps the normal behaviour (the logged-in admin's own PIN).
 */
export const DASHBOARD_GATE_CODES: Readonly<Record<string, string>> = Object.freeze({
  // Franks: fixed code requested by the tenant for the KPI panel.
  franks: "1989",
  "ten_26ed333e-9dbd-43f7-85b1-fe57054e9e6f": "1989",
});

function lookup(key: string | null | undefined): string | null {
  const normalized = key?.trim();
  if (!normalized) {
    return null;
  }
  return Object.prototype.hasOwnProperty.call(DASHBOARD_GATE_CODES, normalized.toLowerCase())
    ? DASHBOARD_GATE_CODES[normalized.toLowerCase()]
    : Object.prototype.hasOwnProperty.call(DASHBOARD_GATE_CODES, normalized)
      ? DASHBOARD_GATE_CODES[normalized]
      : null;
}

/**
 * The gate code for the current tenant, or `null` when the tenant has none
 * (the resolved slug is preferred over the id, matching the tenant registry).
 */
export function resolveDashboardGateCode(params: {
  tenantSlug?: string | null;
  tenantId?: string | null;
}): string | null {
  return lookup(params.tenantSlug) ?? lookup(params.tenantId);
}
