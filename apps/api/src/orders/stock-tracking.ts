/**
 * Whether the complex stock-tracking pipeline (recipe/BoM explosion, shortage
 * checks, inventory deductions and stock movements) must run for an order.
 *
 * It runs only for the `inventory` module. `simple_catalog` is the mutually
 * exclusive "catalog only" mode: orders are recorded but never touch stock, so
 * a tenant can sell without ingredients/BoM configured or maintained.
 */
export function isStockTrackingEnabled(enabledModules: readonly string[]): boolean {
  return enabledModules.includes("inventory") && !enabledModules.includes("simple_catalog");
}
